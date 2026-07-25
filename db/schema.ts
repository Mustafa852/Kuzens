import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const servers = sqliteTable("servers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("K"),
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
    authorName: text("author_name").notNull(),
    authorTag: text("author_tag").notNull(),
    content: text("content").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("messages_channel_created_idx").on(table.channelId, table.createdAt)],
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
