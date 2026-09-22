import { insertProgressLog, updateTask } from '@/db/queries';
import { getSurplusChoices, type SurplusOptions } from './pace';

export interface SurplusCheckResult {
  surplus: SurplusOptions | null;
  handled: boolean;
}

export async function commitProgressWithSurplusCheck(
  task: {
    id: number;
    totalProgress: number | null;
    surplusMode: string | null;
    bufferDays: number | null;
  },
  delta: number,
  currentProgress: number,
  daysRemaining: number,
  targetRate: number
): Promise<SurplusCheckResult> {
  const total = task.totalProgress ?? 0;
  const surplus = getSurplusChoices(delta, currentProgress, total, daysRemaining, targetRate);

  // If a valid surplus exists and automated surplusMode is active ('bank_it' or 'raise_bar')
  if (
    surplus &&
    total > currentProgress + delta &&
    task.surplusMode &&
    task.surplusMode !== 'none'
  ) {
    // 1. Insert progress log
    await insertProgressLog({ taskId: task.id, amount: delta });

    // 2. Apply chosen surplus side effects
    if (task.surplusMode === 'bank_it') {
      await updateTask(task.id, {
        bufferDays: (task.bufferDays ?? 0) + surplus.bankedDaysEarned,
      });
    } else if (task.surplusMode === 'raise_bar') {
      await updateTask(task.id, {
        totalProgress: surplus.suggestedNewTarget,
      });
    }

    return { surplus: null, handled: true };
  }

  // Not auto-handled; return choices to caller
  return { surplus, handled: false };
}