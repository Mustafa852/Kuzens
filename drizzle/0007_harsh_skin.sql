CREATE TABLE `aura_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`code_hint` text NOT NULL,
	`duration_days` integer NOT NULL,
	`max_uses` integer DEFAULT 1 NOT NULL,
	`uses` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by_profile_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `aura_codes_hash_idx` ON `aura_codes` (`code_hash`);--> statement-breakpoint
CREATE INDEX `aura_codes_owner_idx` ON `aura_codes` (`created_by_profile_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `aura_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`source` text NOT NULL,
	`granted_by_profile_id` text,
	`expires_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `aura_memberships_profile_idx` ON `aura_memberships` (`profile_id`);--> statement-breakpoint
CREATE INDEX `aura_memberships_expiry_idx` ON `aura_memberships` (`expires_at`);--> statement-breakpoint
CREATE TABLE `aura_redemptions` (
	`id` text PRIMARY KEY NOT NULL,
	`code_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`redeemed_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `aura_redemptions_code_profile_idx` ON `aura_redemptions` (`code_id`,`profile_id`);--> statement-breakpoint
CREATE INDEX `aura_redemptions_profile_idx` ON `aura_redemptions` (`profile_id`,`redeemed_at`);