import { eq } from 'drizzle-orm';
import { addMonths, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { db } from './client';
import { tasks, taskTags, goalRestDays, surplusCredits, progressLogs, taskHistory } from './schema';
import { projectQuantity } from '../engine/quantityPlan';
import { getAppToday } from '../utils/date';
import { bankRoot, planRoot, rangeEnd, readPlanData, type PlanTask as Task, type PlanTx } from './planData';
export { rangeEnd, planRoot as quantityRoot } from './planData';
export const isQuantityGoal = (t: Task) => t.scope !== 'daily' && t.parentId == null && t.type === 'Progression' && (t.totalProgress ?? 0) > 0 && !t.occurrenceTarget;
const weekStart = (date: string) => format(startOfWeek(parseISO(date), { weekStartsOn: 1 }), 'yyyy-MM-dd');
const weekEnd = (date: string) => format(endOfWeek(parseISO(date), { weekStartsOn: 1 }), 'yyyy-MM-dd');
export function quantitySnapshot(root: Task, today: string, all = db.select().from(tasks).all(), tx: PlanTx | typeof db = db) {
  const data = readPlanData(root, today, tx, all);
  const locked: Record<string, number> = {};
  const restDates = new Set<string>();
  for (const leaf of data.descendants.filter(t => t.scope === 'daily')) {
    if (leaf.skippedAt) restDates.add(leaf.scheduledDate);
    else if ((leaf.currentProgress ?? 0) > 0 || leaf.isCompleted) locked[leaf.scheduledDate] = Math.max(locked[leaf.scheduledDate] ?? 0, leaf.totalProgress ?? 0);
  }
  for (const [date, amount] of Object.entries(data.byDate)) if (amount > 0 && date >= today && locked[date] == null) {
    locked[date] = data.descendants.find(t => t.scope === 'daily' && t.scheduledDate === date)?.totalProgress ?? data.creditRows.find(c => c.appDate === date)?.baseline ?? Math.ceil(data.baseline);
  }
  if (root.pausedUntil && root.pausedUntil > today) restDates.add(today);
  const days = projectQuantity({ start: root.scheduledDate, end: rangeEnd(root), today, total: root.totalProgress!, done: data.done, baseline: data.baseline,
    mode: root.surplusMode, progressByDate: data.byDate, lockedTargets: locked, restDates, credits: data.credits, spent: data.spent });
  return { ...data, days, restDates };
}
export function forecastQuantityGoals(from: string, to: string, today = getAppToday()) {
  const all = db.select().from(tasks).all();
  return all.filter(t => isQuantityGoal(t) && t.sourceTaskId == null && !t.isCompleted && t.scheduledDate <= to && rangeEnd(t) >= from).flatMap(root => {
    const snapshot = quantitySnapshot(root, today, all);
    const existing = new Set(snapshot.descendants.filter(t => t.scope === 'daily').map(t => t.scheduledDate));
    return snapshot.days.filter(day => day.date >= from && day.date <= to && day.target > 0 && !day.rest && !existing.has(day.date)).map(day => ({
      goalId: root.id, goalTitle: root.title, type: 'Progression' as const, priority: root.priority, date: day.date,
      totalProgress: day.target, progressUnit: root.progressUnit, bankCovered: day.covered,
    }));
  });
}
/** Merge only structural legacy weeks, retaining their work and audit history. */
export function normalizeWeeks(tx: PlanTx, root: Task) {
  const all = tx.select().from(tasks).all();
  const weeks = new Map<string, Task>();
  for (const item of all.filter(t => t.id !== root.id && t.parentId == null && planRoot(t, all).id === root.id)) {
    if (item.scope === 'monthly') tx.update(tasks).set({ planSummary: true, sourceTaskId: root.id }).where(eq(tasks.id, item.id)).run();
    if (item.scope !== 'weekly') continue;
    const start = weekStart(item.scheduledDate); const canonical = weeks.get(start);
    if (canonical) {
      tx.update(tasks).set({ sourceTaskId: canonical.id }).where(eq(tasks.sourceTaskId, item.id)).run();
      tx.update(tasks).set({ parentId: canonical.id }).where(eq(tasks.parentId, item.id)).run();
      tx.update(progressLogs).set({ taskId: canonical.id }).where(eq(progressLogs.taskId, item.id)).run();
      tx.update(taskHistory).set({ taskId: canonical.id }).where(eq(taskHistory.taskId, item.id)).run();
      for (const tag of tx.select().from(taskTags).where(eq(taskTags.taskId, item.id)).all()) tx.insert(taskTags).values({ taskId: canonical.id, tagId: tag.tagId }).onConflictDoNothing().run();
      tx.delete(tasks).where(eq(tasks.id, item.id)).run();
    } else {
      weeks.set(start, item);
      tx.update(tasks).set({ sourceTaskId: root.id, scheduledDate: start, deadline: rangeEnd(root) < weekEnd(start) ? rangeEnd(root) : weekEnd(start), planSummary: false }).where(eq(tasks.id, item.id)).run();
    }
  }
}
/** One transaction updates projections, stored allocations and coverage receipts together. */
export function reconcileQuantityGoal(rootId: number, today: string, materializeDate = today) {
  return db.transaction(tx => {
    let all = tx.select().from(tasks).all();
    const candidate = all.find(t => t.id === rootId); if (!candidate) throw new Error('Goal no longer exists.');
    const root = planRoot(candidate, all);
    if (!isQuantityGoal(root)) return null;
    normalizeWeeks(tx, root); all = tx.select().from(tasks).all();
    const snapshot = quantitySnapshot(root, today, all, tx);
    const bank = Math.max(0, snapshot.credits.reduce((n, c) => n + c.amount, 0) - snapshot.spent);
    tx.update(tasks).set({ nominalDailyTarget: snapshot.baseline, bufferDays: snapshot.baseline > 0 ? bank / snapshot.baseline : 0 }).where(eq(tasks.id, root.id)).run();
    snapshot.creditRows.forEach((c, i) => tx.update(surplusCredits).set({ earned: snapshot.credits[i].amount }).where(eq(surplusCredits.id, c.id)).run());
    const budgets = (start: string, end: string) => {
      const done = Object.entries(snapshot.byDate).filter(([date]) => date >= start && date <= end).reduce((n, [, value]) => n + value, 0);
      const days = snapshot.days.filter(day => day.date >= start && day.date <= end);
      const covered = days.reduce((n, day) => n + day.covered, 0);
      return { done, covered, target: done + days.reduce((n, day) => n + day.work + day.covered, 0) };
    };
    const ensureWeek = (date: string) => {
      if (root.scope === 'weekly') return root;
      const start = weekStart(date); const end = weekEnd(date); const budget = budgets(start, end);
      let week = all.find(t => t.sourceTaskId === root.id && t.scope === 'weekly' && t.scheduledDate === start);
      const values = { totalProgress: budget.target, currentProgress: budget.done, bankCovered: budget.covered, isCompleted: budget.target > 0 && budget.done >= budget.target, pursuitId: root.pursuitId, priority: root.priority };
      if (week) week = tx.update(tasks).set(values).where(eq(tasks.id, week.id)).returning().get();
      else { week = tx.insert(tasks).values({ ...values, title: `${root.title} (Weekly)`, type: 'Progression', scope: 'weekly', sourceTaskId: root.id,
        scheduledDate: start, deadline: rangeEnd(root) < end ? rangeEnd(root) : end, progressUnit: root.progressUnit,
        rolloverEnabled: false, seriesId: `range-week:${root.id}`, occurrenceDate: start }).returning().get(); all.push(week); }
      return week;
    };
    // Monthly views sum the continuous daily plan; they never divide or own a week.
    let month: Task | undefined;
    if (root.scope === 'yearly' || root.scope === 'custom') {
      for (let date = startOfMonth(parseISO(root.scheduledDate)); format(date, 'yyyy-MM-dd') <= rangeEnd(root); date = addMonths(date, 1)) {
        const start = format(date, 'yyyy-MM-dd'); const end = format(endOfMonth(date), 'yyyy-MM-dd'); const budget = budgets(start, end);
        const existing = all.find(t => t.sourceTaskId === root.id && t.scope === 'monthly' && t.scheduledDate === start);
        const values = { totalProgress: budget.target, currentProgress: budget.done, bankCovered: budget.covered, planSummary: true, isCompleted: budget.target > 0 && budget.done >= budget.target, priority: root.priority, pursuitId: root.pursuitId };
        const result = existing ? tx.update(tasks).set(values).where(eq(tasks.id, existing.id)).returning().get() : tx.insert(tasks).values({ ...values, title: `${root.title} (Monthly summary)`, type: 'Progression', scope: 'monthly', scheduledDate: start,
          deadline: rangeEnd(root) < end ? rangeEnd(root) : end, sourceTaskId: root.id, progressUnit: root.progressUnit, rolloverEnabled: false }).returning().get();
        if (start <= materializeDate && end >= materializeDate) month = result;
      }
    }
    let daily: Task | undefined; let week: Task | undefined;
    for (const day of snapshot.days) {
      const existing = snapshot.descendants.find(t => t.scope === 'daily' && t.scheduledDate === day.date && !t.skippedAt);
      if (day.date !== materializeDate && !existing) continue;
      if (day.rest) continue;
      if (day.target <= 0 && !existing) continue;
      const parent = ensureWeek(day.date);
      const values = { sourceTaskId: parent.id, pursuitId: root.pursuitId, priority: root.priority, bankCovered: day.covered, ...(day.locked ? {} : { totalProgress: day.target }) };
      const leaf = existing ? tx.update(tasks).set(values).where(eq(tasks.id, existing.id)).returning().get() : tx.insert(tasks).values({ ...values, title: `${root.title} (Daily)`, type: 'Progression', scope: 'daily', scheduledDate: day.date, deadline: day.date,
        totalProgress: day.target, progressUnit: root.progressUnit, rolloverEnabled: false, seriesId: `range-day:${root.id}`, occurrenceDate: day.date }).returning().get();
      tx.insert(goalRestDays).values({ ownerId: root.id, appDate: day.date, target: day.target, covered: day.covered, createdAt: new Date().toISOString() })
        .onConflictDoUpdate({ target: [goalRestDays.ownerId, goalRestDays.appDate], set: { target: day.target, covered: day.covered } }).run();
      for (const tag of tx.select().from(taskTags).where(eq(taskTags.taskId, root.id)).all()) tx.insert(taskTags).values({ taskId: leaf.id, tagId: tag.tagId }).onConflictDoNothing().run();
      if (day.date === materializeDate) { daily = leaf; week = parent; }
    }
    for (const existing of all.filter(t => t.sourceTaskId === root.id && t.scope === 'weekly' && rangeEnd(t) >= today)) ensureWeek(existing.scheduledDate);
    return { daily, week, month, ...snapshot };
  });
}
export function reconcileDailyBanks(today: string) {
  db.transaction(tx => {
    const all = tx.select().from(tasks).all();
    for (const root of all.filter(t => t.scope === 'daily' && t.parentId == null && t.sourceTaskId == null && bankRoot(t, all).id === t.id && (t.totalProgress ?? 0) > 0)) {
      const data = readPlanData(root, today, tx, all); let used = data.spent;
      for (const leaf of data.descendants.filter(t => t.scheduledDate >= today).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.id - b.id)) {
        const available = Math.max(0, data.credits.filter(c => c.date < leaf.scheduledDate).reduce((n, c) => n + c.amount, 0) - used);
        const covered = leaf.skippedAt ? 0 : Math.min(available, Math.max(0, (leaf.totalProgress ?? 0) - (leaf.currentProgress ?? 0)));
        used += covered;
        tx.update(tasks).set({ bankCovered: covered }).where(eq(tasks.id, leaf.id)).run();
        tx.insert(goalRestDays).values({ ownerId: root.id, appDate: leaf.scheduledDate, target: leaf.totalProgress ?? 0, covered, createdAt: new Date().toISOString() })
          .onConflictDoUpdate({ target: [goalRestDays.ownerId, goalRestDays.appDate], set: { target: leaf.totalProgress ?? 0, covered } }).run();
      }
      data.creditRows.forEach((c, i) => tx.update(surplusCredits).set({ earned: data.credits[i].amount }).where(eq(surplusCredits.id, c.id)).run());
      const balance = Math.max(0, data.credits.reduce((n, c) => n + c.amount, 0) - data.spent);
      tx.update(tasks).set({ bufferDays: data.baseline > 0 ? balance / data.baseline : 0 }).where(eq(tasks.id, root.id)).run();
    }
  });
}
export function reconcileQuantityPlans(today: string) {
  reconcileDailyBanks(today);
  const all = db.select().from(tasks).all();
  for (const root of all.filter(t => t.sourceTaskId == null && isQuantityGoal(t))) reconcileQuantityGoal(root.id, today);
}
