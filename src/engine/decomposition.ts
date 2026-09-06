import { differenceInCalendarDays, parseISO } from 'date-fns';

interface ProgressionDecompositionInput {
  totalProgress: number;
  currentProgress: number;
  deadlineDateStr: string;
  currentDate: Date;
}

/**
 * Calculates daily requirement: ceil((target - currentProgress) / daysRemaining)
 */
export function calculateDailyDecomposedTarget({
  totalProgress,
  currentProgress,
  deadlineDateStr,
  currentDate,
}: ProgressionDecompositionInput): number {
  const remaining = Math.max(0, totalProgress - currentProgress);
  if (remaining === 0) return 0;

  const deadline = parseISO(deadlineDateStr);
  const diffDays = differenceInCalendarDays(deadline, currentDate);
  // Current day counts, so at minimum 1 day remaining
  const daysRemaining = Math.max(1, diffDays + 1);

  return Math.ceil(remaining / daysRemaining);
}