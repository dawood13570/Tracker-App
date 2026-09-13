// src/utils/reflections.ts
import { isAfter, isSameDay, parseISO } from 'date-fns';

/**
 * Returns true if today is on or after the period's end date.
 * Allows viewing/adding reflection once the final day has arrived.
 */
export function isPeriodEligibleForReflection(periodEndDate: Date | string): boolean {
  const today = new Date();
  const targetEnd = typeof periodEndDate === 'string' ? parseISO(periodEndDate) : periodEndDate;
  return isSameDay(today, targetEnd) || isAfter(today, targetEnd);
}