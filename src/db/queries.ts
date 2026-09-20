import { calculateHabitStreak } from '@/engine/streaks';
import { addDays, differenceInCalendarDays, differenceInCalendarWeeks, endOfMonth, endOfWeek, endOfYear, format, parseISO, startOfMonth, startOfWeek, startOfYear } from 'date-fns';
import type { InferInsertModel } from 'drizzle-orm';
import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, sql } from 'drizzle-orm';
import { db } from './client';
import {
  activities,
  activityLogs,
  activityLogTags,
  activityTags,
  events,
  eventTags,
  habitLogs,
  habits,
  habitTags,
  notes,
  progressLogs,
  pursuits,
  tags,
  tasks,
  taskTags
} from './schema';

export type TaskRow = typeof tasks.$inferSelect;
export type NewTask = InferInsertModel<typeof tasks>;
export type UpdateTask = Partial<NewTask>;
export type NewProgressLog = InferInsertModel<typeof progressLogs>;
export type ActivityRow = typeof activities.$inferSelect;
export type ActivityLogRow = typeof activityLogs.$inferSelect;
export type EventRow = typeof events.$inferSelect;

export interface ProjectedOccurrence {
  goalId: number;
  goalTitle: string;
  type: 'Simple' | 'Progression' | 'Hybrid';
  priority: 'Low' | 'Medium' | 'High';
  date: string;
  totalProgress?: number | null;
  progressUnit?: string | null;
}

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
  const currentDone = await getEffectiveProgress(weeklyTask.id); // was getCurrentProgress — wrong once children exist
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
      deadline: targetDate,
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

// db/queries.ts

export async function applyRolloverSnapshots(
  actions: Array<{ sourceId: number; newCard: any }>
): Promise<void> {
  for (const action of actions) {
    // 1. Disable rollover on the past snapshot so it stays fixed on its original date
    await db
      .update(tasks)
      .set({ rolloverEnabled: false })
      .where(eq(tasks.id, action.sourceId));

    // 2. Insert the new active instance for today and get its generated ID back
    const [insertedNewCard] = await db
      .insert(tasks)
      .values(action.newCard)
      .returning();

    // 3. If it's a Hybrid task, copy over its uncompleted subtasks to the new instance
    if (insertedNewCard && action.newCard.type === 'Hybrid') {
      const existingSubtasks = await getSubtasksByParent(action.sourceId);
      for (const sub of existingSubtasks) {
        if (!sub.isCompleted) {
          await insertSubtask(insertedNewCard.id, {
            title: sub.title,
            type: sub.type,
            priority: sub.priority,
            scheduledDate: action.newCard.scheduledDate,
            isCompleted: false,
          });
        }
      }
    }
  }
}

export type ActivityLogWithDetails = ActivityLogRow & {
  activityTitle: string;
  tagIds: number[]; // union of category tags + this entry's own tags
};

async function attachTagsToLogs(
  rows: (ActivityLogRow & { activityTitle: string })[]
): Promise<ActivityLogWithDetails[]> {
  return Promise.all(
    rows.map(async (row) => {
      const [masterTags, logTags] = await Promise.all([
        db.select({ tagId: activityTags.tagId }).from(activityTags).where(eq(activityTags.activityId, row.activityId)),
        db.select({ tagId: activityLogTags.tagId }).from(activityLogTags).where(eq(activityLogTags.logId, row.id)),
      ]);
      const tagIds = Array.from(new Set([...masterTags.map((t) => t.tagId), ...logTags.map((t) => t.tagId)]));
      return { ...row, tagIds };
    })
  );
}

export async function getActivityLogsForDate(date: string): Promise<ActivityLogWithDetails[]> {
  const rows = await db
    .select({
      id: activityLogs.id,
      activityId: activityLogs.activityId,
      date: activityLogs.date,
      note: activityLogs.note,
      createdAt: activityLogs.createdAt,
      activityTitle: activities.title,
    })
    .from(activityLogs)
    .innerJoin(activities, eq(activityLogs.activityId, activities.id))
    .where(eq(activityLogs.date, date))
    .orderBy(desc(activityLogs.createdAt));

  return attachTagsToLogs(rows);
}

