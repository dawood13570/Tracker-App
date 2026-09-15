import { TaskRow } from '@/db/queries';

export function taskHasProgress(task: Pick<TaskRow, 'totalProgress'>): boolean {
  return task.totalProgress != null && task.totalProgress > 0;
}

export function taskHasSubtasks(counts?: { completed: number; total: number }): boolean {
  return Boolean(counts && counts.total > 0);
}