/** Synchronous transactions are intentional: Expo Drizzle commits before an async callback resumes. */
import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import { db } from './client';
import { tasks, progressLogs, taskTags, taskHistory } from './schema';
import { getNextOccurrence } from '../engine/recurrence';
import { getAppToday, getLocalDateString } from '../utils/date';

type Task = typeof tasks.$inferSelect;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const now = () => new Date().toISOString();
const row = (tx: Tx, id: number) => tx.select().from(tasks).where(eq(tasks.id, id)).get();
const children = (tx: Tx, id: number) => tx.select().from(tasks).where(eq(tasks.parentId, id)).orderBy(tasks.subtaskOrder, tasks.id).all();
const generated = (tx: Tx, id: number) => tx.select().from(tasks).where(eq(tasks.sourceTaskId, id)).all();
const progress = (tx: Tx, id: number) => Number(tx.select({ n: sql<number>`coalesce(sum(${progressLogs.amount}), 0)` }).from(progressLogs).where(eq(progressLogs.taskId, id)).get()?.n ?? 0);

function record(tx: Tx, task: Task, action: string, details?: object) {
  tx.insert(taskHistory).values({ taskId: task.id, title: task.title, action, appDate: getAppToday(), createdAt: now(), details: details ? JSON.stringify(details) : null }).run();
}
function writeProgress(tx: Tx, task: Task, value: number, kind = 'progress', notes?: string | null) {
  const delta = value - progress(tx, task.id);
  if (delta !== 0) tx.insert(progressLogs).values({ taskId: task.id, amount: delta, appDate: getAppToday(), loggedAt: now(), kind, notes }).run();
  tx.update(tasks).set({ currentProgress: value, updatedAt: now() }).where(eq(tasks.id, task.id)).run();
}
function clone(tx: Tx, source: Task, date: string, carry: boolean): Task {
  const { id, createdAt, updatedAt, completedAt, completedDate, completionPreviousProgress, ...data } = source;
  const deadline = !carry && source.deadline
    ? getLocalDateString(addDays(parseISO(date), differenceInCalendarDays(parseISO(source.deadline), parseISO(source.scheduledDate)))) : source.deadline;
  const result = tx.insert(tasks).values({ ...data, scheduledDate: date, deadline, seriesId: source.seriesId ?? `task:${id}`, occurrenceDate: date,
    rolloverFromId: carry ? id : null, skippedAt: null, nextOccurrenceGenerated: false, isCompleted: false, currentProgress: 0,
    procrastinationCount: carry ? (source.procrastinationCount ?? 0) + differenceInCalendarDays(parseISO(date), parseISO(source.scheduledDate)) : 0,
    createdAt: now(), updatedAt: now(), subtasksCompleted: 0,
  }).returning().get();
  for (const tag of tx.select().from(taskTags).where(eq(taskTags.taskId, id)).all()) tx.insert(taskTags).values({ taskId: result.id, tagId: tag.tagId }).onConflictDoNothing().run();
  for (const sub of children(tx, id)) {
    const { id: subId, createdAt: c, updatedAt: u, ...subData } = sub;
    const copied = tx.insert(tasks).values({ ...subData, parentId: result.id, sourceTaskId: null, seriesId: null, occurrenceDate: null, scheduledDate: date,
      isCompleted: carry && sub.isCompleted, currentProgress: 0, completedAt: carry ? sub.completedAt : null,
      completedDate: carry ? sub.completedDate : null, nextOccurrenceGenerated: false, createdAt: now(), updatedAt: now() }).returning().get();
    if (carry) writeProgress(tx, copied, progress(tx, subId), 'carry');
  }
  if (carry) writeProgress(tx, result, progress(tx, id), 'carry');
  return result;
}
function repeat(tx: Tx, task: Task) {
  if (!task.isCompleted || task.recurrenceType === 'none' || task.nextOccurrenceGenerated || task.parentId != null) return;
  const next = getNextOccurrence({ ...task, recurrenceType: task.recurrenceType as 'daily' | 'weekly' | 'every_n_days' }, parseISO(task.scheduledDate > getAppToday() ? task.scheduledDate : getAppToday()));
  if (!next) return;
  const seriesId = task.seriesId ?? `task:${task.id}`;
  const date = getLocalDateString(next);
  tx.update(tasks).set({ seriesId, occurrenceDate: task.occurrenceDate ?? task.scheduledDate, nextOccurrenceGenerated: true, updatedAt: now() }).where(eq(tasks.id, task.id)).run();
  const existing = tx.select().from(tasks).where(and(eq(tasks.seriesId, seriesId), eq(tasks.occurrenceDate, date))).get();
  if (!existing) clone(tx, { ...task, seriesId }, date, false);
}
function mark(tx: Tx, task: Task, completed: boolean) {
  if (task.isCompleted === completed) return;
  tx.update(tasks).set({ isCompleted: completed, skippedAt: null, completedAt: completed ? now() : null, completedDate: completed ? getAppToday() : null, updatedAt: now() }).where(eq(tasks.id, task.id)).run();
  record(tx, task, completed ? 'completed' : 'reopened');
  if (completed) repeat(tx, { ...task, isCompleted: true });
}
function effective(tx: Tx, id: number, seen = new Set<number>()): number {
  if (seen.has(id)) throw new Error('A task cannot be its own ancestor.');
  seen.add(id);
  const carry = Number(tx.select({ n: sql<number>`coalesce(sum(${progressLogs.amount}), 0)` }).from(progressLogs).where(and(eq(progressLogs.taskId, id), eq(progressLogs.kind, 'carry'))).get()?.n ?? 0);
  return progress(tx, id) - carry + generated(tx, id).reduce((n, c) => n + effective(tx, c.id, new Set(seen)), 0);
}
function refreshAncestors(tx: Tx, task: Task, seen = new Set<number>()) {
  if (seen.has(task.id)) return;
  seen.add(task.id);
  for (const parentId of [task.parentId, task.sourceTaskId]) {
    if (parentId == null) continue;
    const parent = row(tx, parentId);
    if (!parent) continue;
    const subs = children(tx, parent.id);
    const descendants = (id: number): Task[] => generated(tx, id).flatMap(c => [c, ...descendants(c.id)]);
    let done: boolean;
    if (parent.occurrenceTarget) done = descendants(parent.id).filter(c => c.scope === 'daily' && c.isCompleted).length >= parent.occurrenceTarget;
    else if ((parent.totalProgress ?? 0) > 0) done = effective(tx, parent.id) >= parent.totalProgress!;
    else if (subs.length) done = subs.every(s => s.isCompleted);
    else done = generated(tx, parent.id).some(c => c.isCompleted);
    tx.update(tasks).set({ subtasksCompleted: subs.filter(s => s.isCompleted).length }).where(eq(tasks.id, parent.id)).run();
    mark(tx, parent, done);
    refreshAncestors(tx, { ...parent, isCompleted: done }, seen);
  }
}
function assertUnlocked(tx: Tx, task: Task) {
  const candidate = task.parentId != null ? task : task.sourceTaskId != null ? row(tx, task.sourceTaskId) : undefined;
  if (candidate?.parentId == null) return;
  const parent = row(tx, candidate.parentId);
  if (!parent?.isSequential) return;
  const ordered = children(tx, parent.id);
  if (ordered.slice(0, ordered.findIndex(c => c.id === candidate.id)).some(c => !c.isCompleted)) throw new Error('Complete the previous milestone first.');
}
function setCompletion(tx: Tx, task: Task, completed: boolean) {
  if (task.isCompleted === completed) return;
  if (completed) assertUnlocked(tx, task);
  if ((task.totalProgress ?? 0) > 0) {
    const current = progress(tx, task.id);
    const derived = generated(tx, task.id);
    const totalDone = derived.length ? effective(tx, task.id) : current;
    if (completed && totalDone < task.totalProgress!) {
      tx.update(tasks).set({ completionPreviousProgress: current }).where(eq(tasks.id, task.id)).run();
      writeProgress(tx, task, current + task.totalProgress! - totalDone, 'completion');
    } else if (!completed && task.completionPreviousProgress != null) {
      writeProgress(tx, task, task.completionPreviousProgress, 'correction');
    } else if (!completed && derived.length) {
      // Reopen the most recent completed allocation when completion came from children.
      const latest = [...derived].reverse().find(child => child.isCompleted);
      if (latest) setCompletion(tx, latest, false);
    } else if (!completed && current >= task.totalProgress!) {
      writeProgress(tx, task, 0, 'correction');
    }
  }
  for (const sub of children(tx, task.id)) setCompletion(tx, sub, completed);
  // A generated sequential milestone shares completion with its source milestone.
  if (task.sourceTaskId != null) {
    const source = row(tx, task.sourceTaskId);
    if (source?.parentId != null) mark(tx, source, completed);
  }
  mark(tx, task, completed);
  refreshAncestors(tx, { ...task, isCompleted: completed });
}
export function getAggregateProgress(id: number) { return db.transaction(tx => generated(tx, id).length ? effective(tx, id) : progress(tx, id)); }
export function changeTaskCompletion(id: number, completed?: boolean) {
  return db.transaction(tx => {
    const task = row(tx, id);
    if (!task) throw new Error('This task no longer exists.');
    setCompletion(tx, task, completed ?? !task.isCompleted);
    return row(tx, id)!;
  });
}
function changeProgressIn(tx: Tx, id: number, value: number, notes?: string | null, kind = 'progress') {
  if (!Number.isFinite(value) || value < 0) throw new Error('Progress must be a finite, non-negative number.');
    const task = row(tx, id);
    if (!task) throw new Error('This task no longer exists.');
    const previous = progress(tx, id);
    if (value > previous) assertUnlocked(tx, task);
    if (value === previous) return;
    writeProgress(tx, task, value, kind, notes);
    const completed = (task.totalProgress ?? 0) > 0 && (generated(tx, id).length ? effective(tx, id) : value) >= task.totalProgress!;
    if (completed && !task.isCompleted) tx.update(tasks).set({ completionPreviousProgress: previous }).where(eq(tasks.id, id)).run();
    mark(tx, task, completed);
    refreshAncestors(tx, { ...task, isCompleted: completed });
}
export function changeProgress(id: number, value: number, notes?: string | null, kind = 'progress') {
  return db.transaction(tx => changeProgressIn(tx, id, value, notes, kind));
}
export function commitProgressAction(id: number, value: number, ownerId: number, action: 'none' | 'breathing_room' | 'bank_it' | 'raise_bar', options: { targetRate: number; bankedDaysEarned: number; suggestedNewTarget: number }, notes?: string | null) {
  db.transaction(tx => {
    const owner = row(tx, ownerId);
    if (!owner) throw new Error('Goal no longer exists.');
    const base = owner.nominalDailyTarget ?? options.targetRate;
    const update = { nominalDailyTarget: base, surplusMode: action, updatedAt: now(),
      ...(action === 'bank_it' ? { bufferDays: (owner.bufferDays ?? 0) + options.bankedDaysEarned } : {}),
      ...(action === 'raise_bar' ? { totalProgress: options.suggestedNewTarget } : {}),
    };
    tx.update(tasks).set(update).where(eq(tasks.id, owner.id)).run();
    changeProgressIn(tx, id, value, notes);
  });
}
export function useBankedDay(id: number) {
  return db.transaction(tx => {
    const task = row(tx, id);
    if (!task || (task.bufferDays ?? 0) < 1) throw new Error('No banked days available.');
    if (task.pausedUntil && task.pausedUntil > getAppToday()) throw new Error('A rest day is already active.');
    const tomorrow = getLocalDateString(addDays(parseISO(getAppToday()), 1));
    tx.update(tasks).set({ bufferDays: task.bufferDays! - 1, pausedUntil: tomorrow, updatedAt: now() }).where(eq(tasks.id, id)).run();
    const pause = (parentId: number) => { for (const child of generated(tx, parentId)) { tx.update(tasks).set({ pausedUntil: tomorrow }).where(eq(tasks.id, child.id)).run(); pause(child.id); } };
    pause(id);
    record(tx, task, 'rest_day', { until: tomorrow });
  });
}
export function addProgress(id: number, amount: number, notes?: string | null) {
  if (!Number.isFinite(amount)) throw new Error('Enter a finite amount.');
  // No await between read and write: serial in this JS runtime.
  return db.transaction(tx => changeProgressIn(tx, id, progress(tx, id) + amount, notes));
}
export function rolloverTo(date: string): number {
  return db.transaction(tx => {
    const candidates = tx.select().from(tasks).where(and(eq(tasks.isCompleted, false), eq(tasks.rolloverEnabled, true), eq(tasks.scope, 'daily'), isNull(tasks.parentId), lt(tasks.scheduledDate, date))).all();
    for (const task of candidates) {
      if (task.pausedUntil && task.pausedUntil > date) continue;
      const seriesId = task.seriesId ?? `task:${task.id}`;
      tx.update(tasks).set({ seriesId, occurrenceDate: task.occurrenceDate ?? task.scheduledDate, rolloverEnabled: false, updatedAt: now() }).where(eq(tasks.id, task.id)).run();
      const existing = tx.select().from(tasks).where(and(eq(tasks.seriesId, seriesId), eq(tasks.occurrenceDate, date))).get();
      if (existing) {
        // Keep both history rows; merge only a known occurrence of this series, never by name.
        if (!existing.isCompleted) {
          writeProgress(tx, existing, progress(tx, existing.id) + progress(tx, task.id), 'carry');
          const targetSubs = children(tx, existing.id);
          for (const [index, sub] of children(tx, task.id).entries()) {
            const target = targetSubs.find(candidate => candidate.subtaskOrder === sub.subtaskOrder && candidate.title === sub.title && candidate.type === sub.type && candidate.progressUnit === sub.progressUnit);
            if (!target) {
              const { id: oldId, createdAt, updatedAt, ...data } = sub;
              const copied = tx.insert(tasks).values({ ...data, parentId: existing.id, scheduledDate: date, sourceTaskId: null, seriesId: null, occurrenceDate: null, currentProgress: 0 }).returning().get();
              writeProgress(tx, copied, progress(tx, oldId), 'carry');
            } else {
              writeProgress(tx, target, Math.max(progress(tx, target.id), progress(tx, sub.id)), 'carry');
              if (sub.isCompleted && !target.isCompleted) mark(tx, target, true);
            }
          }
          for (const tag of tx.select().from(taskTags).where(eq(taskTags.taskId, task.id)).all()) tx.insert(taskTags).values({ taskId: existing.id, tagId: tag.tagId }).onConflictDoNothing().run();
          tx.update(tasks).set({ rolloverFromId: task.id, procrastinationCount: (task.procrastinationCount ?? 0) + differenceInCalendarDays(parseISO(date), parseISO(task.scheduledDate)) }).where(eq(tasks.id, existing.id)).run();
        }
      } else clone(tx, { ...task, seriesId }, date, true);
      record(tx, task, 'moved', { from: task.scheduledDate, to: date });
    }
    return candidates.length;
  });
}
function deleteTreeIn(tx: Tx, id: number, seen = new Set<number>()) {
  if (seen.has(id)) return;
  seen.add(id);
  for (const child of [...children(tx, id), ...generated(tx, id)]) deleteTreeIn(tx, child.id, seen);
  tx.delete(tasks).where(eq(tasks.id, id)).run();
}
export function deleteTaskTree(id: number) { db.transaction(tx => deleteTreeIn(tx, id)); }

