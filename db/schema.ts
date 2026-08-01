import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const servers = sqliteTable("servers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("K"),
  description: text("description").notNull().default(""),
  defaultNotificationLevel: text("default_notification_level", {
    enum: ["all", "mentions"],
  })
    .notNull()
    .default("mentions"),
  explicitContentFilter: integer("explicit_content_filter", { mode: "boolean" })
    .notNull()
    .default(true),
  preferredLocale: text("preferred_locale").notNull().default("tr"),
  systemChannelId: text("system_channel_id"),
  ownerProfileId: text("owner_profile_id"),
  createdAt: text("created_at").notNull(),
});

export const channels = sqliteTable(
  "channels",
  {
    id: text("id").primaryKey(),
    serverId: text("server_id").notNull(),
    name: text("name").notNull(),
    kind: text("kind", {
      enum: ["text", "voice", "forum", "announcement"],
    }).notNull(),
    categoryId: text("category_id"),
    topic: text("topic"),
    slowModeSeconds: integer("slow_mode_seconds").notNull().default(0),
    bitrate: integer("bitrate").notNull().default(64_000),
    userLimit: integer("user_limit").notNull().default(0),
    region: text("region").notNull().default("auto"),
    historyMode: text("history_mode", { enum: ["all", "since_join"] })
      .notNull()
      .default("all"),
    position: integer("position").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("channels_server_idx").on(table.serverId)],
);

export const channelCategories = sqliteTable(
  "channel_categories",
  {
    id: text("id").primaryKey(),
    serverId: text("server_id").notNull(),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    collapsedByDefault: integer("collapsed_by_default", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("channel_categories_server_idx").on(table.serverId, table.position)],
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
    forwardedFromId: text("forwarded_from_id"),
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
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
    bio: text("bio").notNull().default(""),
    customStatus: text("custom_status").notNull().default(""),
    avatarKey: text("avatar_key"),
    bannerKey: text("banner_key"),
    profileColor: text("profile_color").notNull().default("#8b5cf6"),
    statusExpiresAt: text("status_expires_at"),
    allowFriendRequests: integer("allow_friend_requests", { mode: "boolean" })
      .notNull()
      .default(true),
    presenceStatus: text("presence_status", {
      enum: ["online", "idle", "dnd", "invisible"],
    })
      .notNull()
      .default("online"),
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

export const linkPreviews = sqliteTable(
  "link_previews",
  {
    id: text("id").primaryKey(),
    url: text("url").notNull(),
    provider: text("provider").notNull().default("web"),
    siteName: text("site_name").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    imageUrl: text("image_url"),
    fetchedAt: text("fetched_at").notNull(),
  },
  (table) => [
    uniqueIndex("link_previews_url_idx").on(table.url),
    index("link_previews_fetched_idx").on(table.fetchedAt),
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
    uniqueIndex("member_roles_server_member_role_idx").on(
      table.serverId,
      table.memberTag,
      table.roleId,
    ),
    index("member_roles_server_member_idx").on(table.serverId, table.memberTag),
  ],
);

export const channelPermissionOverwrites = sqliteTable(
  "channel_permission_overwrites",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id").notNull(),
    roleId: text("role_id").notNull(),
    allowPermissions: integer("allow_permissions").notNull().default(0),
    denyPermissions: integer("deny_permissions").notNull().default(0),
    updatedByProfileId: text("updated_by_profile_id").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("channel_overwrites_channel_role_idx").on(
      table.channelId,
      table.roleId,
    ),
    index("channel_overwrites_channel_idx").on(table.channelId),
  ],
);

export const channelMemberPermissionOverwrites = sqliteTable(
  "channel_member_permission_overwrites",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id").notNull(),
    profileId: text("profile_id").notNull(),
    allowPermissions: integer("allow_permissions").notNull().default(0),
    denyPermissions: integer("deny_permissions").notNull().default(0),
    updatedByProfileId: text("updated_by_profile_id").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("channel_member_overwrites_channel_profile_idx").on(
      table.channelId,
      table.profileId,
    ),
    index("channel_member_overwrites_channel_idx").on(table.channelId),
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
    nickname: text("nickname"),
    timeoutUntil: text("timeout_until"),
    serverMuted: integer("server_muted", { mode: "boolean" }).notNull().default(false),
    serverDeafened: integer("server_deafened", { mode: "boolean" }).notNull().default(false),
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
    type: text("type", { enum: ["offer", "answer", "ice", "sound"] }).notNull(),
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

export const messageReactions = sqliteTable(
  "message_reactions",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id").notNull(),
    profileId: text("profile_id").notNull(),
    emoji: text("emoji").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("message_reactions_message_profile_emoji_idx").on(
      table.messageId,
      table.profileId,
      table.emoji,
    ),
    index("message_reactions_message_idx").on(table.messageId),
  ],
);

export const messageMentions = sqliteTable(
  "message_mentions",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id").notNull(),
    profileId: text("profile_id").notNull(),
    kind: text("kind", { enum: ["mention", "reply", "role", "everyone"] })
      .notNull()
      .default("mention"),
    readAt: text("read_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("message_mentions_message_profile_idx").on(
      table.messageId,
      table.profileId,
    ),
    index("message_mentions_profile_read_idx").on(table.profileId, table.readAt),
  ],
);