export async function getActivityLogsForDateRange(
  startDate: string,
  endDate: string
): Promise<ActivityLogWithDetails[]> {
  const rows = await db
    .select({
      id: activityLogs.id,
      activityId: activityLogs.activityId,
      date: activityLogs.date,
      note: activityLogs.note,
      createdAt: activityLogs.createdAt,
      activityTitle: activities.title,
    })
    .from(activityLogs)
    .innerJoin(activities, eq(activityLogs.activityId, activities.id))
    .where(and(gte(activityLogs.date, startDate), lte(activityLogs.date, endDate)))
    .orderBy(activityLogs.date, desc(activityLogs.createdAt));

  return attachTagsToLogs(rows);
}

export async function searchActivityLogs(params: {
  text?: string;
  tagIds?: number[];
}): Promise<ActivityLogWithDetails[]> {
  const rows = await db
    .select({
      id: activityLogs.id,
      activityId: activityLogs.activityId,
      date: activityLogs.date,
      note: activityLogs.note,
      createdAt: activityLogs.createdAt,
      activityTitle: activities.title,
    })
    .from(activityLogs)
    .innerJoin(activities, eq(activityLogs.activityId, activities.id))
    .orderBy(desc(activityLogs.date), desc(activityLogs.createdAt));

  const withTags = await attachTagsToLogs(rows);
  const q = params.text?.trim().toLowerCase();
  const tagIds = params.tagIds ?? [];

  return withTags.filter((row) => {
    const matchesText =
      !q || row.activityTitle.toLowerCase().includes(q) || (row.note ?? '').toLowerCase().includes(q);
    const matchesTags = tagIds.length === 0 || tagIds.some((t) => row.tagIds.includes(t));
    return matchesText && matchesTags;
  });
}

export async function findActivityByTitle(title: string): Promise<ActivityRow | null> {
  const [row] = await db
    .select()
    .from(activities)
    .where(sql`lower(${activities.title}) = lower(${title})`)
    .limit(1);
  return row ?? null;
}

export async function getAllActivityMasters(): Promise<ActivityRow[]> {
  return db.select().from(activities).orderBy(activities.title);
}

export async function deleteActivityLog(id: number) {
  const [deleted] = await db.delete(activityLogs).where(eq(activityLogs.id, id)).returning();
  return deleted;
}

export async function assignTagToActivityLog(logId: number, tagId: number) {
  return db.insert(activityLogTags).values({ logId, tagId }).onConflictDoNothing().returning();
}

export async function removeTagFromActivityLog(logId: number, tagId: number) {
  return db
    .delete(activityLogTags)
    .where(and(eq(activityLogTags.logId, logId), eq(activityLogTags.tagId, tagId)))
    .returning();
}

export async function getTagsForActivityLog(logId: number) {
  return db
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(activityLogTags)
    .innerJoin(tags, eq(activityLogTags.tagId, tags.id))
    .where(eq(activityLogTags.logId, logId));
}

export async function updateActivityLogNote(id: number, note: string | null) {
  const [updated] = await db
    .update(activityLogs)
    .set({ note })
    .where(eq(activityLogs.id, id))
    .returning();
  return updated;
}

export async function createActivityEntryWithTags(params: {
  title: string;
  note?: string | null;
  date?: string;
  masterTagIds?: number[];
  extraTagIds?: number[];
}): Promise<ActivityLogWithDetails> {
  const logDate = params.date ?? new Date().toISOString().split('T')[0];

  return db.transaction(async (tx) => {
    let [master] = await tx
      .select()
      .from(activities)
      .where(sql`lower(${activities.title}) = lower(${params.title.trim()})`)
      .limit(1);

    if (!master) {
      [master] = await tx
        .insert(activities)
        .values({ title: params.title.trim() })
        .returning();

      for (const tagId of params.masterTagIds ?? []) {
        await tx.insert(activityTags).values({ activityId: master.id, tagId }).onConflictDoNothing();
      }
    }

    const [insertedLog] = await tx
      .insert(activityLogs)
      .values({
        activityId: master.id,
        date: logDate,
        note: params.note ?? null,
      })
      .returning();

    for (const tagId of params.extraTagIds ?? []) {
      await tx.insert(activityLogTags).values({ logId: insertedLog.id, tagId }).onConflictDoNothing();
    }

    const [row] = await tx
      .select({
        id: activityLogs.id,
        activityId: activityLogs.activityId,
        date: activityLogs.date,
        note: activityLogs.note,
        createdAt: activityLogs.createdAt,
        activityTitle: activities.title,
      })
      .from(activityLogs)
      .innerJoin(activities, eq(activityLogs.activityId, activities.id))
      .where(eq(activityLogs.id, insertedLog.id));

    const [masterTags, logTags] = await Promise.all([
      tx.select({ tagId: activityTags.tagId }).from(activityTags).where(eq(activityTags.activityId, row.activityId)),
      tx.select({ tagId: activityLogTags.tagId }).from(activityLogTags).where(eq(activityLogTags.logId, row.id)),
    ]);

    const tagIds = Array.from(new Set([...masterTags.map((t) => t.tagId), ...logTags.map((t) => t.tagId)]));

    return { ...row, tagIds };
  });
}

