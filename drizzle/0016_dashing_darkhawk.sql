ALTER TABLE `notes` ADD `is_auto_generated` integer DEFAULT false NOT NULL;

UPDATE `notes` SET `is_auto_generated` = 1 WHERE `created_at` = `updated_at`;