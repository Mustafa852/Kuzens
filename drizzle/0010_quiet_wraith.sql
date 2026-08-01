CREATE TABLE `community_events` (
	`id` text PRIMARY KEY NOT NULL,
	`server_id` text NOT NULL,
	`creator_profile_id` text NOT NULL,
	`channel_id` text,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`recurrence` text DEFAULT 'none' NOT NULL,
	`cancelled_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `community_events_server_start_idx` ON `community_events` (`server_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `community_events_creator_idx` ON `community_events` (`creator_profile_id`);--> statement-breakpoint
CREATE TABLE `event_rsvps` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`response` text NOT NULL,
	`reminder_minutes` integer DEFAULT 30 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_rsvps_event_profile_idx` ON `event_rsvps` (`event_id`,`profile_id`);--> statement-breakpoint
CREATE INDEX `event_rsvps_profile_idx` ON `event_rsvps` (`profile_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `server_automod_settings` (
	`server_id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`blocked_terms` text DEFAULT '' NOT NULL,
	`block_invite_links` integer DEFAULT true NOT NULL,
	`block_duplicate_messages` integer DEFAULT true NOT NULL,
	`max_mentions` integer DEFAULT 8 NOT NULL,
	`exempt_channel_ids` text DEFAULT '[]' NOT NULL,
	`updated_by_profile_id` text NOT NULL,
	`updated_at` text NOT NULL
);
