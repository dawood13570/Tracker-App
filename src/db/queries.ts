import { calculateHabitStreak } from '@/engine/streaks';
import { endOfWeek, format, startOfWeek } from 'date-fns';
import type { InferInsertModel } from 'drizzle-orm';
import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, sql } from 'drizzle-orm';
import { db } from './client';
import {
    activities,
    activityLogs,
    activityTags,
    events,
    eventTags,
    habitLogs,
    habits,
    habitTags,
    progressLogs,
    tags,
    tasks,
    taskTags,
} from './schema';

export type TaskRow = typeof tasks.$inferSelect;
export type NewTask = InferInsertModel<typeof tasks>;
export type UpdateTask = Partial<NewTask>;
export type NewProgressLog = InferInsertModel<typeof progressLogs>;
export type ActivityRow = typeof activities.$inferSelect;
export type ActivityLogRow = typeof activityLogs.$inferSelect;
export type EventRow = typeof events.$inferSelect;

export async function getTaskByDate(date: string): Promise<TaskRow[]> {
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.scheduledDate, date), isNull(tasks.parentId), eq(tasks.scope, 'daily')));
}

export async function insertTask(data: NewTask): Promise<TaskRow> {
  const [inserted] = await db.insert(tasks).values(data).returning();
  return inserted;
}

export async function insertSubtask(parentId: number, data: Partial<NewTask>): Promise<TaskRow> {
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

export async function getSubtasksByParent(parentId: number): Promise<TaskRow[]> {
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.parentId, parentId))
    .orderBy(tasks.id);
}

export async function getSubtaskCounts(parentId: number): Promise<{ completed: number; total: number }> {
  const subtasksList = await getSubtasksByParent(parentId);
  const total = subtasksList.length;
  const completed = subtasksList.filter((s) => s.isCompleted).length;
  return { completed, total };
}

export async function toggleTaskStatus(id: number): Promise<TaskRow> {
  const [updated] = await db
    .update(tasks)
    .set({ isCompleted: sql`NOT ${tasks.isCompleted}` })
    .where(eq(tasks.id, id))
    .returning();
  return updated;
}

export async function getActiveProgressionTasks(): Promise<TaskRow[]> {
  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.isCompleted, false),
        eq(tasks.type, 'Progression'),
        isNotNull(tasks.deadline)
      )
    );
}

export async function updateTask(id: number, data: UpdateTask): Promise<TaskRow> {
  const [updated] = await db
    .update(tasks)
    .set(data)
    .where(eq(tasks.id, id))
    .returning();
  return updated;
}

export async function deleteTask(id: number): Promise<TaskRow> {
  const [deleted] = await db
    .delete(tasks)
    .where(eq(tasks.id, id))
    .returning();
  return deleted;
}

export async function getRolloverCandidates(todayStr: string): Promise<TaskRow[]> {
  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.isCompleted, false),
        eq(tasks.rolloverEnabled, true),
        lt(tasks.scheduledDate, todayStr),
        isNull(tasks.parentId),
        eq(tasks.scope, 'daily')
      )
    );
}

export async function applyRolloverMutations(
  mutations: Array<{ id: number; scheduledDate: string; procrastinationCount: number }>
): Promise<void> {
  for (const mutation of mutations) {
    await db
      .update(tasks)
      .set({
        scheduledDate: mutation.scheduledDate,
        procrastinationCount: mutation.procrastinationCount,
      })
      .where(eq(tasks.id, mutation.id));
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

// --- Weekly Scope & Decomposition Queries ---

export async function getWeeklyTasks(weekStartDate: string, weekEndDate: string): Promise<TaskRow[]> {
  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.scope, 'weekly'),
        isNull(tasks.parentId),
        gte(tasks.scheduledDate, weekStartDate),
        lte(tasks.scheduledDate, weekEndDate)
      )
    )
    .orderBy(tasks.id);
}

export async function getTasksForDateRange(startDate: string, endDate: string): Promise<TaskRow[]> {
  return db
    .select()
    .from(tasks)
    .where(
      and(
        gte(tasks.scheduledDate, startDate),
        lte(tasks.scheduledDate, endDate),
        isNull(tasks.parentId),
        eq(tasks.scope, 'daily')
      )
    )
    .orderBy(tasks.scheduledDate, tasks.id);
}

export async function getEventsForDateRange(startDate: string, endDate: string): Promise<EventRow[]> {
  return db
    .select()
    .from(events)
    .where(
      and(
        gte(events.startTime, `${startDate}T00:00:00`),
        lte(events.startTime, `${endDate}T23:59:59`)
      )
    )
    .orderBy(events.startTime);
}

