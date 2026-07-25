CREATE TABLE `direct_conversation_reads` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`last_read_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `direct_reads_conversation_profile_idx` ON `direct_conversation_reads` (`conversation_id`,`profile_id`);--> statement-breakpoint
CREATE INDEX `direct_reads_profile_idx` ON `direct_conversation_reads` (`profile_id`,`last_read_at`);