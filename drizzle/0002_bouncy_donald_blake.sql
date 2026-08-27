CREATE TABLE `activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `activity_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`activity_id` integer NOT NULL,
	`date` text NOT NULL,
	`note` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`priority` text NOT NULL,
	`is_completed` integer DEFAULT false NOT NULL,
	`scheduled_date` text NOT NULL,
	`current_progress` integer DEFAULT 0,
	`total_progress` integer DEFAULT 0,
	`progress_unit` text,
	`deadline` text,
	`subtasks_completed` integer DEFAULT 0,
	`subtasks_total` integer DEFAULT 0,
	`recurrence_type` text DEFAULT 'none' NOT NULL,
	`recurrence_interval` integer,
	`recurrence_days_of_week` text,
	`parent_id` integer,
	`procrastination_count` integer DEFAULT 0,
	`rollover_enabled` integer DEFAULT true NOT NULL,
	`surplus_mode` text,
	`buffer_days` integer DEFAULT 0,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_tasks`("id", "title", "type", "priority", "is_completed", "scheduled_date", "current_progress", "total_progress", "progress_unit", "deadline", "subtasks_completed", "subtasks_total", "recurrence_type", "recurrence_interval", "recurrence_days_of_week", "parent_id", "procrastination_count", "rollover_enabled", "surplus_mode", "buffer_days", "created_at", "updated_at") SELECT "id", "title", "type", "priority", "is_completed", "scheduled_date", "current_progress", "total_progress", "progress_unit", "deadline", "subtasks_completed", "subtasks_total", "recurrence_type", "recurrence_interval", "recurrence_days_of_week", "parent_id", "procrastination_count", "rollover_enabled", "surplus_mode", "buffer_days", "created_at", "updated_at" FROM `tasks`;--> statement-breakpoint
DROP TABLE `tasks`;--> statement-breakpoint
ALTER TABLE `__new_tasks` RENAME TO `tasks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_task_tags` (
	`task_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`task_id`, `tag_id`),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_task_tags`("task_id", "tag_id") SELECT "task_id", "tag_id" FROM `task_tags`;--> statement-breakpoint
DROP TABLE `task_tags`;--> statement-breakpoint
ALTER TABLE `__new_task_tags` RENAME TO `task_tags`;--> statement-breakpoint
CREATE UNIQUE INDEX `habit_logs_habit_id_date_unique` ON `habit_logs` (`habit_id`,`date`);