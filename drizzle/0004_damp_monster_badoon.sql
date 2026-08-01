CREATE TABLE `friendships` (
	`id` text PRIMARY KEY NOT NULL,
	`requester_profile_id` text NOT NULL,
	`addressee_profile_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `friendships_requester_idx` ON `friendships` (`requester_profile_id`,`status`);--> statement-breakpoint
CREATE INDEX `friendships_addressee_idx` ON `friendships` (`addressee_profile_id`,`status`);