/** Save a complete editor draft atomically; an invalid tag or child rolls everything back. */
export function saveTaskFamily(id: number | undefined, data: typeof tasks.$inferInsert, drafts: Array<Partial<typeof tasks.$inferInsert>>, tagIds: number[]) {
  return db.transaction(tx => {
    for (const item of [data, ...drafts]) {
      if (!item.title?.trim()) throw new Error('Every task needs a title.');
      if (item.totalProgress != null && (!Number.isFinite(item.totalProgress) || item.totalProgress <= 0)) throw new Error('Targets must be positive numbers.');
      for (const value of [item.occurrenceTarget, item.recurrenceInterval]) if (value != null && (!Number.isSafeInteger(value) || value < 1)) throw new Error('Repeat counts and intervals must be positive whole numbers.');
    }
    if (id != null && !row(tx, id)) throw new Error('This task no longer exists.');
    const parent = id == null
      ? tx.insert(tasks).values({ ...data, subtasksTotal: drafts.length }).returning().get()
      : tx.update(tasks).set({ ...data, subtasksTotal: drafts.length, updatedAt: now() }).where(eq(tasks.id, id)).returning().get();
    const existing = children(tx, parent.id);
    for (const child of existing) if (!drafts.some(d => d.id === child.id)) deleteTreeIn(tx, child.id);
    drafts.forEach((draft, index) => {
      const values = { ...draft, title: draft.title!.trim(), parentId: parent.id, priority: parent.priority, scheduledDate: parent.scheduledDate, scope: parent.scope, pursuitId: parent.pursuitId, subtaskOrder: index, updatedAt: now() };
      if (draft.id != null) {
        if (!existing.some(c => c.id === draft.id)) throw new Error('A subtask belongs to a different task.');
        tx.update(tasks).set(values).where(eq(tasks.id, draft.id)).run();
      } else tx.insert(tasks).values({ ...values, type: draft.type ?? 'Simple' }).run();
    });
    tx.delete(taskTags).where(eq(taskTags.taskId, parent.id)).run();
    for (const tagId of new Set(tagIds)) tx.insert(taskTags).values({ taskId: parent.id, tagId }).run();
    return parent;
  });
}

