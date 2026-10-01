import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  type: text('type', { enum: ['Simple', 'Hybrid', 'Progression'] }).notNull(),
  priority: text('priority', { enum: ['Low', 'Medium', 'High'] }).notNull(),
  isCompleted: integer('is_completed', { mode: 'boolean' }).default(false).notNull(),
  scheduledDate: text('scheduled_date').notNull(),
  nextOccurrenceGenerated: integer('next_occurrence_generated', { mode: 'boolean' }).notNull().default(false),
  pursuitId: integer('pursuit_id').references((): any => pursuits.id, { onDelete: 'set null' }),

  seriesId: text('series_id'),
  occurrenceDate: text('occurrence_date'),
  rolloverFromId: integer('rollover_from_id'),
  completedAt: text('completed_at'),
  skippedAt: text('skipped_at'),
  completedDate: text('completed_date'),
  completionPreviousProgress: integer('completion_previous_progress'),
  pausedUntil: text('paused_until'),
  nominalDailyTarget: integer('nominal_daily_target'),
  planSummary: integer('plan_summary', { mode: 'boolean' }).notNull().default(false),
  bankCovered: integer('bank_covered').notNull().default(0),

  // Scope & Decomposition
  scope: text('scope', { enum: ['daily', 'weekly', 'monthly', 'yearly', 'custom'] }).default('daily').notNull(),
  sourceTaskId: integer('source_task_id'),

  // Progression fields
  currentProgress: integer('current_progress').default(0),
  totalProgress: integer('total_progress').default(0),
  progressUnit: text('progress_unit'),
  deadline: text('deadline'),

  // Hybrid fields
  subtasksCompleted: integer('subtasks_completed').default(0),
  subtasksTotal: integer('subtasks_total').default(0),

  recurrenceType: text('recurrence_type').notNull().default('none'),
  recurrenceInterval: integer('recurrence_interval'),
  recurrenceDaysOfWeek: text('recurrence_days_of_week'),

  parentId: integer('parent_id').references((): any => tasks.id, { onDelete: 'cascade' }),

  // Gamification / Tracking fields
  procrastinationCount: integer('procrastination_count').default(0),
  rolloverEnabled: integer('rollover_enabled', { mode: 'boolean' }).notNull().default(true),

  maxGapDays: integer('max_gaps_days'),

  occurrenceTarget: integer('occurrence_target'),

  isSequential: integer('is_sequential', { mode: 'boolean' }).notNull().default(false), // goal-level flag
  subtaskOrder: integer('subtask_order'), // milestone-level ordering, set at creation

  surplusMode: text('surplus_mode', { enum: ['breathing_room', 'raise_bar', 'bank_it', 'none'] }),
  bufferDays: integer('buffer_days').default(0),

  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => ({
  occurrenceIdentity: uniqueIndex('task_series_occurrence_unique').on(table.seriesId, table.occurrenceDate).where(sql`${table.seriesId} IS NOT NULL AND ${table.occurrenceDate} IS NOT NULL`),
  scheduleScope: index('tasks_schedule_scope').on(table.scheduledDate, table.scope),
  source: index('tasks_source').on(table.sourceTaskId),
  parent: index('tasks_parent').on(table.parentId),
}));

export const progressLogs = sqliteTable('progress_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  appDate: text('app_date'),
  creditDate: text('credit_date'),
  kind: text('kind').notNull().default('progress'),
  loggedAt: text('logged_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  notes: text('notes'),
}, table => ({ task: index('progress_task').on(table.taskId) }));

export const goals = sqliteTable('goals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  targetDate: text('target_date'),
});

export const habits = sqliteTable('habits', {
  pursuitId: integer('pursuit_id').references((): any => pursuits.id, { onDelete: 'set null' }),
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  cadenceType: text('cadence_type', { enum: ['daily', 'weekly_n_times'] }).notNull(),
  cadenceTarget: integer('cadence_target'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const habitLogs = sqliteTable('habit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  habitId: integer('habit_id').notNull().references(() => habits.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => ({
  habitDateUnique: uniqueIndex('habit_logs_habit_id_date_unique').on(table.habitId, table.date),
}));

export const events = sqliteTable('events', {
  pursuitId: integer('pursuit_id').references((): any => pursuits.id, { onDelete: 'set null' }),
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time'),
  location: text('location'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const notes = sqliteTable('notes', {
  pursuitId: integer('pursuit_id').references((): any => pursuits.id, { onDelete: 'set null' }),
  id: integer('id').primaryKey({ autoIncrement: true }),
  scope: text('scope', { enum: ['daily', 'weekly', 'monthly', 'yearly', 'custom'] }).notNull(),
  dateKey: text('date_key').notNull(),
  title: text('title'),
  content: text('content'),
  isAutoGenerated: integer('is_auto_generated', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, table => ({ scopeDate: index('notes_scope_date').on(table.scope, table.dateKey) }));

export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  color: text('color'),
});

export const taskTags = sqliteTable('task_tags', {
  taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.taskId, table.tagId] }),
}));

export const habitTags = sqliteTable('habit_tags', {
  habitId: integer('habit_id').notNull().references(() => habits.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.habitId, table.tagId] }),
}));

export const eventTags = sqliteTable('event_tags', {
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.eventId, table.tagId] }),
}));

export const activities = sqliteTable('activities', {
  pursuitId: integer('pursuit_id').references((): any => pursuits.id, { onDelete: 'set null' }),
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const activityLogs = sqliteTable('activity_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  activityId: integer('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  note: text('note'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const activityTags = sqliteTable('activity_tags', {
  activityId: integer('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.activityId, table.tagId] }),
}));

export const activityLogTags = sqliteTable('activity_log_tags', {
  logId: integer('log_id').notNull().references(() => activityLogs.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.logId, table.tagId] }),
}));


export const pursuits = sqliteTable('pursuits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  status: text('status', { enum: ['plan_to_do', 'active', 'on_hold', 'dropped', 'completed'] }).notNull().default('plan_to_do'),
  description: text('description'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const taskHistory = sqliteTable('task_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  action: text('action').notNull(),
  appDate: text('app_date').notNull(),
  details: text('details'),
  createdAt: text('created_at').notNull(),
});

// Earned credits are recomputed from real daily work; rest-day receipts are never fabricated progress.
export const surplusCredits = sqliteTable('surplus_credits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerId: integer('owner_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  appDate: text('app_date').notNull(),
  baseline: integer('baseline').notNull(),
  earned: integer('earned').notNull().default(0),
  bankRequested: integer('bank_requested', { mode: 'boolean' }).notNull().default(false),
  legacy: integer('legacy', { mode: 'boolean' }).notNull().default(false),
}, table => ({ day: uniqueIndex('surplus_owner_day').on(table.ownerId, table.appDate) }));
export const goalRestDays = sqliteTable('goal_rest_days', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerId: integer('owner_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  appDate: text('app_date').notNull(),
  target: integer('target').notNull().default(0),
  covered: integer('covered').notNull().default(0),
  createdAt: text('created_at').notNull(),
}, table => ({ day: uniqueIndex('rest_owner_day').on(table.ownerId, table.appDate) }));
