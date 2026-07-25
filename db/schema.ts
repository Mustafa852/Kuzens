import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const servers = sqliteTable("servers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("K"),
  ownerProfileId: text("owner_profile_id"),
  createdAt: text("created_at").notNull(),
});

export const channels = sqliteTable(
  "channels",
  {
    id: text("id").primaryKey(),
    serverId: text("server_id").notNull(),
    name: text("name").notNull(),
    kind: text("kind", { enum: ["text", "voice"] }).notNull(),
    position: integer("position").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("channels_server_idx").on(table.serverId)],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id").notNull(),
    authorProfileId: text("author_profile_id"),
    authorName: text("author_name").notNull(),
    authorTag: text("author_tag").notNull(),
    content: text("content").notNull(),
    replyToId: text("reply_to_id"),
    editedAt: text("edited_at"),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("messages_channel_created_idx").on(table.channelId, table.createdAt),
    index("messages_author_idx").on(table.authorProfileId),
  ],
);

export const profiles = sqliteTable(
  "profiles",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    username: text("username").notNull(),
    isOwner: integer("is_owner", { mode: "boolean" }).notNull().default(false),
    birthConfirmed: integer("birth_confirmed", { mode: "boolean" }).notNull(),
    termsVersion: text("terms_version").notNull(),
    noticeVersion: text("notice_version").notNull(),
    communityVersion: text("community_version").notNull(),
    acceptedAt: text("accepted_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("profiles_email_idx").on(table.email),
    uniqueIndex("profiles_username_idx").on(table.username),
  ],
);

export const roles = sqliteTable(
  "roles",
  {
    id: text("id").primaryKey(),
    serverId: text("server_id").notNull(),
    name: text("name").notNull(),
    color: text("color").notNull(),
    permissions: integer("permissions").notNull().default(0),
    position: integer("position").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("roles_server_idx").on(table.serverId, table.position)],
);

export const memberRoles = sqliteTable(
  "member_roles",
  {
    id: text("id").primaryKey(),
    serverId: text("server_id").notNull(),
    memberTag: text("member_tag").notNull(),
    roleId: text("role_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("member_roles_server_member_idx").on(table.serverId, table.memberTag),
  ],
);

export const serverMembers = sqliteTable(
  "server_members",
  {
    id: text("id").primaryKey(),
    serverId: text("server_id").notNull(),
    profileId: text("profile_id").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
    voiceChannelId: text("voice_channel_id"),
    sharing: integer("sharing", { mode: "boolean" }).notNull().default(false),
    joinedAt: text("joined_at").notNull(),
  },
  (table) => [
    uniqueIndex("server_members_server_profile_idx").on(table.serverId, table.profileId),
    index("server_members_presence_idx").on(table.serverId, table.lastSeenAt),
  ],
);

export const invites = sqliteTable(
  "invites",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    serverId: text("server_id").notNull(),
    createdByProfileId: text("created_by_profile_id").notNull(),
    maxUses: integer("max_uses").notNull().default(10),
    uses: integer("uses").notNull().default(0),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("invites_code_idx").on(table.code),
    index("invites_server_idx").on(table.serverId, table.createdAt),
  ],
);

export const rateLimits = sqliteTable(
  "rate_limits",
  {
    id: text("id").primaryKey(),
    count: integer("count").notNull().default(1),
    expiresAt: integer("expires_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("rate_limits_expiry_idx").on(table.expiresAt)],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    serverId: text("server_id").notNull(),
    actorProfileId: text("actor_profile_id").notNull(),
    action: text("action").notNull(),
    targetId: text("target_id"),
    detail: text("detail"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("audit_logs_server_created_idx").on(table.serverId, table.createdAt)],
);

export const rtcSignals = sqliteTable(
  "rtc_signals",
  {
    id: text("id").primaryKey(),
    serverId: text("server_id").notNull(),
    channelId: text("channel_id").notNull(),
    senderProfileId: text("sender_profile_id").notNull(),
    recipientProfileId: text("recipient_profile_id").notNull(),
    type: text("type", { enum: ["offer", "answer", "ice"] }).notNull(),
    payload: text("payload").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("rtc_signals_recipient_created_idx").on(
      table.recipientProfileId,
      table.createdAt,
    ),
  ],
);

export const friendships = sqliteTable(
  "friendships",
  {
    id: text("id").primaryKey(),
    requesterProfileId: text("requester_profile_id").notNull(),
    addresseeProfileId: text("addressee_profile_id").notNull(),
    status: text("status", { enum: ["pending", "accepted", "blocked"] }).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("friendships_requester_idx").on(table.requesterProfileId, table.status),
    index("friendships_addressee_idx").on(table.addresseeProfileId, table.status),
  ],
);

export const serverBans = sqliteTable(
  "server_bans",
  {
    id: text("id").primaryKey(),
    serverId: text("server_id").notNull(),
    profileId: text("profile_id").notNull(),
    bannedByProfileId: text("banned_by_profile_id").notNull(),
    reason: text("reason").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("server_bans_server_profile_idx").on(table.serverId, table.profileId),
  ],
);

export const privacyRequests = sqliteTable(
  "privacy_requests",
  {
    id: text("id").primaryKey(),
    applicantName: text("applicant_name").notNull(),
    email: text("email").notNull(),
    requestType: text("request_type").notNull(),
    details: text("details").notNull(),
    status: text("status").notNull().default("received"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("privacy_requests_created_idx").on(table.createdAt)],
);