function copyMilestonesIn(tx: Tx, sourceId: number, destinationId: number) {
    if (children(tx, destinationId).length) return;
    let source = row(tx, sourceId);
    const seen = new Set<number>();
    while (source && !children(tx, source.id).length && source.sourceTaskId != null && !seen.has(source.id)) {
      seen.add(source.id); source = row(tx, source.sourceTaskId);
    }
    const destination = row(tx, destinationId);
    if (!source || !destination) return;
    const template = children(tx, source.id);
    for (const child of template) {
      const { id, createdAt, updatedAt, ...data } = child;
      tx.insert(tasks).values({ ...data, parentId: destinationId, sourceTaskId: null, scheduledDate: destination.scheduledDate,
        scope: destination.scope, seriesId: null, occurrenceDate: null, rolloverFromId: null, currentProgress: 0,
        isCompleted: false, completedAt: null, completedDate: null, completionPreviousProgress: null, nextOccurrenceGenerated: false }).run();
    }
    tx.update(tasks).set({ subtasksTotal: template.length, subtasksCompleted: 0 }).where(eq(tasks.id, destinationId)).run();
}
export function copyMilestones(sourceId: number, destinationId: number) { db.transaction(tx => copyMilestonesIn(tx, sourceId, destinationId)); }

/** Explicitly materialize a projection once, even if its daily task exists below a generated tier. */
export function materializeProjection(sourceId: number, date: string, target?: number | null) {
  return db.transaction(tx => {
    const source = row(tx, sourceId);
    if (!source) throw new Error('This goal no longer exists.');
    const find = (id: number): Task | undefined => {
      for (const child of generated(tx, id)) {
        if (child.scope === 'daily' && child.scheduledDate === date) return child;
        const result = find(child.id); if (result) return result;
      }
    };
    const existing = find(sourceId); if (existing) return existing;
    const created = tx.insert(tasks).values({ title: source.title, type: source.type, priority: source.priority, pursuitId: source.pursuitId,
      scope: 'daily', scheduledDate: date, deadline: date, sourceTaskId: source.id, totalProgress: target ?? null,
      progressUnit: source.progressUnit, isSequential: source.isSequential, rolloverEnabled: false,
      seriesId: `allocation:${sourceId}`, occurrenceDate: date }).returning().get();
    for (const tag of tx.select().from(taskTags).where(eq(taskTags.taskId, source.id)).all()) tx.insert(taskTags).values({ taskId: created.id, tagId: tag.tagId }).run();
    if (source.type === 'Hybrid') copyMilestonesIn(tx, source.id, created.id);
    return created;
  });
}

export function postponeTask(id: number) {
  return db.transaction(tx => {
    const task = row(tx, id);
    if (!task || task.isCompleted || task.skippedAt) throw new Error('Only unfinished tasks can be postponed.');
    const from = task.scheduledDate;
    const to = getLocalDateString(addDays(parseISO(from > getAppToday() ? from : getAppToday()), 1));
    tx.update(tasks).set({ scheduledDate: to, updatedAt: now() }).where(eq(tasks.id, id)).run();
    for (const sub of children(tx, id)) tx.update(tasks).set({ scheduledDate: to }).where(eq(tasks.id, sub.id)).run();
    record(tx, task, 'moved', { from, to });
  });
}

export function skipTask(id: number) {
  db.transaction(tx => {
    const task = row(tx, id);
    if (!task || task.isCompleted || task.skippedAt) return;
    tx.update(tasks).set({ skippedAt: now(), rolloverEnabled: false, updatedAt: now() }).where(eq(tasks.id, id)).run();
    record(tx, task, 'skipped');
    repeat(tx, { ...task, isCompleted: true });
  });
}
