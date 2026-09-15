ALTER TABLE `tasks` ADD `is_sequential` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `subtask_order` integer;