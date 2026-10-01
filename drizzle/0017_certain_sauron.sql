CREATE TABLE `task_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer,
	`title` text NOT NULL,
	`action` text NOT NULL,
	`app_date` text NOT NULL,
	`details` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `activities` ADD `pursuit_id` integer REFERENCES pursuits(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `pursuit_id` integer REFERENCES pursuits(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `habits` ADD `pursuit_id` integer REFERENCES pursuits(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `notes` ADD `pursuit_id` integer REFERENCES pursuits(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `progress_logs` ADD `app_date` text;--> statement-breakpoint
ALTER TABLE `progress_logs` ADD `kind` text DEFAULT 'progress' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `series_id` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `occurrence_date` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `rollover_from_id` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `completed_at` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `completed_date` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `completion_previous_progress` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `paused_until` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `nominal_daily_target` integer;
--> statement-breakpoint
UPDATE notes SET is_auto_generated = 0;
--> statement-breakpoint
UPDATE tasks SET rollover_from_id = source_task_id, source_task_id = NULL WHERE scope = 'daily' AND source_task_id IN (SELECT id FROM tasks WHERE scope = 'daily' AND parent_id IS NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX task_series_occurrence_unique ON tasks(series_id, occurrence_date) WHERE series_id IS NOT NULL AND occurrence_date IS NOT NULL;
--> statement-breakpoint
CREATE INDEX tasks_schedule_scope ON tasks(scheduled_date, scope);
--> statement-breakpoint
CREATE INDEX tasks_source ON tasks(source_task_id);
--> statement-breakpoint
CREATE INDEX tasks_parent ON tasks(parent_id);
--> statement-breakpoint
CREATE INDEX progress_task ON progress_logs(task_id);
--> statement-breakpoint
CREATE INDEX notes_scope_date ON notes(scope, date_key);

--> statement-breakpoint
UPDATE progress_logs SET app_date = date(logged_at, 'localtime') WHERE app_date IS NULL;