export async function getMonthlyTasks(monthStartDate: string, monthEndDate: string): Promise<TaskRow[]> {
  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.scope, 'monthly'),
        isNull(tasks.parentId),
        gte(tasks.scheduledDate, monthStartDate),
        lte(tasks.scheduledDate, monthEndDate)
      )
    )
    .orderBy(tasks.id);
}

export async function decomposeMonthlyProgressionToWeekly(
  monthlyTask: TaskRow,
  weekStartDate: string,
  weeksRemaining: number
): Promise<TaskRow> {
  const currentDone = await getEffectiveProgress(monthlyTask.id); // was missing entirely
  const totalNeeded = monthlyTask.totalProgress ?? 0;
  const remainingTarget = Math.max(0, totalNeeded - currentDone);
  const weeklyTarget = Math.ceil(remainingTarget / Math.max(1, weeksRemaining));

  const [existingWeekly] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.sourceTaskId, monthlyTask.id), eq(tasks.scheduledDate, weekStartDate), eq(tasks.scope, 'weekly')));

  if (existingWeekly) {
    const [updated] = await db.update(tasks).set({ totalProgress: weeklyTarget }).where(eq(tasks.id, existingWeekly.id)).returning();
    return updated;
  }

  const [created] = await db
    .insert(tasks)
    .values({
      title: `${monthlyTask.title} (Weekly)`,
      type: 'Progression',
      priority: monthlyTask.priority,
      scheduledDate: weekStartDate,
      scope: 'weekly',
      sourceTaskId: monthlyTask.id,
      totalProgress: weeklyTarget,
      progressUnit: monthlyTask.progressUnit,
      deadline: format(endOfWeek(parseISO(weekStartDate), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      rolloverEnabled: false,
    })
    .returning();
  return created;
}

// NEW: children of a decomposed goal
export async function getChildTasks(taskId: number): Promise<TaskRow[]> {
  return db.select().from(tasks).where(eq(tasks.sourceTaskId, taskId));
}

// NEW: a parent goal's real progress is the sum of its descendants' progress,
// not its own (empty) progress_logs row. Leaf tasks fall back to the direct sum.
export async function getEffectiveProgress(taskId: number): Promise<number> {
  const children = await getChildTasks(taskId);
  if (children.length === 0) {
    return getCurrentProgress(taskId);
  }
  const childTotals = await Promise.all(children.map((c) => getEffectiveProgress(c.id)));
  return childTotals.reduce((sum, v) => sum + v, 0);
}

export async function dedupeDuplicateOccurrences(): Promise<void> {
  const all = await db
    .select()
    .from(tasks)
    .where(isNotNull(tasks.sourceTaskId));

  const seen = new Map<string, TaskRow>();

  for (const t of all) {
    const key = `${t.sourceTaskId}:${t.scheduledDate}`;
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, t);
      continue;
    }

    // Keep whichever is completed; if neither or both, keep the lower id
    const keep = existing.isCompleted
      ? existing
      : t.isCompleted
      ? t
      : existing.id < t.id
      ? existing
      : t;

    const drop = keep === existing ? t : existing;
    await deleteTask(drop.id);
    seen.set(key, keep);
  }
}

let decompositionInFlight: Promise<void> | null = null;

