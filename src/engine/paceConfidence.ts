// engine/paceConfidence.ts
import { differenceInCalendarDays, parseISO } from 'date-fns';

export function shouldShowPaceStatus(
  task: { createdAt: string; deadline: string | null },
  logs: { loggedAt: string }[]
): boolean {
  if (!task.deadline) return false;
  const created = parseISO(task.createdAt.split('T')[0] ?? task.createdAt);
  const deadline = parseISO(task.deadline);
  const totalDurationDays = differenceInCalendarDays(deadline, created);
  if (totalDurationDays <= 1) return false; // too short a window for a "rate" to mean anything

  const daysElapsed = differenceInCalendarDays(new Date(), created);
  const distinctLogDays = new Set(logs.map((l) => l.loggedAt.split('T')[0])).size;
  return daysElapsed >= 1 || distinctLogDays >= 1;
}