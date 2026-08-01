-- Native Firebase accounts were briefly enrolled into the legacy seeded
-- community during profile creation. Remove only those accidental rows so
-- every native account starts with an empty, private workspace. Accounts,
-- profiles, friendships and direct messages are intentionally preserved.
UPDATE `servers`
SET `owner_profile_id` = NULL
WHERE `id` = 'kuzens'
  AND `owner_profile_id` IN (
    SELECT `profiles`.`id`
    FROM `profiles`
    INNER JOIN `auth_accounts`
      ON lower(`auth_accounts`.`email`) = lower(`profiles`.`email`)
  );
--> statement-breakpoint
DELETE FROM `member_roles`
WHERE `server_id` = 'kuzens'
  AND `member_tag` IN (
    SELECT '@' || `profiles`.`username`
    FROM `profiles`
    INNER JOIN `auth_accounts`
      ON lower(`auth_accounts`.`email`) = lower(`profiles`.`email`)
  );
--> statement-breakpoint
DELETE FROM `server_members`
WHERE `server_id` = 'kuzens'
  AND `profile_id` IN (
    SELECT `profiles`.`id`
    FROM `profiles`
    INNER JOIN `auth_accounts`
      ON lower(`auth_accounts`.`email`) = lower(`profiles`.`email`)
  );