export async function ensureDailyDecompositionForDate(dateStr: string): Promise<void> {
  if (decompositionInFlight) return decompositionInFlight;

  decompositionInFlight = (async () => {
    const dayDate = parseISO(dateStr);
    const weekStart = format(startOfWeek(dayDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(dayDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const monthStart = format(startOfMonth(dayDate), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(dayDate), 'yyyy-MM-dd');
    const yearStart = format(startOfYear(dayDate), 'yyyy-MM-dd');
    const yearEnd = format(endOfYear(dayDate), 'yyyy-MM-dd');

    const yearlyGoals = await getYearlyTasks(yearStart, yearEnd);
    for (const yearly of yearlyGoals) {
      if (yearly.type === 'Progression') {
        if (yearly.occurrenceTarget) {
          await decomposeProgressionCountGoal(yearly, dateStr, yearEnd);
        } else {
          const monthsRemaining = 12 - dayDate.getMonth();
          await decomposeYearlyProgressionToMonthly(yearly, monthStart, monthsRemaining);
        }
      } else if (yearly.type === 'Simple' && yearly.occurrenceTarget) {
        await decomposeCountGoalToNextOccurrence(yearly, dateStr, yearEnd);
      } else if (yearly.type === 'Hybrid') {
        await decomposeHybridGoal(yearly, dateStr, yearEnd);
      }
      
    }

    const monthlyGoals = await getMonthlyTasks(monthStart, monthEnd);
    for (const monthly of monthlyGoals) {
      if (monthly.type === 'Progression') {
        if (monthly.occurrenceTarget) {
          await decomposeProgressionCountGoal(monthly, dateStr, monthEnd);
        } else {
          const weeksRemaining = differenceInCalendarWeeks(parseISO(monthEnd), dayDate, { weekStartsOn: 1 }) + 1;
          await decomposeMonthlyProgressionToWeekly(monthly, weekStart, weeksRemaining);
        }
      } else if (monthly.type === 'Simple' && monthly.occurrenceTarget) {
        await decomposeCountGoalToNextOccurrence(monthly, dateStr, monthEnd);
      } else if (monthly.type === 'Hybrid') {
        await decomposeHybridGoal(monthly, dateStr, monthEnd);
      }
    }

    const weeklyGoals = await getWeeklyTasks(weekStart, weekEnd);
    for (const weekly of weeklyGoals) {
      if (weekly.type === 'Progression') {
        if (weekly.occurrenceTarget) {
          await decomposeProgressionCountGoal(weekly, dateStr, weekEnd);
        } else {
        const daysRemaining = differenceInCalendarDays(parseISO(weekEnd), dayDate) + 1;
        await decomposeWeeklyProgressionToDaily(weekly, dateStr, daysRemaining);
        }
      } else if (weekly.type === 'Simple' && weekly.occurrenceTarget) {
        await decomposeCountGoalToNextOccurrence(weekly, dateStr, weekEnd);
      } else if (weekly.type === 'Hybrid') {
        await decomposeHybridGoal(weekly, dateStr, weekEnd);
      }
    }

    const customGoals = await getActiveCustomGoals(dateStr);
    for (const custom of customGoals) {
      const periodEnd = custom.deadline ?? dateStr;
      if (custom.type === 'Progression') {
        if (custom.occurrenceTarget) {
          await decomposeProgressionCountGoal(custom, dateStr, periodEnd);
        } else {
          const daysRemaining = differenceInCalendarDays(parseISO(periodEnd), dayDate) + 1;
          await decomposeWeeklyProgressionToDaily(custom, dateStr, daysRemaining);
        }
      } else if (custom.type === 'Simple' && custom.occurrenceTarget) {
        await decomposeCountGoalToNextOccurrence(custom, dateStr, periodEnd);
      } else if (custom.type === 'Hybrid') {
        await decomposeHybridGoal(custom, dateStr, periodEnd);
      }
    }

    // Run dedupe at the end of every decomposition cycle
    await dedupeDuplicateOccurrences();
  })();

  try {
    await decompositionInFlight;
  } finally {
    decompositionInFlight = null;
  }
}

export async function setAbsoluteProgress(taskId: number, targetValue: number): Promise<void> {
  const current = await getCurrentProgress(taskId);
  const delta = targetValue - current;
  if (delta !== 0) {
    await insertProgressLog({ taskId, amount: delta });
  }
  // Keep the task row's currentProgress column synced with the logs:
  await db
    .update(tasks)
    .set({ currentProgress: targetValue, updatedAt: sql`(CURRENT_TIMESTAMP)` })
    .where(eq(tasks.id, taskId));
}

export async function deleteTaskCascade(id: number): Promise<void> {
  const children = await getChildTasks(id);
  for (const child of children) {
    await deleteTaskCascade(child.id);
  }
  await deleteTask(id);
}

export async function getCompletedOccurrenceCount(goalId: number): Promise<number> {
  const result = await db.get<{ total: number }>(
    sql`SELECT COUNT(*) as total FROM tasks WHERE source_task_id = ${goalId} AND is_completed = 1`
  );
  return result?.total ?? 0;
}

export async function decomposeCountGoalToNextOccurrence(
  parentTask: TaskRow,
  todayStr: string,
  periodEndStr: string
): Promise<TaskRow | null> {
  const target = parentTask.occurrenceTarget ?? 0;
  if (target <= 0) return null;

  const completedCount = await getCompletedOccurrenceCount(parentTask.id);
  const remaining = target - completedCount;
  if (remaining <= 0) return null;

  const children = await getChildTasks(parentTask.id);

  // If there's an uncompleted occurrence for today or the future, don't schedule another
  const pending = children.find((c) => !c.isCompleted && c.scheduledDate >= todayStr);
  if (pending) return pending;

  const daysLeft = Math.max(1, differenceInCalendarDays(parseISO(periodEndStr), parseISO(todayStr)) + 1);
  const idealSpacing = Math.floor(daysLeft / remaining);
  const cappedSpacing = Math.max(1, Math.min(parentTask.maxGapDays ?? idealSpacing, idealSpacing || 1));

  const mostRecent = children.length > 0
    ? children.reduce((latest, c) => (c.scheduledDate > latest.scheduledDate ? c : latest))
    : null;

  let nextDateStr: string;
  if (!mostRecent) {
    nextDateStr = todayStr;
  } else {
    const candidate = format(addDays(parseISO(mostRecent.scheduledDate), cappedSpacing), 'yyyy-MM-dd');
    nextDateStr = candidate < todayStr ? todayStr : candidate;
  }

  if (nextDateStr > periodEndStr) return null;

  const [created] = await db
    .insert(tasks)
    .values({
      title: parentTask.title,
      type: 'Simple',
      priority: parentTask.priority,
      scheduledDate: nextDateStr,
      scope: 'daily',
      sourceTaskId: parentTask.id,
      rolloverEnabled: false,
    })
    .returning();

  return created;
}


export async function previewOccurrenceSchedule(
  parentTask: TaskRow,
  fromDateStr: string,
  periodEndStr: string
): Promise<ProjectedOccurrence[]> {
  const target = parentTask.occurrenceTarget ?? 0;
  if (target <= 0) return [];

  const completedCount = await getCompletedOccurrenceCount(parentTask.id);
  const remaining = target - completedCount;
  if (remaining <= 0) return [];

  const children = await getChildTasks(parentTask.id);
  const existingDates = new Set(children.map((c) => c.scheduledDate));

  const existingPendingFuture = children.filter(
    (c) => !c.isCompleted && c.scheduledDate >= fromDateStr
  );

  let unspawnedNeeded = remaining - existingPendingFuture.length;
  if (unspawnedNeeded <= 0) return [];

  const daysLeft = Math.max(1, differenceInCalendarDays(parseISO(periodEndStr), parseISO(fromDateStr)) + 1);
  const idealSpacing = Math.floor(daysLeft / remaining);
  const spacing = Math.max(1, Math.min(parentTask.maxGapDays ?? idealSpacing, idealSpacing || 1));

  const latestDate = children.length > 0
    ? children.reduce((latest, c) => (c.scheduledDate > latest.scheduledDate ? c : latest)).scheduledDate
    : null;

  const projections: ProjectedOccurrence[] = [];
  let cursor = latestDate && latestDate >= fromDateStr 
    ? parseISO(latestDate) 
    : parseISO(fromDateStr);

  while (unspawnedNeeded > 0) {
    cursor = addDays(cursor, spacing);
    const candidateStr = format(cursor, 'yyyy-MM-dd');
    if (candidateStr > periodEndStr) break;

    if (!existingDates.has(candidateStr) && candidateStr >= fromDateStr) {
      projections.push({
        goalId: parentTask.id,
        goalTitle: parentTask.title,
        type: parentTask.type as any,
        priority: parentTask.priority as any,
        date: candidateStr,
        totalProgress: parentTask.totalProgress,
        progressUnit: parentTask.progressUnit,
      });
      unspawnedNeeded--;
    }
  }

  return projections;
}

export async function getYearlyTasks(yearStartDate: string, yearEndDate: string): Promise<TaskRow[]> {
  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.scope, 'yearly'),
        isNull(tasks.parentId),
        gte(tasks.scheduledDate, yearStartDate),
        lte(tasks.scheduledDate, yearEndDate)
      )
    )
    .orderBy(tasks.id);
}

