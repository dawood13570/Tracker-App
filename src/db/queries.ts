import type { InferInsertModel } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { db } from './client';
import { tasks } from './schema';

export type NewTask = InferInsertModel<typeof tasks>;

export async function insertTask(data: NewTask) {
    const [inserted] = await db.insert(tasks).values(data).returning();
    return inserted;
}

export async function toggleTaskStatus(id: number, currentStatus: boolean) {
    const [updated]  = await db
        .update(tasks)
        .set({ isCompleted: !currentStatus })
        .where(eq(tasks.id, id))
        .returning()
    return updated;

}