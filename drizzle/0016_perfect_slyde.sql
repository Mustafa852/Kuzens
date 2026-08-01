CREATE TABLE `server_guide_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`server_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`completed_steps` text DEFAULT '[]' NOT NULL,
	`completed_at` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `server_guide_progress_server_profile_idx` ON `server_guide_progress` (`server_id`,`profile_id`);--> statement-breakpoint
CREATE INDEX `server_guide_progress_profile_idx` ON `server_guide_progress` (`profile_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `server_guides` (
	`server_id` text PRIMARY KEY NOT NULL,
	`welcome_message` text DEFAULT 'Aramıza hoş geldin!' NOT NULL,
	`rules_channel_id` text,
	`updated_by_profile_id` text NOT NULL,
	`updated_at` text NOT NULL
);
