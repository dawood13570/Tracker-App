ALTER TABLE `tasks` ADD `skipped_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `task_series_occurrence_unique` ON `tasks` (`series_id`,`occurrence_date`) WHERE "tasks"."series_id" IS NOT NULL AND "tasks"."occurrence_date" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tasks_schedule_scope` ON `tasks` (`scheduled_date`,`scope`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tasks_source` ON `tasks` (`source_task_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tasks_parent` ON `tasks` (`parent_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `notes_scope_date` ON `notes` (`scope`,`date_key`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `progress_task` ON `progress_logs` (`task_id`);