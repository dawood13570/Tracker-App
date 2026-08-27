// src/db/queries.ts
import { calculateHabitStreak } from '@/engine/streaks';
import { endOfWeek, format, startOfWeek } from 'date-fns';
import type { InferInsertModel } from 'drizzle-orm';
import { and, desc, eq, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { db } from './client';
import { habitLogs, habits, progressLogs, tasks } from './schema';


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

export async function insertHabit(data: {
    title: string;
    cadenceType: 'daily' | 'weekly_n_times';
    cadenceTarget?: number;
}) {
    return db.insert(habits).values(data).returning();
}

export async function logHabitCompletion(habitId:number, date: string) {
    return db
    .insert(habitLogs)
    .values({ habitId, date })
    .onConflictDoNothing()
    .returning();
}

// Add near the top of queries.ts, exported so habitStore.ts can import it directly
export type HabitWithStatus = {
  id: number;
  title: string;
  cadenceType: 'daily' | 'weekly_n_times';
  cadenceTarget: number | null;
  createdAt: string;
  isCompletedToday: boolean;
  streak: number;
  weeklyProgress?: { current: number; target: number };
};

export async function getHabitsByDate(date: string): Promise<HabitWithStatus[]> {
    const allHabits = await db.select().from(habits);
    const targetDate = new Date(date);

    const weekStart = format(startOfWeek(targetDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(targetDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');

    const habitsWithStatus = await Promise.all(
        allHabits.map(async (habit): Promise<HabitWithStatus> => {
            const allLogs = await db
                .select({ date: habitLogs.date })
                .from(habitLogs)
                .where(eq(habitLogs.habitId, habit.id));

            const logDates = allLogs.map((l) => l.date);
            const isCompletedToday = logDates.includes(date);
            const streak = calculateHabitStreak(habit, logDates, date);

            if (habit.cadenceType === 'daily') {
                return { ...habit, isCompletedToday, streak };
            }

            const weekLogs = logDates.filter((d) => d >= weekStart && d <= weekEnd);

            return {
                ...habit,
                isCompletedToday,
                streak,
                weeklyProgress: {
                    current: weekLogs.length,
                    target: habit.cadenceTarget ?? 0,
                },
            };
        })
    );
    return habitsWithStatus;
}

export async function getHabitStreak(habitId: number, today: string): Promise<number> {
    const habitRow = await db.select().from(habits).where(eq(habits.id, habitId)).limit(1);
    if (!habitRow.length) return 0;

    const logs = await db
        .select({ date: habitLogs.date})
        .from(habitLogs)
        .where(eq(habitLogs.habitId, habitId));

    return calculateHabitStreak(habitRow[0], logs.map((l) => l.date), today);
}

export async function updateHabit(
    id: number,
    data: Partial<{ title: string; cadenceType: 'daily' | 'weekly_n_times'; cadenceTarget: number | null}>
) {
    const [updated] = await db.update(habits).set(data).where(eq(habits.id, id)).returning();
    return updated;
}

export async function deleteHabit(id: number) {
    const [deleted] = await db.delete(habits).where(eq(habits.id, id)).returning();
    return deleted;
}

