CREATE TABLE `direct_message_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`requester_profile_id` text NOT NULL,
	`recipient_profile_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `direct_requests_conversation_idx` ON `direct_message_requests` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `direct_requests_recipient_status_idx` ON `direct_message_requests` (`recipient_profile_id`,`status`);