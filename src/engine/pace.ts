// src/engine/pace.ts

interface ProgressLogLike {
    amount: number;
    loggedAt: string;
}

interface PaceTask {
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

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function getDaysRemaining(deadline: string, from: Date): number {
    const deadlineDate = new Date(`${deadline}T00:00:00`);
    const fromMidnight = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const diff = Math.round((deadlineDate.getTime() - fromMidnight.getTime()) / MS_PER_DAY);
    return diff + 1;
}

function getActualRate(logs: ProgressLogLike[], from: Date): number {
    const windowStart = new Date(from.getFullYear(), from.getMonth(), from.getDate() - 6);
    const sum = logs.reduce((acc, log) => {
        const loggedDate = new Date(log.loggedAt);
        return loggedDate >= windowStart ? acc + log.amount : acc;
    }, 0);
    return sum / 7;
}

function getStatus(targetRate: number, actualRate: number, daysRemaining: number, remaining: number): PaceStatus {
    if (remaining <= 0) return 'Ahead';
    if (daysRemaining <= 0 ) return 'Critical';
    if (targetRate <= 0) return 'Ahead';

    const ratio = actualRate / targetRate;
    if (ratio < 0.5) return 'Critical';
    if (ratio < 0.8) return 'Behind';
    if (ratio < 1.0) return "Slightly Behind";
    if (ratio < 1.3) return "On Track";
    return 'Ahead';
}

export function calculatePace(task: PaceTask, logs: ProgressLogLike[], now: Date = new Date()): PaceResult {
    const total = task.totalProgress ?? 0;
    const current = task.currentProgress ?? 0;
    const remaining = Math.max(total - current, 0);

    const daysRemaining = task.deadline ? getDaysRemaining(task.deadline, now) : 0;
    const targetRate = daysRemaining > 0 ? remaining / daysRemaining : remaining;
    const actualRate = getActualRate(logs, now);

    const status = getStatus(targetRate, actualRate, daysRemaining, remaining);

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