export async function decomposeWeeklyProgressionToDaily(
  weeklyTask: TaskRow,
  targetDate: string,
  daysRemaining: number
): Promise<TaskRow> {
  const currentDone = await getCurrentProgress(weeklyTask.id);
  const totalNeeded = weeklyTask.totalProgress ?? 0;
  const remainingTarget = Math.max(0, totalNeeded - currentDone);
  const dailyTarget = Math.ceil(remainingTarget / Math.max(1, daysRemaining));

  const [existingDaily] = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.sourceTaskId, weeklyTask.id),
        eq(tasks.scheduledDate, targetDate)
      )
    );

  if (existingDaily) {
    const [updated] = await db
      .update(tasks)
      .set({ totalProgress: dailyTarget })
      .where(eq(tasks.id, existingDaily.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(tasks)
    .values({
      title: `${weeklyTask.title} (Daily)`,
      type: 'Progression',
      priority: weeklyTask.priority,
      scheduledDate: targetDate,
      scope: 'daily',
      sourceTaskId: weeklyTask.id,
      totalProgress: dailyTarget,
      progressUnit: weeklyTask.progressUnit,
      deadline: weeklyTask.deadline,
      rolloverEnabled: false,
    })
    .returning();

  return created;
}

// --- Habits ---

export async function insertHabit(data: {
  title: string;
  cadenceType: 'daily' | 'weekly_n_times';
  cadenceTarget?: number;
}) {
  return db.insert(habits).values(data).returning();
}

export async function logHabitCompletion(habitId: number, date: string) {
  return db
    .insert(habitLogs)
    .values({ habitId, date })
    .onConflictDoNothing()
    .returning();
}

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
    .select({ date: habitLogs.date })
    .from(habitLogs)
    .where(eq(habitLogs.habitId, habitId));

  return calculateHabitStreak(habitRow[0], logs.map((l) => l.date), today);
}

export async function updateHabit(
  id: number,
  data: Partial<{ title: string; cadenceType: 'daily' | 'weekly_n_times'; cadenceTarget: number | null }>
) {
  const [updated] = await db.update(habits).set(data).where(eq(habits.id, id)).returning();
  return updated;
}

export async function deleteHabit(id: number) {
  const [deleted] = await db.delete(habits).where(eq(habits.id, id)).returning();
  return deleted;
}

// --- Events ---

export async function insertEvent(data: {
  title: string;
  startTime: string;
  endTime?: string | null;
  location?: string | null;
}) {
  const [inserted] = await db.insert(events).values(data).returning();
  return inserted;
}

export async function getEventsByDate(date: string): Promise<EventRow[]> {
  return db
    .select()
    .from(events)
    .where(
      sql`${events.startTime} = ${date} OR ${events.startTime} LIKE ${date + '%'}`
    )
    .orderBy(events.startTime);
}

export async function updateEvent(
  id: number,
  data: Partial<{ title: string; startTime: string; endTime: string | null; location: string | null }>
) {
  const [updated] = await db.update(events).set(data).where(eq(events.id, id)).returning();
  return updated;
}

export async function deleteEvent(id: number) {
  const [deleted] = await db.delete(events).where(eq(events.id, id)).returning();
  return deleted;
}

// --- Tags & Relations ---

export async function createTag(data: { name: string; color?: string | null }) {
  const [inserted] = await db.insert(tags).values(data).returning();
  return inserted;
}

export async function getAllTags() {
  return db.select().from(tags).orderBy(tags.name);
}

export async function assignTag(taskId: number, tagId: number) {
  return db.insert(taskTags).values({ taskId, tagId }).onConflictDoNothing().returning();
}

export async function removeTag(taskId: number, tagId: number) {
  return db
    .delete(taskTags)
    .where(and(eq(taskTags.taskId, taskId), eq(taskTags.tagId, tagId)))
    .returning();
}

export async function getTagsForTask(taskId: number) {
  return db
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(taskTags)
    .innerJoin(tags, eq(taskTags.tagId, tags.id))
    .where(eq(taskTags.taskId, taskId));
}

export async function getTasksByTag(tagId: number) {
  const rows = await db.select({ taskId: taskTags.taskId }).from(taskTags).where(eq(taskTags.tagId, tagId));
  const taskIds = rows.map((r) => r.taskId);
  if (taskIds.length === 0) return [];
  return db.select().from(tasks).where(inArray(tasks.id, taskIds));
}

export async function renameTag(id: number, data: { name?: string; color?: string | null }) {
  const [updated] = await db.update(tags).set(data).where(eq(tags.id, id)).returning();
  return updated;
}

export async function deleteTag(id: number) {
  const [deleted] = await db.delete(tags).where(eq(tags.id, id)).returning();
  return deleted;
}

export async function getMostUsedTags(limit = 8) {
  return db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
      count: sql<number>`count(${taskTags.taskId})`.as('count'),
    })
    .from(tags)
    .leftJoin(taskTags, eq(taskTags.tagId, tags.id))
    .groupBy(tags.id)
    .orderBy(desc(sql`count(${taskTags.taskId})`))
    .limit(limit);
}

