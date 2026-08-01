CREATE TABLE `channel_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`server_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`collapsed_by_default` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `channel_categories_server_idx` ON `channel_categories` (`server_id`,`position`);--> statement-breakpoint
CREATE TABLE `channel_member_permission_overwrites` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`allow_permissions` integer DEFAULT 0 NOT NULL,
	`deny_permissions` integer DEFAULT 0 NOT NULL,
	`updated_by_profile_id` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channel_member_overwrites_channel_profile_idx` ON `channel_member_permission_overwrites` (`channel_id`,`profile_id`);--> statement-breakpoint
CREATE INDEX `channel_member_overwrites_channel_idx` ON `channel_member_permission_overwrites` (`channel_id`);--> statement-breakpoint
CREATE TABLE `content_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`server_id` text NOT NULL,
	`reporter_profile_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`reason` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`reviewed_by_profile_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `content_reports_server_status_idx` ON `content_reports` (`server_id`,`status`);--> statement-breakpoint
CREATE INDEX `content_reports_reporter_idx` ON `content_reports` (`reporter_profile_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `custom_emojis` (
	`id` text PRIMARY KEY NOT NULL,
	`server_id` text NOT NULL,
	`name` text NOT NULL,
	`storage_key` text NOT NULL,
	`uploader_profile_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_emojis_server_name_idx` ON `custom_emojis` (`server_id`,`name`);--> statement-breakpoint
CREATE INDEX `custom_emojis_server_idx` ON `custom_emojis` (`server_id`);--> statement-breakpoint
CREATE TABLE `direct_conversation_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`muted_until` text,
	`pinned` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `direct_settings_conversation_profile_idx` ON `direct_conversation_settings` (`conversation_id`,`profile_id`);--> statement-breakpoint
CREATE TABLE `message_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`uploader_profile_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`width` integer,
	`height` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `message_attachments_message_idx` ON `message_attachments` (`message_id`);--> statement-breakpoint
CREATE INDEX `message_attachments_uploader_idx` ON `message_attachments` (`uploader_profile_id`);--> statement-breakpoint
ALTER TABLE `channels` ADD `category_id` text;--> statement-breakpoint
ALTER TABLE `channels` ADD `history_mode` text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE `direct_conversations` ADD `name` text;--> statement-breakpoint
ALTER TABLE `direct_conversations` ADD `icon_key` text;--> statement-breakpoint
ALTER TABLE `direct_conversations` ADD `is_group` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `direct_conversations` ADD `owner_profile_id` text;--> statement-breakpoint
ALTER TABLE `message_mentions` ADD `kind` text DEFAULT 'mention' NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `forwarded_from_id` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `banner_key` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `profile_color` text DEFAULT '#8b5cf6' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `status_expires_at` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `allow_friend_requests` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `server_automod_settings` ADD `blocked_domains` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `server_automod_settings` ADD `max_messages_per_minute` integer DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE `server_automod_settings` ADD `raid_join_limit` integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `server_members` ADD `nickname` text;--> statement-breakpoint
ALTER TABLE `server_members` ADD `timeout_until` text;--> statement-breakpoint
ALTER TABLE `server_members` ADD `server_muted` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `server_members` ADD `server_deafened` integer DEFAULT false NOT NULL;