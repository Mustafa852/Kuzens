CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`server_id` text NOT NULL,
	`actor_profile_id` text NOT NULL,
	`action` text NOT NULL,
	`target_id` text,
	`detail` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_logs_server_created_idx` ON `audit_logs` (`server_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `invites` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`server_id` text NOT NULL,
	`created_by_profile_id` text NOT NULL,
	`max_uses` integer DEFAULT 10 NOT NULL,
	`uses` integer DEFAULT 0 NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invites_code_idx` ON `invites` (`code`);--> statement-breakpoint
CREATE INDEX `invites_server_idx` ON `invites` (`server_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limits_expiry_idx` ON `rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `rtc_signals` (
	`id` text PRIMARY KEY NOT NULL,
	`server_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`sender_profile_id` text NOT NULL,
	`recipient_profile_id` text NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rtc_signals_recipient_created_idx` ON `rtc_signals` (`recipient_profile_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `server_members` (
	`id` text PRIMARY KEY NOT NULL,
	`server_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`voice_channel_id` text,
	`sharing` integer DEFAULT false NOT NULL,
	`joined_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `server_members_server_profile_idx` ON `server_members` (`server_id`,`profile_id`);--> statement-breakpoint
CREATE INDEX `server_members_presence_idx` ON `server_members` (`server_id`,`last_seen_at`);--> statement-breakpoint
ALTER TABLE `messages` ADD `author_profile_id` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `reply_to_id` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `edited_at` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `deleted_at` text;--> statement-breakpoint
CREATE INDEX `messages_author_idx` ON `messages` (`author_profile_id`);
--> statement-breakpoint
INSERT OR IGNORE INTO `servers` (`id`, `name`, `icon`, `created_at`) VALUES
	('kuzens', 'Kuzens', 'K', '2026-07-25T00:00:00.000Z');
--> statement-breakpoint
INSERT OR IGNORE INTO `channels` (`id`, `server_id`, `name`, `kind`, `position`, `created_at`) VALUES
	('genel', 'kuzens', 'genel', 'text', 0, '2026-07-25T00:00:00.000Z'),
	('oyun-gecesi', 'kuzens', 'oyun-gecesi', 'text', 1, '2026-07-25T00:00:00.000Z'),
	('paylasimlar', 'kuzens', 'paylaşımlar', 'text', 2, '2026-07-25T00:00:00.000Z'),
	('muhabbet', 'kuzens', 'Muhabbet', 'voice', 3, '2026-07-25T00:00:00.000Z'),
	('gece-ekibi', 'kuzens', 'Gece Ekibi', 'voice', 4, '2026-07-25T00:00:00.000Z');
--> statement-breakpoint
INSERT OR IGNORE INTO `roles` (`id`, `server_id`, `name`, `color`, `permissions`, `position`, `created_at`) VALUES
	('kuzens:owner', 'kuzens', 'Kurucu', '#ffd166', 255, 0, '2026-07-25T00:00:00.000Z'),
	('kuzens:moderator', 'kuzens', 'Moderatör', '#9c7cff', 123, 1, '2026-07-25T00:00:00.000Z'),
	('kuzens:member', 'kuzens', 'Kuzen', '#5be39a', 192, 2, '2026-07-25T00:00:00.000Z');
--> statement-breakpoint
UPDATE `roles` SET `permissions` = 192 WHERE `id` = 'kuzens:member' AND `permissions` = 193;
