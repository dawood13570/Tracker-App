import { endOfMonth, endOfWeek, endOfYear, format, parseISO, differenceInCalendarDays } from 'date-fns';
import { db } from './client';
import { tasks, progressLogs, surplusCredits, goalRestDays } from './schema';
export type PlanTask = typeof tasks.$inferSelect;
export type PlanTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export function rangeEnd(task: PlanTask): string {
  if (task.deadline) return task.deadline;
  const date = parseISO(task.scheduledDate);
  return format(task.scope === 'weekly' ? endOfWeek(date, { weekStartsOn: 1 }) : task.scope === 'monthly' ? endOfMonth(date) : task.scope === 'yearly' ? endOfYear(date) : date, 'yyyy-MM-dd');
}
export function planRoot(task: PlanTask, all: PlanTask[]): PlanTask {
  const map = new Map(all.map(t => [t.id, t])); const seen = new Set<number>(); let root = task;
  while (root.sourceTaskId != null && !seen.has(root.id)) {
    seen.add(root.id); const parent = map.get(root.sourceTaskId); if (!parent) break; root = parent;
  }
  return root;
}
/** Repeats share a bank, while their actual completion remains per occurrence. */
export function bankRoot(task: PlanTask, all: PlanTask[]): PlanTask {
  const root = planRoot(task, all);
  if (root.scope !== 'daily' || !root.seriesId) return root;
  return all.filter(t => t.scope === 'daily' && t.parentId == null && t.sourceTaskId == null && t.seriesId === root.seriesId).sort((a, b) => a.id - b.id)[0] ?? root;
}
export function readPlanData(root: PlanTask, today: string, tx: PlanTx | typeof db = db, all = tx.select().from(tasks).all()) {
  const descendants = all.filter(t => bankRoot(t, all).id === root.id);
  const map = new Map(descendants.map(t => [t.id, t]));
  const logs = tx.select().from(progressLogs).all().filter(log => log.taskId != null && map.has(log.taskId) && log.kind !== 'carry');
  const byDate: Record<string, number> = {};
  for (const log of logs) {
    const task = map.get(log.taskId!)!;
    const date = log.creditDate ?? (task.scope === 'daily' ? task.scheduledDate : log.appDate ?? log.loggedAt.slice(0, 10));
    byDate[date] = (byDate[date] ?? 0) + log.amount;
  }
  const done = logs.reduce((n, log) => n + log.amount, 0);
  const days = Math.max(1, differenceInCalendarDays(parseISO(rangeEnd(root)), parseISO(today > root.scheduledDate ? today : root.scheduledDate)) + 1);
  const baseline = root.nominalDailyTarget ?? (root.scope === 'daily' ? root.totalProgress ?? 0 : Math.max(0, ((root.totalProgress ?? 0) - done) / days));
  const creditRows = tx.select().from(surplusCredits).all().filter(c => c.ownerId === root.id);
  const credits = creditRows.map(c => ({ date: c.appDate, amount: c.legacy ? c.earned : c.bankRequested ? Math.max(0, (byDate[c.appDate] ?? 0) - c.baseline) : 0 }));
  const receipts = tx.select().from(goalRestDays).all().filter(c => c.ownerId === root.id);
  // Historical coverage remains a receipt; actual work on that date releases it forward.
  const spent = receipts.filter(c => c.appDate < today).reduce((n, c) => n + Math.min(c.covered, Math.max(0, c.target - (byDate[c.appDate] ?? 0))), 0);
  return { root, descendants, byDate, done, baseline, creditRows, credits, receipts, spent };
}
