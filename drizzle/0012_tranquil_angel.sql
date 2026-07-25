CREATE TABLE `message_bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`message_id` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`remind_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `message_bookmarks_profile_message_idx` ON `message_bookmarks` (`profile_id`,`message_id`);--> statement-breakpoint
CREATE INDEX `message_bookmarks_profile_reminder_idx` ON `message_bookmarks` (`profile_id`,`remind_at`);