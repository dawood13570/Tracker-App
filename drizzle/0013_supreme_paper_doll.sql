DROP TABLE `projects`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`priority` text NOT NULL,
	`is_completed` integer DEFAULT false NOT NULL,
	`scheduled_date` text NOT NULL,
	`next_occurrence_generated` integer DEFAULT false NOT NULL,
	`pursuit_id` integer,
	`scope` text DEFAULT 'daily' NOT NULL,
	`source_task_id` integer,
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
	`max_gaps_days` integer,
	`occurrence_target` integer,
	`is_sequential` integer DEFAULT false NOT NULL,
	`subtask_order` integer,
	`surplus_mode` text,
	`buffer_days` integer DEFAULT 0,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`pursuit_id`) REFERENCES `pursuits`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`parent_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_tasks`("id", "title", "type", "priority", "is_completed", "scheduled_date", "next_occurrence_generated", "pursuit_id", "scope", "source_task_id", "current_progress", "total_progress", "progress_unit", "deadline", "subtasks_completed", "subtasks_total", "recurrence_type", "recurrence_interval", "recurrence_days_of_week", "parent_id", "procrastination_count", "rollover_enabled", "max_gaps_days", "occurrence_target", "is_sequential", "subtask_order", "surplus_mode", "buffer_days", "created_at", "updated_at") SELECT "id", "title", "type", "priority", "is_completed", "scheduled_date", "next_occurrence_generated", "pursuit_id", "scope", "source_task_id", "current_progress", "total_progress", "progress_unit", "deadline", "subtasks_completed", "subtasks_total", "recurrence_type", "recurrence_interval", "recurrence_days_of_week", "parent_id", "procrastination_count", "rollover_enabled", "max_gaps_days", "occurrence_target", "is_sequential", "subtask_order", "surplus_mode", "buffer_days", "created_at", "updated_at" FROM `tasks`;--> statement-breakpoint
DROP TABLE `tasks`;--> statement-breakpoint
ALTER TABLE `__new_tasks` RENAME TO `tasks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;