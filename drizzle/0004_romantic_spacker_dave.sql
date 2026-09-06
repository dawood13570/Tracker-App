ALTER TABLE `tasks` ADD `scope` text DEFAULT 'daily' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `source_task_id` integer;