export const messageAttachments = sqliteTable(
  "message_attachments",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id").notNull(),
    uploaderProfileId: text("uploader_profile_id").notNull(),
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("message_attachments_message_idx").on(table.messageId),
    index("message_attachments_uploader_idx").on(table.uploaderProfileId),
  ],
);

export const contentReports = sqliteTable(
  "content_reports",
  {
    id: text("id").primaryKey(),
    serverId: text("server_id").notNull(),
    reporterProfileId: text("reporter_profile_id").notNull(),
    targetType: text("target_type", { enum: ["message", "profile"] }).notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason").notNull(),
    details: text("details").notNull().default(""),
    status: text("status", { enum: ["open", "reviewed", "closed"] })
      .notNull()
      .default("open"),
    reviewedByProfileId: text("reviewed_by_profile_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("content_reports_server_status_idx").on(table.serverId, table.status),
    index("content_reports_reporter_idx").on(table.reporterProfileId, table.createdAt),
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

export const auraMemberships = sqliteTable(
  "aura_memberships",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id").notNull(),
    source: text("source", { enum: ["code", "owner", "purchase"] }).notNull(),
    grantedByProfileId: text("granted_by_profile_id"),
    expiresAt: text("expires_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("aura_memberships_profile_idx").on(table.profileId),
    index("aura_memberships_expiry_idx").on(table.expiresAt),
  ],
);

export const serverAuraMemberships = sqliteTable(
  "server_aura_memberships",
  {
    id: text("id").primaryKey(),
    serverId: text("server_id").notNull(),
    tier: integer("tier").notNull().default(1),
    source: text("source", { enum: ["owner", "campaign", "purchase"] }).notNull(),
    grantedByProfileId: text("granted_by_profile_id"),
    expiresAt: text("expires_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("server_aura_server_idx").on(table.serverId),
    index("server_aura_expiry_idx").on(table.expiresAt),
  ],
);

export const auraCodes = sqliteTable(
  "aura_codes",
  {
    id: text("id").primaryKey(),
    codeHash: text("code_hash").notNull(),
    codeHint: text("code_hint").notNull(),
    durationDays: integer("duration_days").notNull(),
    maxUses: integer("max_uses").notNull().default(1),
    uses: integer("uses").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdByProfileId: text("created_by_profile_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("aura_codes_hash_idx").on(table.codeHash),
    index("aura_codes_owner_idx").on(table.createdByProfileId, table.createdAt),
  ],
);

export const auraRedemptions = sqliteTable(
  "aura_redemptions",
  {
    id: text("id").primaryKey(),
    codeId: text("code_id").notNull(),
    profileId: text("profile_id").notNull(),
    redeemedAt: text("redeemed_at").notNull(),
  },
  (table) => [
    uniqueIndex("aura_redemptions_code_profile_idx").on(table.codeId, table.profileId),
    index("aura_redemptions_profile_idx").on(table.profileId, table.redeemedAt),
  ],
);

export const directConversations = sqliteTable(
  "direct_conversations",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    iconKey: text("icon_key"),
    isGroup: integer("is_group", { mode: "boolean" }).notNull().default(false),
    ownerProfileId: text("owner_profile_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("direct_conversations_updated_idx").on(table.updatedAt)],
);

export const directConversationMembers = sqliteTable(
  "direct_conversation_members",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").notNull(),
    profileId: text("profile_id").notNull(),
    joinedAt: text("joined_at").notNull(),
  },
  (table) => [
    uniqueIndex("direct_members_conversation_profile_idx").on(
      table.conversationId,
      table.profileId,
    ),
    index("direct_members_profile_idx").on(table.profileId, table.conversationId),
  ],
);

export const directMessages = sqliteTable(
  "direct_messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").notNull(),
    authorProfileId: text("author_profile_id").notNull(),
    content: text("content").notNull(),
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    editedAt: text("edited_at"),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("direct_messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt,
    ),
    index("direct_messages_author_idx").on(table.authorProfileId),
  ],
);

export const directMessageSettings = sqliteTable(
  "direct_message_settings",
  {
    profileId: text("profile_id").primaryKey(),
    allowFrom: text("allow_from", {
      enum: ["friends", "shared_servers", "none"],
    })
      .notNull()
      .default("friends"),
    updatedAt: text("updated_at").notNull(),
  },
);

export const directConversationReads = sqliteTable(
  "direct_conversation_reads",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").notNull(),
    profileId: text("profile_id").notNull(),
    lastReadAt: text("last_read_at").notNull(),
  },
  (table) => [
    uniqueIndex("direct_reads_conversation_profile_idx").on(
      table.conversationId,
      table.profileId,
    ),
    index("direct_reads_profile_idx").on(table.profileId, table.lastReadAt),
  ],
);

export const directConversationSettings = sqliteTable(
  "direct_conversation_settings",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").notNull(),
    profileId: text("profile_id").notNull(),
    mutedUntil: text("muted_until"),
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("direct_settings_conversation_profile_idx").on(
      table.conversationId,
      table.profileId,
    ),
  ],
);

export const directMessageRequests = sqliteTable(
  "direct_message_requests",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").notNull(),
    requesterProfileId: text("requester_profile_id").notNull(),
    recipientProfileId: text("recipient_profile_id").notNull(),
    status: text("status", {
      enum: ["pending", "accepted", "ignored"],
    })
      .notNull()
      .default("pending"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("direct_requests_conversation_idx").on(table.conversationId),
    index("direct_requests_recipient_status_idx").on(
      table.recipientProfileId,
      table.status,
    ),
  ],
);

export const channelNotificationSettings = sqliteTable(
  "channel_notification_settings",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id").notNull(),
    channelId: text("channel_id").notNull(),
    level: text("level", { enum: ["all", "mentions", "none"] })
      .notNull()
      .default("mentions"),
    showUnread: integer("show_unread", { mode: "boolean" }).notNull().default(false),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("channel_notifications_profile_channel_idx").on(
      table.profileId,
      table.channelId,
    ),
    index("channel_notifications_profile_idx").on(table.profileId),
  ],
);

