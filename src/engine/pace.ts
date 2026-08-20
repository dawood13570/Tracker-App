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
    const current = logs.reduce((acc, log) => acc + log.amount, 0 );
    const remaining = Math.max(total * current, 0);

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

// --- manual test cases (3.2.6-style, delete or move once verified) ---
function assertClose(label: string, actual: number, expected: number, tol = 0.01) {
  const pass = Math.abs(actual - expected) <= tol;
  console.log(`${pass ? 'PASS' : 'FAIL'}: ${label} — got ${actual}, expected ~${expected}`);
}

const today = new Date('2026-08-12T12:00:00');
const daysAgo = (n: number) => new Date(today.getTime() - n * MS_PER_DAY).toISOString();

// 1. Behind: needs 10/day, averaging 4/day over last 7 days
console.log(calculatePace(
  { totalProgress: 300, deadline: '2026-08-22' }, // 10 days remaining incl. today
  [
    { amount: 4, loggedAt: daysAgo(0) }, { amount: 4, loggedAt: daysAgo(1) },
    { amount: 4, loggedAt: daysAgo(2) }, { amount: 4, loggedAt: daysAgo(3) },
    { amount: 4, loggedAt: daysAgo(4) }, { amount: 4, loggedAt: daysAgo(5) },
    { amount: 4, loggedAt: daysAgo(6) },
  ],
  today
)); // expect status 'Behind' (ratio 0.4/1.0... target_rate 30, actual 4 -> ratio 0.13 -> Critical actually)

// 2. Way ahead: target 5/day, averaging 20/day
console.log(calculatePace(
  { totalProgress: 100, deadline: '2026-08-22' },
  [{ amount: 140, loggedAt: daysAgo(0) }],
  today
)); // expect 'Ahead'

// 3. Deadline tomorrow, nowhere near done
console.log(calculatePace(
  { totalProgress: 300, deadline: '2026-08-13' },
  [{ amount: 5, loggedAt: daysAgo(0) }],
  today
)); // expect 'Critical', days_remaining = 2

// 4. Already complete
console.log(calculatePace(
  { totalProgress: 100, deadline: '2026-08-22' },
  [{ amount: 100, loggedAt: daysAgo(1) }],
  today
)); // expect 'Ahead', target_rate should reflect remaining=0

// 5. Deadline passed, incomplete
console.log(calculatePace(
  { totalProgress: 100, deadline: '2026-08-01' },
  [{ amount: 20, loggedAt: daysAgo(2) }],
  today
)); // expect 'Critical', days_remaining <= 0