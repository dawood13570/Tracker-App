CREATE TABLE `activity_log_tags` (
	`log_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`log_id`, `tag_id`),
	FOREIGN KEY (`log_id`) REFERENCES `activity_logs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