export async function decomposeYearlyProgressionToMonthly(
  yearlyTask: TaskRow,
  monthStartDate: string,
  monthsRemaining: number
): Promise<TaskRow> {
  const currentDone = await getEffectiveProgress(yearlyTask.id);
  const totalNeeded = yearlyTask.totalProgress ?? 0;
  const remainingTarget = Math.max(0, totalNeeded - currentDone);
  const monthlyTarget = Math.ceil(remainingTarget / Math.max(1, monthsRemaining));

  const [existingMonthly] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.sourceTaskId, yearlyTask.id), eq(tasks.scheduledDate, monthStartDate), eq(tasks.scope, 'monthly')));

  if (existingMonthly) {
    const [updated] = await db.update(tasks).set({ totalProgress: monthlyTarget }).where(eq(tasks.id, existingMonthly.id)).returning();
    return updated;
  }

  const [created] = await db
    .insert(tasks)
    .values({
      title: `${yearlyTask.title} (Monthly)`,
      type: 'Progression',
      priority: yearlyTask.priority,
      scheduledDate: monthStartDate,
      scope: 'monthly',
      sourceTaskId: yearlyTask.id,
      totalProgress: monthlyTarget,
      progressUnit: yearlyTask.progressUnit,
      deadline: format(endOfMonth(parseISO(monthStartDate)), 'yyyy-MM-dd'),
      rolloverEnabled: false,
    })
    .returning();
  return created;
}

