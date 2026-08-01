CREATE TABLE `channel_notification_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`level` text DEFAULT 'mentions' NOT NULL,
	`show_unread` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channel_notifications_profile_channel_idx` ON `channel_notification_settings` (`profile_id`,`channel_id`);--> statement-breakpoint
CREATE INDEX `channel_notifications_profile_idx` ON `channel_notification_settings` (`profile_id`);--> statement-breakpoint
CREATE TABLE `channel_reads` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`last_read_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channel_reads_profile_channel_idx` ON `channel_reads` (`profile_id`,`channel_id`);--> statement-breakpoint
CREATE INDEX `channel_reads_profile_idx` ON `channel_reads` (`profile_id`);