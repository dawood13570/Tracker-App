import {
  getHabitsByDate,
  getProgressLoggedForDate,
  getTasksForDateRange,
} from '@/db/queries';

export async function generateDailySeed(dateStr: string): Promise<string> {
  const tasksForDay = await getTasksForDateRange(dateStr, dateStr);
  const completed = tasksForDay.filter((t) => t.isCompleted).length;
  const total = tasksForDay.length;
  const moved = tasksForDay.filter((t) => (t.procrastinationCount ?? 0) > 0).length;
  const loggedAmount = await getProgressLoggedForDate(dateStr);

  let summary = `Completed ${completed}/${total} task${total === 1 ? '' : 's'} today.`;
  if (loggedAmount > 0) summary += ` Logged ${loggedAmount} unit${loggedAmount === 1 ? '' : 's'} of progress.`;
  if (moved > 0) summary += ` ${moved} task${moved > 1 ? 's' : ''} carried over from before.`;
  return summary;
}

export async function generatePeriodSeed(
  _scope: 'weekly' | 'monthly' | 'yearly' | 'custom',
  startStr: string,
  endStr: string
): Promise<string> {
  const tasksInRange = await getTasksForDateRange(startStr, endStr);
  const total = tasksInRange.length;
  const completed = tasksInRange.filter((t) => t.isCompleted).length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const movedTotal = tasksInRange.reduce((sum, t) => sum + (t.procrastinationCount ?? 0), 0);

  // Snapshot habits status as of the end boundary
  const habitsSnapshot = await getHabitsByDate(endStr);
  const bestStreak = habitsSnapshot.reduce((max, h) => Math.max(max, h.streak ?? 0), 0);

  let summary = `${completed}/${total} task${total === 1 ? '' : 's'} completed (${completionRate}%).`;
  if (movedTotal > 0) summary += ` ${movedTotal} cumulative day${movedTotal > 1 ? 's' : ''} of carryover across tasks.`;
  if (bestStreak > 0) summary += ` Best habit streak: ${bestStreak}.`;
  return summary;
}