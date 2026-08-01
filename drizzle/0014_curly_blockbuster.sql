CREATE TABLE `poll_options` (
	`id` text PRIMARY KEY NOT NULL,
	`poll_id` text NOT NULL,
	`label` text NOT NULL,
	`position` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `poll_options_poll_position_idx` ON `poll_options` (`poll_id`,`position`);--> statement-breakpoint
CREATE TABLE `poll_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`poll_id` text NOT NULL,
	`option_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `poll_votes_poll_option_profile_idx` ON `poll_votes` (`poll_id`,`option_id`,`profile_id`);--> statement-breakpoint
CREATE INDEX `poll_votes_poll_profile_idx` ON `poll_votes` (`poll_id`,`profile_id`);--> statement-breakpoint
CREATE TABLE `polls` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`creator_profile_id` text NOT NULL,
	`question` text NOT NULL,
	`allow_multiple` integer DEFAULT false NOT NULL,
	`closes_at` text NOT NULL,
	`closed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `polls_message_idx` ON `polls` (`message_id`);--> statement-breakpoint
CREATE INDEX `polls_channel_created_idx` ON `polls` (`channel_id`,`created_at`);