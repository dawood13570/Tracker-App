// src/utils/date.ts
import { useStore } from '@/store/useStore';

export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getAppToday(): string {
  const { dayBoundaryHour, nightOwlMode, manualDayOverrideDate } = useStore.getState();
  const now = new Date();
  const currentCalendarDate = getLocalDateString(now);

  // If the user already tapped "Finalize Day" tonight, don't hold them in yesterday
  if (manualDayOverrideDate === currentCalendarDate) {
    return currentCalendarDate;
  }

  // If night owl mode is active and current hour is between 00:00 and boundaryHour (e.g. 3 AM)
  if (nightOwlMode && now.getHours() < (dayBoundaryHour ?? 3)) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return getLocalDateString(yesterday);
  }

  return currentCalendarDate;
}

/**
 * Returns true if it's currently post-midnight (e.g. 00:00 to boundaryHour)
 * and the user hasn't finalized the day yet.
 */
export function isEligibleToFinalizeDay(): boolean {
  const { dayBoundaryHour, nightOwlMode, manualDayOverrideDate } = useStore.getState();
  if (!nightOwlMode) return false;

  const now = new Date();
  const currentCalendarDate = getLocalDateString(now);

  return now.getHours() < (dayBoundaryHour ?? 3) && manualDayOverrideDate !== currentCalendarDate;
}