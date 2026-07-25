CREATE TABLE `message_mentions` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`read_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `message_mentions_message_profile_idx` ON `message_mentions` (`message_id`,`profile_id`);--> statement-breakpoint
CREATE INDEX `message_mentions_profile_read_idx` ON `message_mentions` (`profile_id`,`read_at`);--> statement-breakpoint
CREATE TABLE `message_reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`emoji` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `message_reactions_message_profile_emoji_idx` ON `message_reactions` (`message_id`,`profile_id`,`emoji`);--> statement-breakpoint
CREATE INDEX `message_reactions_message_idx` ON `message_reactions` (`message_id`);--> statement-breakpoint
ALTER TABLE `channels` ADD `topic` text;--> statement-breakpoint
ALTER TABLE `channels` ADD `slow_mode_seconds` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `pinned` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `bio` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `custom_status` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `presence_status` text DEFAULT 'online' NOT NULL;