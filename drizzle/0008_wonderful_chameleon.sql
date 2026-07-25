CREATE TABLE `direct_conversation_members` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`joined_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `direct_members_conversation_profile_idx` ON `direct_conversation_members` (`conversation_id`,`profile_id`);--> statement-breakpoint
CREATE INDEX `direct_members_profile_idx` ON `direct_conversation_members` (`profile_id`,`conversation_id`);--> statement-breakpoint
CREATE TABLE `direct_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `direct_conversations_updated_idx` ON `direct_conversations` (`updated_at`);--> statement-breakpoint
CREATE TABLE `direct_message_settings` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`allow_from` text DEFAULT 'friends' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `direct_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`author_profile_id` text NOT NULL,
	`content` text NOT NULL,
	`edited_at` text,
	`deleted_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `direct_messages_conversation_created_idx` ON `direct_messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `direct_messages_author_idx` ON `direct_messages` (`author_profile_id`);