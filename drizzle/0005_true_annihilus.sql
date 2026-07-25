CREATE TABLE `server_bans` (
	`id` text PRIMARY KEY NOT NULL,
	`server_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`banned_by_profile_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `server_bans_server_profile_idx` ON `server_bans` (`server_id`,`profile_id`);