export async function assignTagToHabit(habitId: number, tagId: number) {
  return db.insert(habitTags).values({ habitId, tagId }).onConflictDoNothing().returning();
}

export async function removeTagFromHabit(habitId: number, tagId: number) {
  return db
    .delete(habitTags)
    .where(and(eq(habitTags.habitId, habitId), eq(habitTags.tagId, tagId)))
    .returning();
}

export async function getTagsForHabit(habitId: number) {
  return db
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(habitTags)
    .innerJoin(tags, eq(habitTags.tagId, tags.id))
    .where(eq(habitTags.habitId, habitId));
}

export async function assignTagToEvent(eventId: number, tagId: number) {
  return db.insert(eventTags).values({ eventId, tagId }).onConflictDoNothing().returning();
}

export async function removeTagFromEvent(eventId: number, tagId: number) {
  return db
    .delete(eventTags)
    .where(and(eq(eventTags.eventId, eventId), eq(eventTags.tagId, tagId)))
    .returning();
}

export async function getTagsForEvent(eventId: number) {
  return db
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(eventTags)
    .innerJoin(tags, eq(eventTags.tagId, tags.id))
    .where(eq(eventTags.eventId, eventId));
}

// --- Activities ---

export async function insertActivity(data: { title: string }) {
  const [inserted] = await db.insert(activities).values(data).returning();
  return inserted;
}

export async function getAllActivities(): Promise<ActivityRow[]> {
  return db.select().from(activities).orderBy(activities.title);
}

export async function deleteActivity(id: number) {
  const [deleted] = await db.delete(activities).where(eq(activities.id, id)).returning();
  return deleted;
}

export async function logActivity(data: { activityId: number; date: string; note?: string | null }) {
  const [inserted] = await db.insert(activityLogs).values(data).returning();
  return inserted;
}

export async function getLastActivityLog(activityId: number): Promise<ActivityLogRow | null> {
  const logs = await db
    .select()
    .from(activityLogs)
    .where(eq(activityLogs.activityId, activityId))
    .orderBy(desc(activityLogs.date), desc(activityLogs.createdAt))
    .limit(1);

  return logs[0] ?? null;
}

export async function getActivityLogs(activityId: number): Promise<ActivityLogRow[]> {
  return db
    .select()
    .from(activityLogs)
    .where(eq(activityLogs.activityId, activityId))
    .orderBy(desc(activityLogs.date), desc(activityLogs.createdAt));
}

export async function assignTagToActivity(activityId: number, tagId: number) {
  return db.insert(activityTags).values({ activityId, tagId }).onConflictDoNothing().returning();
}

export async function removeTagFromActivity(activityId: number, tagId: number) {
  return db
    .delete(activityTags)
    .where(and(eq(activityTags.activityId, activityId), eq(activityTags.tagId, tagId)))
    .returning();
}

export async function getTagsForActivity(activityId: number) {
  return db
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(activityTags)
    .innerJoin(tags, eq(activityTags.tagId, tags.id))
    .where(eq(activityTags.activityId, activityId));
}

export async function getAllTagAssociations() {
  const [taskT, habitT, eventT, activityT] = await Promise.all([
    db.select().from(taskTags),
    db.select().from(habitTags),
    db.select().from(eventTags),
    db.select().from(activityTags),
  ]);

  const taskMap: Record<number, number[]> = {};
  for (const row of taskT) {
    if (!taskMap[row.taskId]) taskMap[row.taskId] = [];
    taskMap[row.taskId].push(row.tagId);
  }

  const habitMap: Record<number, number[]> = {};
  for (const row of habitT) {
    if (!habitMap[row.habitId]) habitMap[row.habitId] = [];
    habitMap[row.habitId].push(row.tagId);
  }

  const eventMap: Record<number, number[]> = {};
  for (const row of eventT) {
    if (!eventMap[row.eventId]) eventMap[row.eventId] = [];
    eventMap[row.eventId].push(row.tagId);
  }

  const activityMap: Record<number, number[]> = {};
  for (const row of activityT) {
    if (!activityMap[row.activityId]) activityMap[row.activityId] = [];
    activityMap[row.activityId].push(row.tagId);
  }

  return {
    tasks: taskMap,
    habits: habitMap,
    events: eventMap,
    activities: activityMap,
  };
}

export async function applyRolloverSnapshots(
  actions: Array<{ sourceId: number; newCard: any }>
): Promise<void> {
  for (const action of actions) {
    // 1. Disable rollover on the past snapshot so it stays fixed on its original date
    await db
      .update(tasks)
      .set({ rolloverEnabled: false })
      .where(eq(tasks.id, action.sourceId));

    // 2. Insert the new active instance for today
    await db.insert(tasks).values(action.newCard);
  }
}