import type { InferInsertModel } from 'drizzle-orm';
import { eq, sql } from 'drizzle-orm';
import { db } from './client';
import { tasks } from './schema';

export type NewTask = InferInsertModel<typeof tasks>;

export async function getTaskByDate(date: string) {
    return db.select().from(tasks).where(eq(tasks.scheduledDate, date));
}

export async function insertTask(data: NewTask) {
    const [inserted] = await db.insert(tasks).values(data).returning();
    return inserted;
}

export async function toggleTaskStatus(id: number) {
    const [updated]  = await db
        .update(tasks)
        .set({ isCompleted: sql`NOT ${tasks.isCompleted}` })
        .where(eq(tasks.id, id))
        .returning()
    return updated;

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