export async function getNotesByScope(scope: 'daily' | 'weekly' | 'monthly' | 'yearly') {
  return db.select().from(notes).where(eq(notes.scope, scope)).orderBy(desc(notes.dateKey));
}

export type NoteSummary = typeof notes.$inferSelect;

export async function getAllNotesSummaries(): Promise<NoteSummary[]> {
  return db.select().from(notes).orderBy(desc(notes.dateKey), desc(notes.updatedAt));
}

export async function getNotesForScope(
  scope: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom',
  dateKey: string
) {
  return db
    .select()
    .from(notes)
    .where(and(eq(notes.scope, scope), eq(notes.dateKey, dateKey)))
    .orderBy(desc(notes.createdAt));
}

export async function createNote(
  scope: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom',
  dateKey: string,
  content: string = '',
  title?: string
) {
  const [created] = await db
    .insert(notes)
    .values({ scope, dateKey, content })
    .returning();
  return created;
}

export async function updateNoteContent(id: number, content: string) {
  const [updated] = await db
    .update(notes)
    .set({ content, updatedAt: sql`(CURRENT_TIMESTAMP)` })
    .where(eq(notes.id, id))
    .returning();
  return updated;
}

export async function deleteNote(id: number) {
  const [deleted] = await db.delete(notes).where(eq(notes.id, id)).returning();
  return deleted;
}

export async function getProgressLoggedForDate(dateStr: string): Promise<number> {
  const result = await db.get<{ total: number | null }>(
    sql`SELECT SUM(amount) as total FROM progress_logs WHERE date(logged_at) = ${dateStr}`
  );
  return result?.total ?? 0;
}

export async function getAllDescendantTasks(parentId: number): Promise<TaskRow[]> {
  const direct = await getChildTasks(parentId);
  let all: TaskRow[] = [...direct];
  for (const child of direct) {
    all = all.concat(await getAllDescendantTasks(child.id));
  }
  return all;
}

export type PursuitRow = typeof pursuits.$inferSelect;

