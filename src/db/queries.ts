// src/db/queries.ts
import type { InferInsertModel } from 'drizzle-orm';
import { and, desc, eq, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { db } from './client';
import { progressLogs, tasks } from './schema';

export type NewTask = InferInsertModel<typeof tasks>;
export type NewProgressLog = InferInsertModel<typeof progressLogs>;

export async function getTaskByDate(date: string) {
    return db.select().from(tasks).where(and(eq(tasks.scheduledDate, date), isNull(tasks.parentId)));
}

export async function insertTask(data: NewTask) {
    const [inserted] = await db.insert(tasks).values(data).returning();
    return inserted;
}

export async function insertSubtask(parentId: number, data: Partial<NewTask>) {
    const payload: NewTask = {
        title: data.title ?? '',
        type: data.type ?? 'Simple',
        priority: data.priority ?? 'Low',
        scheduledDate: data.scheduledDate ?? '',
        isCompleted: false,
        parentId,
        ...data,  
    };
    const [inserted] = await db.insert(tasks).values(payload).returning();
    return inserted;
}

export async function getSubtasksByParent(parentId: number) {
    return db
    .select()
    .from(tasks)
    .where(eq(tasks.parentId, parentId))
    .orderBy(tasks.id)
}

export async function getSubtaskCounts(parentId: number) {
    const subtasksList = await getSubtasksByParent(parentId);
    const total = subtasksList.length;
    const completed = subtasksList.filter((s) => s.isCompleted).length;
    return { completed, total};
}

export async function toggleTaskStatus(id: number) {
    const [updated]  = await db
        .update(tasks)
        .set({ isCompleted: sql`NOT ${tasks.isCompleted}` })
        .where(eq(tasks.id, id))
        .returning()
    return updated;

}

export async function getActiveProgressionTasks() {
    return db.select()
    .from(tasks)
    .where(
        and(
            eq(tasks.isCompleted, false),
            eq(tasks.type, 'Progression'),
            isNotNull(tasks.deadline)
        )
    )
}

export type UpdateTask = Partial<NewTask>;

export async function updateTask(id: number, data: UpdateTask) {
    const [updated] = await db
        .update(tasks)
        .set(data)
        .where(eq(tasks.id, id))
        .returning();
    return updated;  
}

export async function deleteTask(id: number) {
    const [deleted] = await db
        .delete(tasks)
        .where(eq(tasks.id, id))
        .returning();
    return deleted;  
}

export async function getRolloverCandidates(todayStr: string) {
    return db.select()
    .from(tasks)
    .where(
        and(
            eq(tasks.isCompleted, false),
            eq(tasks.rolloverEnabled, true),
            lt(tasks.scheduledDate, todayStr)
        )
    )
}

export async function applyRolloverMutations(
    mutations: Array<{ id: number; scheduledDate: string; procrastinationCount: number}>
) {
    for(const mutation of mutations) {
        await db
        .update(tasks)
        .set({
            scheduledDate: mutation.scheduledDate,
            procrastinationCount: mutation.procrastinationCount,
        })
        .where(eq(tasks.id, mutation.id))
    }
}

export async function insertProgressLog(data: NewProgressLog) {
    const [inserted] = await db.insert(progressLogs).values(data).returning();
    return inserted;
}

export async function getCurrentProgress(taskId: number): Promise<number> {
    const result = await db.get<{ total: number | null }>(
        sql`SELECT SUM(amount) as total FROM progress_logs WHERE task_id = ${taskId}`
    );
    return result?.total ?? 0;
}

export async function getProgressLogsByTask(taskId: number) {
    return db
    .select()
    .from(progressLogs)
    .where(eq(progressLogs.taskId, taskId))
    .orderBy(desc(progressLogs.loggedAt));
}

export async function setAllSubtasksStatus(parentId: number, isCompleted: boolean) {
  return db
    .update(tasks)
    .set({ isCompleted })
    .where(eq(tasks.parentId, parentId))
    .returning();
}