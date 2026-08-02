CREATE TABLE `channel_canvases` (
	`channel_id` text PRIMARY KEY NOT NULL,
	`server_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`updated_by_profile_id` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `channel_canvases_server_idx` ON `channel_canvases` (`server_id`);--> statement-breakpoint
CREATE TABLE `scheduled_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`server_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`author_profile_id` text NOT NULL,
	`content` text NOT NULL,
	`reply_to_id` text,
	`send_at` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`sent_message_id` text,
	`failure_reason` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `scheduled_messages_channel_due_idx` ON `scheduled_messages` (`channel_id`,`status`,`send_at`);--> statement-breakpoint
CREATE INDEX `scheduled_messages_author_due_idx` ON `scheduled_messages` (`author_profile_id`,`status`,`send_at`);