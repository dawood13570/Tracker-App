CREATE TABLE `goal_rest_days` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`app_date` text NOT NULL,
	`target` integer DEFAULT 0 NOT NULL,
	`covered` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rest_owner_day` ON `goal_rest_days` (`owner_id`,`app_date`);--> statement-breakpoint
CREATE TABLE `surplus_credits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`app_date` text NOT NULL,
	`baseline` integer NOT NULL,
	`earned` integer DEFAULT 0 NOT NULL,
	`bank_requested` integer DEFAULT false NOT NULL,
	`legacy` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `surplus_owner_day` ON `surplus_credits` (`owner_id`,`app_date`);--> statement-breakpoint
ALTER TABLE `progress_logs` ADD `credit_date` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `plan_summary` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `bank_covered` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE progress_logs SET credit_date = COALESCE((SELECT CASE WHEN scope = 'daily' THEN scheduled_date END FROM tasks WHERE tasks.id = progress_logs.task_id), app_date, substr(logged_at, 1, 10));
--> statement-breakpoint
WITH RECURSIVE owners(id, owner_id, parent, depth) AS (
  SELECT id, id, source_task_id, 0 FROM tasks WHERE buffer_days > 0
  UNION ALL
  SELECT owners.id, tasks.id, tasks.source_task_id, depth + 1 FROM owners JOIN tasks ON tasks.id = owners.parent WHERE depth < 100
), balances AS (
  SELECT owners.owner_id, tasks.buffer_days,
    COALESCE(tasks.nominal_daily_target, CAST(tasks.total_progress AS REAL) / MAX(1,
      julianday(COALESCE(tasks.deadline, CASE tasks.scope
        WHEN 'weekly' THEN date(tasks.scheduled_date, 'weekday 0')
        WHEN 'monthly' THEN date(tasks.scheduled_date, 'start of month', '+1 month', '-1 day')
        WHEN 'yearly' THEN date(tasks.scheduled_date, 'start of year', '+1 year', '-1 day')
        ELSE tasks.scheduled_date END)) - julianday(tasks.scheduled_date) + 1), 1) AS baseline
  FROM owners JOIN tasks ON tasks.id = owners.id WHERE owners.parent IS NULL
)
INSERT INTO surplus_credits (owner_id, app_date, baseline, earned, bank_requested, legacy)
SELECT owner_id, '0001-01-01', MAX(baseline), SUM(buffer_days * baseline), 1, 1 FROM balances GROUP BY owner_id;
