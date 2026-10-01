import { getProgressByUnit, getTaskHistory, getTasksForDateRange } from '../db/queries';

export async function generateDailySeed(date: string) { return generatePeriodSeed('daily', date, date); }
export async function generatePeriodSeed(_scope: string, start: string, end: string): Promise<string> {
  const [tasks, history, amounts] = await Promise.all([getTasksForDateRange(start, end), getTaskHistory(), getProgressByUnit(start, end)]);
  const completed = tasks.filter(t => t.isCompleted).length;
  const movements = history.filter(h => h.action === 'moved' && h.appDate >= start && h.appDate <= end).length;
  const logged = amounts.filter(a => a.amount > 0).map(a => `${Number(a.amount.toFixed(2))} ${a.unit || 'unlabelled units'}`).join(', ');
  const lines = [`${completed}/${tasks.length} scheduled task records completed.`];
  if (logged) lines.push(`Progress recorded: ${logged}.`);
  if (movements) lines.push(`${movements} carryover event${movements === 1 ? '' : 's'}.`);
  lines.push('This is a snapshot; later changes do not rewrite saved reflections.');
  return lines.join('\n');
}
