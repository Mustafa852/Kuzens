CREATE TABLE `member_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`server_id` text NOT NULL,
	`member_tag` text NOT NULL,
	`role_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_roles_server_member_idx` ON `member_roles` (`server_id`,`member_tag`);--> statement-breakpoint
CREATE TABLE `privacy_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`applicant_name` text NOT NULL,
	`email` text NOT NULL,
	`request_type` text NOT NULL,
	`details` text NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `privacy_requests_created_idx` ON `privacy_requests` (`created_at`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`username` text NOT NULL,
	`is_owner` integer DEFAULT false NOT NULL,
	`birth_confirmed` integer NOT NULL,
	`terms_version` text NOT NULL,
	`notice_version` text NOT NULL,
	`community_version` text NOT NULL,
	`accepted_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_email_idx` ON `profiles` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_username_idx` ON `profiles` (`username`);--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`server_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`permissions` integer DEFAULT 0 NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `roles_server_idx` ON `roles` (`server_id`,`position`);