export async function insertPursuit(data: { title: string; status?: PursuitRow['status']; description?: string | null }) {
  const [inserted] = await db.insert(pursuits).values(data).returning();
  return inserted;
}

export async function getAllPursuits(): Promise<PursuitRow[]> {
  return db.select().from(pursuits).orderBy(desc(pursuits.updatedAt));
}

export async function updatePursuit(id: number, data: Partial<{ title: string; status: PursuitRow['status']; description: string | null }>) {
  const [updated] = await db.update(pursuits).set({ ...data, updatedAt: sql`(CURRENT_TIMESTAMP)` }).where(eq(pursuits.id, id)).returning();
  return updated;
}

export async function deletePursuit(id: number) {
  const [deleted] = await db.delete(pursuits).where(eq(pursuits.id, id)).returning();
  return deleted;
}

export async function getTasksByPursuit(pursuitId: number): Promise<TaskRow[]> {
  return db.select().from(tasks).where(eq(tasks.pursuitId, pursuitId)).orderBy(desc(tasks.scheduledDate));
}

export async function setTaskPursuit(taskId: number, pursuitId: number | null) {
  return updateTask(taskId, { pursuitId });
}

export async function getSubtaskCountsForTaskIds(
  parentIds: number[]
): Promise<Record<number, { completed: number; total: number }>> {
  if (parentIds.length === 0) return {};
  const rows = await db.select().from(tasks).where(inArray(tasks.parentId, parentIds));
  const map: Record<number, { completed: number; total: number }> = {};
  for (const row of rows) {
    if (row.parentId == null) continue;
    if (!map[row.parentId]) map[row.parentId] = { completed: 0, total: 0 };
    map[row.parentId].total += 1;
    if (row.isCompleted) map[row.parentId].completed += 1;
  }
  return map;
}

export async function decomposeProgressionCountGoal(
  parentTask: TaskRow,
  todayStr: string,
  periodEndStr: string
): Promise<TaskRow | null> {
  const occurrenceTarget = parentTask.occurrenceTarget ?? 0;
  const totalQuantity = parentTask.totalProgress ?? 0;
  if (occurrenceTarget <= 0 || totalQuantity <= 0) return null;

  const completedCount = await getCompletedOccurrenceCount(parentTask.id);
  const remainingOccurrences = occurrenceTarget - completedCount;
  if (remainingOccurrences <= 0) return null;

  const children = await getChildTasks(parentTask.id);
  const pending = children.find((c) => !c.isCompleted && c.scheduledDate >= todayStr);
  if (pending) return pending;

  const quantityDoneSoFar = await getEffectiveProgress(parentTask.id);
  const remainingQuantity = Math.max(0, totalQuantity - quantityDoneSoFar);
  const perOccurrenceQuantity = Math.ceil(remainingQuantity / remainingOccurrences);

  const daysLeft = Math.max(1, differenceInCalendarDays(parseISO(periodEndStr), parseISO(todayStr)) + 1);
  const idealSpacing = Math.floor(daysLeft / remainingOccurrences);
  const cappedSpacing = Math.max(1, Math.min(parentTask.maxGapDays ?? idealSpacing, idealSpacing || 1));

  const mostRecent = children.length > 0
    ? children.reduce((latest, c) => (c.scheduledDate > latest.scheduledDate ? c : latest))
    : null;

  // First-occurrence placement is deliberately isolated here — a future
  // smarter/random placement only needs to replace this one branch.
  let nextDateStr: string;
  if (!mostRecent) {
    nextDateStr = todayStr;
  } else {
    const candidate = format(addDays(parseISO(mostRecent.scheduledDate), cappedSpacing), 'yyyy-MM-dd');
    nextDateStr = candidate < todayStr ? todayStr : candidate;
  }
  if (nextDateStr > periodEndStr) return null;

  const [created] = await db
    .insert(tasks)
    .values({
      title: parentTask.title,
      type: 'Progression',
      priority: parentTask.priority,
      scheduledDate: nextDateStr,
      deadline: nextDateStr,
      scope: 'daily',
      sourceTaskId: parentTask.id,
      totalProgress: perOccurrenceQuantity,
      progressUnit: parentTask.progressUnit,
      rolloverEnabled: false,
    })
    .returning();

  return created;
}