export const channelReads = sqliteTable(
  "channel_reads",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id").notNull(),
    channelId: text("channel_id").notNull(),
    lastReadAt: text("last_read_at").notNull(),
  },
  (table) => [
    uniqueIndex("channel_reads_profile_channel_idx").on(
      table.profileId,
      table.channelId,
    ),
    index("channel_reads_profile_idx").on(table.profileId),
  ],
);

export const communityEvents = sqliteTable(
  "community_events",
  {
    id: text("id").primaryKey(),
    serverId: text("server_id").notNull(),
    creatorProfileId: text("creator_profile_id").notNull(),
    channelId: text("channel_id"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    location: text("location").notNull().default(""),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    recurrence: text("recurrence", { enum: ["none", "weekly", "monthly"] })
      .notNull()
      .default("none"),
    cancelledAt: text("cancelled_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("community_events_server_start_idx").on(table.serverId, table.startsAt),
    index("community_events_creator_idx").on(table.creatorProfileId),
  ],
);

export const eventRsvps = sqliteTable(
  "event_rsvps",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull(),
    profileId: text("profile_id").notNull(),
    response: text("response", { enum: ["going", "interested", "declined"] })
      .notNull(),
    reminderMinutes: integer("reminder_minutes").notNull().default(30),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("event_rsvps_event_profile_idx").on(table.eventId, table.profileId),
    index("event_rsvps_profile_idx").on(table.profileId, table.updatedAt),
  ],
);

export const serverAutoModerationSettings = sqliteTable(
  "server_automod_settings",
  {
    serverId: text("server_id").primaryKey(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    blockedTerms: text("blocked_terms").notNull().default(""),
    blockInviteLinks: integer("block_invite_links", { mode: "boolean" })
      .notNull()
      .default(true),
    blockDuplicateMessages: integer("block_duplicate_messages", { mode: "boolean" })
      .notNull()
      .default(true),
    maxMentions: integer("max_mentions").notNull().default(8),
    blockedDomains: text("blocked_domains").notNull().default(""),
    maxMessagesPerMinute: integer("max_messages_per_minute").notNull().default(12),
    raidJoinLimit: integer("raid_join_limit").notNull().default(10),
    exemptChannelIds: text("exempt_channel_ids").notNull().default("[]"),
    updatedByProfileId: text("updated_by_profile_id").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
);

export const customEmojis = sqliteTable(
  "custom_emojis",
  {
    id: text("id").primaryKey(),
    serverId: text("server_id").notNull(),
    name: text("name").notNull(),
    storageKey: text("storage_key").notNull(),
    uploaderProfileId: text("uploader_profile_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("custom_emojis_server_name_idx").on(table.serverId, table.name),
    index("custom_emojis_server_idx").on(table.serverId),
  ],
);

export const messageBookmarks = sqliteTable(
  "message_bookmarks",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id").notNull(),
    messageId: text("message_id").notNull(),
    note: text("note").notNull().default(""),
    remindAt: text("remind_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("message_bookmarks_profile_message_idx").on(
      table.profileId,
      table.messageId,
    ),
    index("message_bookmarks_profile_reminder_idx").on(
      table.profileId,
      table.remindAt,
    ),
  ],
);

export const polls = sqliteTable(
  "polls",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id").notNull(),
    channelId: text("channel_id").notNull(),
    creatorProfileId: text("creator_profile_id").notNull(),
    question: text("question").notNull(),
    allowMultiple: integer("allow_multiple", { mode: "boolean" }).notNull().default(false),
    closesAt: text("closes_at").notNull(),
    closedAt: text("closed_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("polls_message_idx").on(table.messageId),
    index("polls_channel_created_idx").on(table.channelId, table.createdAt),
  ],
);

export const pollOptions = sqliteTable(
  "poll_options",
  {
    id: text("id").primaryKey(),
    pollId: text("poll_id").notNull(),
    label: text("label").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    uniqueIndex("poll_options_poll_position_idx").on(table.pollId, table.position),
  ],
);

export const pollVotes = sqliteTable(
  "poll_votes",
  {
    id: text("id").primaryKey(),
    pollId: text("poll_id").notNull(),
    optionId: text("option_id").notNull(),
    profileId: text("profile_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("poll_votes_poll_option_profile_idx").on(
      table.pollId,
      table.optionId,
      table.profileId,
    ),
    index("poll_votes_poll_profile_idx").on(table.pollId, table.profileId),
  ],
);

export const messageThreads = sqliteTable(
  "message_threads",
  {
    id: text("id").primaryKey(),
    parentMessageId: text("parent_message_id").notNull(),
    channelId: text("channel_id").notNull(),
    serverId: text("server_id").notNull(),
    creatorProfileId: text("creator_profile_id").notNull(),
    title: text("title").notNull(),
    locked: integer("locked", { mode: "boolean" }).notNull().default(false),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("message_threads_parent_idx").on(table.parentMessageId),
    index("message_threads_channel_updated_idx").on(table.channelId, table.updatedAt),
  ],
);

export const threadMessages = sqliteTable(
  "thread_messages",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id").notNull(),
    authorProfileId: text("author_profile_id").notNull(),
    content: text("content").notNull(),
    editedAt: text("edited_at"),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("thread_messages_thread_created_idx").on(table.threadId, table.createdAt),
    index("thread_messages_author_idx").on(table.authorProfileId),
  ],
);

export const serverGuides = sqliteTable("server_guides", {
  serverId: text("server_id").primaryKey(),
  welcomeMessage: text("welcome_message").notNull().default("Aramıza hoş geldin!"),
  rulesChannelId: text("rules_channel_id"),
  updatedByProfileId: text("updated_by_profile_id").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const serverGuideProgress = sqliteTable(
  "server_guide_progress",
  {
    id: text("id").primaryKey(),
    serverId: text("server_id").notNull(),
    profileId: text("profile_id").notNull(),
    completedSteps: text("completed_steps").notNull().default("[]"),
    completedAt: text("completed_at"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("server_guide_progress_server_profile_idx").on(
      table.serverId,
      table.profileId,
    ),
    index("server_guide_progress_profile_idx").on(table.profileId, table.updatedAt),
  ],
);
