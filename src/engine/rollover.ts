interface RolloverInput {
    id: number;
    isCompleted: boolean;
    rolloverEnabled: boolean;
    scheduledDate: string;
    procrastinationCount: number | null;
}

interface RolloverMutation {
    id: number;
    scheduledDate: string;
    procrastinationCount: number;
}

export function processRollover(tasks: RolloverInput[], today: string): RolloverMutation[] {
    const mutations: RolloverMutation[] = [];

    for (const task of tasks) {
        if (!task.isCompleted && task.rolloverEnabled && task.scheduledDate < today) {
            mutations.push({id: task.id, scheduledDate: today, procrastinationCount: (task.procrastinationCount ?? 0) + 1});
        }
    }

    return mutations;

}