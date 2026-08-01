CREATE TABLE `channel_permission_overwrites` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`role_id` text NOT NULL,
	`allow_permissions` integer DEFAULT 0 NOT NULL,
	`deny_permissions` integer DEFAULT 0 NOT NULL,
	`updated_by_profile_id` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channel_overwrites_channel_role_idx` ON `channel_permission_overwrites` (`channel_id`,`role_id`);--> statement-breakpoint
CREATE INDEX `channel_overwrites_channel_idx` ON `channel_permission_overwrites` (`channel_id`);--> statement-breakpoint
CREATE TABLE `server_aura_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`server_id` text NOT NULL,
	`tier` integer DEFAULT 1 NOT NULL,
	`source` text NOT NULL,
	`granted_by_profile_id` text,
	`expires_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `server_aura_server_idx` ON `server_aura_memberships` (`server_id`);--> statement-breakpoint
CREATE INDEX `server_aura_expiry_idx` ON `server_aura_memberships` (`expires_at`);--> statement-breakpoint
DROP INDEX `member_roles_server_member_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `member_roles_server_member_role_idx` ON `member_roles` (`server_id`,`member_tag`,`role_id`);--> statement-breakpoint
CREATE INDEX `member_roles_server_member_idx` ON `member_roles` (`server_id`,`member_tag`);--> statement-breakpoint
ALTER TABLE `channels` ADD `bitrate` integer DEFAULT 64000 NOT NULL;--> statement-breakpoint
ALTER TABLE `channels` ADD `user_limit` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `channels` ADD `region` text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE `servers` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `servers` ADD `default_notification_level` text DEFAULT 'mentions' NOT NULL;--> statement-breakpoint
ALTER TABLE `servers` ADD `explicit_content_filter` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `servers` ADD `preferred_locale` text DEFAULT 'tr' NOT NULL;--> statement-breakpoint
ALTER TABLE `servers` ADD `system_channel_id` text;--> statement-breakpoint
UPDATE `roles` SET `permissions` = 2047 WHERE `id` = `server_id` || ':owner';--> statement-breakpoint
UPDATE `roles` SET `permissions` = 2046 WHERE `id` = `server_id` || ':moderator';--> statement-breakpoint
UPDATE `roles` SET `permissions` = 1984 WHERE `id` = `server_id` || ':member';