export async function revertToPreviousProgress(taskId: number): Promise<number> {
  // 1. Grab the single latest log entry (the one that pushed it to completion)
  const [latestLog] = await db
    .select()
    .from(progressLogs)
    .where(eq(progressLogs.taskId, taskId))
    .orderBy(desc(progressLogs.id))
    .limit(1);

  // 2. Delete that log entry
  if (latestLog) {
    await db.delete(progressLogs).where(eq(progressLogs.id, latestLog.id));
  }

  // 3. Get the real accumulated total after deleting the completion log
  const [result] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${progressLogs.amount}), 0)`,
    })
    .from(progressLogs)
    .where(eq(progressLogs.taskId, taskId));

  const restoredProgress = Math.max(0, Number(result?.total ?? 0));

  // 4. Update the task row directly so getSubtasksByParent stays in sync
  await db
    .update(tasks)
    .set({ currentProgress: restoredProgress, updatedAt: sql`(CURRENT_TIMESTAMP)` })
    .where(eq(tasks.id, taskId));

  return restoredProgress;
}

export async function getTaskById(id: number): Promise<TaskRow | null> {
  const [row] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return row ?? null;
}

export async function getSubtasksByParentOrdered(parentId: number): Promise<TaskRow[]> {
  return db.select().from(tasks).where(eq(tasks.parentId, parentId)).orderBy(tasks.subtaskOrder, tasks.id);
}


// in src/db/queries.ts

export async function decomposeHybridGoal(
  goal: TaskRow,
  todayStr: string,
  periodEndStr: string
): Promise<TaskRow | null> {
  if (todayStr > periodEndStr) return null;

  // 1. If goal has an occurrence schedule, check if an occurrence is due today
  if (goal.occurrenceTarget) {
    const existingProxy = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.sourceTaskId, goal.id),
          eq(tasks.scheduledDate, todayStr),
          eq(tasks.scope, 'daily')
        )
      )
      .limit(1);

    if (existingProxy.length > 0) return existingProxy[0];

    // Check if max gap or schedule requires an occurrence today
    const childOccurrences = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.sourceTaskId, goal.id), eq(tasks.scope, 'daily')));

    const completedCount = childOccurrences.filter((c) => c.isCompleted).length;
    if (completedCount >= goal.occurrenceTarget) return null; // Target met

    const pending = childOccurrences.find((c) => !c.isCompleted && c.scheduledDate >= todayStr);
    if (pending) return pending; // Already pending on or after today

    // Spawn a daily portal to the master hybrid goal
    const [created] = await db
      .insert(tasks)
      .values({
        title: goal.title,
        type: 'Hybrid',
        priority: goal.priority,
        scheduledDate: todayStr,
        deadline: periodEndStr,
        scope: 'daily',
        sourceTaskId: goal.id,
        isSequential: goal.isSequential,
        rolloverEnabled: true,
      })
      .returning();

    return created;
  }

  // 2. Non-recurring sequential goals: Surface the single active milestone
  if (goal.isSequential) {
    const milestones = await getSubtasksByParentOrdered(goal.id);
    const current = milestones.find((m) => !m.isCompleted);
    if (!current) return null;

    const existingProxies = await getChildTasks(current.id);
    const pending = existingProxies.find((p) => !p.isCompleted && p.scheduledDate >= todayStr);
    if (pending) return pending;

    const [created] = await db
      .insert(tasks)
      .values({
        title: current.title,
        type: current.totalProgress != null ? 'Progression' : 'Simple',
        priority: goal.priority,
        scheduledDate: todayStr,
        deadline: current.totalProgress != null ? todayStr : null,
        scope: 'daily',
        sourceTaskId: current.id,
        totalProgress: current.totalProgress ?? null,
        progressUnit: current.progressUnit ?? null,
        rolloverEnabled: true,
      })
      .returning();

    return created;
  }

  return null;
}

export async function getActiveCustomGoals(dateStr: string): Promise<TaskRow[]> {
  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.scope, 'custom'),
        isNull(tasks.parentId),
        lte(tasks.scheduledDate, dateStr),
        gte(tasks.deadline, dateStr)
      )
    )
    .orderBy(tasks.id);
}

export async function getAllCustomGoals(): Promise<TaskRow[]> {
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.scope, 'custom'), isNull(tasks.parentId)))
    .orderBy(desc(tasks.scheduledDate));
}