import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
