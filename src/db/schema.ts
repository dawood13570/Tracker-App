// src/db/schema.ts
import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const tasks= sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  type: text('type', { enum: ["Simple", "Hybrid", "Progression"] }).notNull(),
  priority: text('priority', { enum: ['Low', 'Medium', 'High'] }).notNull(),
  isCompleted: integer('is_completed', { mode: 'boolean' }).default(false).notNull(),
  scheduledDate: text('scheduled_date').notNull(), 

  // Progression fields
  currentProgress: integer('current_progress').default(0),
  totalProgress: integer('total_progress').default(0),
  progressUnit: text('progress_unit'),
  deadline: text('deadline'),

  // Hybrid fields
  subtasksCompleted: integer('subtasks_completed').default(0),
  subtasksTotal: integer('subtasks_total').default(0),

  recurrenceType: text('recurrence_type').notNull().default('none'), // none|daily|every_n_days|weekly
  recurrenceInterval: integer('recurrence_interval'),      // used by every_n_days
  recurrenceDaysOfWeek: text('recurrence_days_of_week'), 

  parentId: integer('parent_id').references((): any => tasks.id, { onDelete: 'cascade' }),

  // Gamification / Tracking fields
  procrastinationCount: integer('procrastination_count').default(0),
  rolloverEnabled: integer('rollover_enabled', { mode: 'boolean' }).notNull().default(true),

  surplusMode: text('surplus_mode').default('breathing_room'),
  
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const progressLogs = sqliteTable('progress_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  loggedAt: text('logged_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  notes: text('notes'),
});

export const goals = sqliteTable('goals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  targetDate: text('target_date'),
});

export const habits = sqliteTable('habits', {
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
});

export const events = sqliteTable('events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time'),
  location: text('location'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const notes = sqliteTable('notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  scope: text('scope', { enum: ['daily', 'weekly', 'monthly', 'yearly'] }).notNull(),
  dateKey: text('date_key').notNull(),
  content: text('content'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  color: text('color'),
});

export const taskTags = sqliteTable('task_tags', {
  taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
});
