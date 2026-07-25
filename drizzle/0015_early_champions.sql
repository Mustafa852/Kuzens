CREATE TABLE `message_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_message_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`server_id` text NOT NULL,
	`creator_profile_id` text NOT NULL,
	`title` text NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `message_threads_parent_idx` ON `message_threads` (`parent_message_id`);--> statement-breakpoint
CREATE INDEX `message_threads_channel_updated_idx` ON `message_threads` (`channel_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `thread_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`author_profile_id` text NOT NULL,
	`content` text NOT NULL,
	`edited_at` text,
	`deleted_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `thread_messages_thread_created_idx` ON `thread_messages` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `thread_messages_author_idx` ON `thread_messages` (`author_profile_id`);