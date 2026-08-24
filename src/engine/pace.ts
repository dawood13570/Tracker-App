// src/engine/pace.ts

export interface ProgressLogLike {
  amount: number;
  loggedAt: string;
}

export interface PaceTask {
  currentProgress?: number | null;
  totalProgress?: number | null;
  deadline?: string | null;
}

export type PaceStatus = 'Critical' | 'Behind' | 'Slightly Behind' | 'On Track' | 'Ahead';

export interface PaceResult {
  target_rate: number;
  actual_rate: number;
  status: PaceStatus;
  days_remaining: number;
  days_of_buffer: number;
}

export interface SurplusOptions {
  surplusAmount: number;
  bankedDaysEarned: number;
  newDailyPace: number;
  suggestedNewTarget: number;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function getDaysRemaining(deadline: string, from: Date): number {
  const deadlineDate = new Date(`${deadline}T00:00:00`);
  const fromMidnight = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const diff = Math.round((deadlineDate.getTime() - fromMidnight.getTime()) / MS_PER_DAY);
  return Math.max(diff + 1, 0);
}

export function getActualRate(logs: ProgressLogLike[], from: Date): number {
  const windowStart = new Date(from.getFullYear(), from.getMonth(), from.getDate() - 6);
  const sum = logs.reduce((acc, log) => {
    const loggedDate = new Date(log.loggedAt);
    return loggedDate >= windowStart ? acc + log.amount : acc;
  }, 0);
  return sum / 7;
}

export function getStatus(
  targetRate: number,
  actualRate: number,
  daysRemaining: number,
  remaining: number,
  logsCount: number
): PaceStatus {
  if (remaining <= 0) return 'Ahead';
  if (daysRemaining <= 0) return 'Critical';
  if (targetRate <= 0) return 'Ahead';

  // Fresh task with zero logs starts as 'On Track' instead of jumping to 'Critical'
  if (logsCount === 0) return 'On Track';

  const ratio = actualRate / targetRate;
  if (ratio < 0.5) return 'Critical';
  if (ratio < 0.8) return 'Behind';
  if (ratio < 1.0) return 'Slightly Behind';
  if (ratio < 1.3) return 'On Track';
  return 'Ahead';
}

export function calculateBreathingRoomRate(
  remainingAfterLog: number,
  daysRemaining: number,
  nominalTargetRate: number
): number {
  if (daysRemaining <= 0) return remainingAfterLog;
  const unconstrainedRate = remainingAfterLog / daysRemaining;
  const minAllowedRate = nominalTargetRate * 0.5; // Capped at 50% max reduction
  return Math.max(unconstrainedRate, minAllowedRate);
}

export function getSurplusChoices(
  loggedAmount: number,
  currentProgress: number,
  totalProgress: number,
  daysRemaining: number,
  nominalTargetRate: number
): SurplusOptions | null {
  if (nominalTargetRate <= 0) return null;

  const threshold = nominalTargetRate * 1.3;
  if (loggedAmount <= threshold) return null;

  const surplusAmount = loggedAmount - nominalTargetRate;
  const remainingAfterLog = Math.max(totalProgress - (currentProgress + loggedAmount), 0);

  // Breathing Room: recalculate daily requirement with a 50% max reduction floor
  const newDailyPace = calculateBreathingRoomRate(
    remainingAfterLog,
    Math.max(daysRemaining - 1, 1),
    nominalTargetRate
  );

  // Bank It: calculate full days earned from surplus
  const bankedDaysEarned = Math.floor(surplusAmount / nominalTargetRate);

  // Stretch Goal: calculate rounded 20% bump
  const suggestedNewTarget = Math.round(totalProgress * 1.2);

  return {
    surplusAmount: Math.round(surplusAmount * 10) / 10,
    bankedDaysEarned: Math.max(bankedDaysEarned, 1),
    newDailyPace: Math.round(newDailyPace * 10) / 10,
    suggestedNewTarget,
  };
}

export function calculatePace(task: PaceTask, logs: ProgressLogLike[], now: Date = new Date()): PaceResult {
  const total = task.totalProgress ?? 0;
  const current = task.currentProgress ?? 0;
  const remaining = Math.max(total - current, 0);

  const daysRemaining = task.deadline ? getDaysRemaining(task.deadline, now) : 0;
  const targetRate = daysRemaining > 0 ? remaining / daysRemaining : remaining;
  const actualRate = getActualRate(logs, now);

  const status = getStatus(targetRate, actualRate, daysRemaining, remaining, logs.length);

  const daysOfBuffer = actualRate > 0
    ? (actualRate * daysRemaining - remaining) / actualRate
    : (remaining <= 0 ? daysRemaining : -daysRemaining);

  return {
    target_rate: Math.round(targetRate * 100) / 100,
    actual_rate: Math.round(actualRate * 100) / 100,
    status,
    days_remaining: daysRemaining,
    days_of_buffer: Math.round(daysOfBuffer * 100) / 100,
  };
}