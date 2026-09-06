// src/engine/rollover.ts
export interface RolloverSnapshotInput {
  id: number;
  title: string;
  type: 'Simple' | 'Progression' | 'Hybrid';
  priority: 'Low' | 'Medium' | 'High';
  isCompleted: boolean;
  rolloverEnabled: boolean;
  scheduledDate: string;
  procrastinationCount: number | null;
  scope: 'daily' | 'weekly' | 'monthly' | 'yearly'; // <-- updated to include monthly & yearly
  totalProgress: number | null;
  progressUnit: string | null;
}

export interface RolloverAction {
  sourceId: number;
  newCard: {
    title: string;
    type: 'Simple' | 'Progression' | 'Hybrid';
    priority: 'Low' | 'Medium' | 'High';
    scheduledDate: string;
    procrastinationCount: number;
    rolloverEnabled: boolean;
    scope: 'daily' | 'weekly' | 'monthly' | 'yearly'; // <-- updated here too
    totalProgress: number | null;
    progressUnit: string | null;
    sourceTaskId: number;
  };
}

export function processRollover(tasks: RolloverSnapshotInput[], today: string): RolloverAction[] {
  const actions: RolloverAction[] = [];

  for (const task of tasks) {
    if (!task.isCompleted && task.rolloverEnabled && task.scheduledDate < today) {
      const nextCount = (task.procrastinationCount ?? 0) + 1;
      actions.push({
        sourceId: task.id,
        newCard: {
          title: task.title,
          type: task.type,
          priority: task.priority,
          scheduledDate: today,
          procrastinationCount: nextCount,
          rolloverEnabled: true,
          scope: task.scope,
          totalProgress: task.totalProgress,
          progressUnit: task.progressUnit,
          sourceTaskId: task.id,
        },
      });
    }
  }

  return actions;
}