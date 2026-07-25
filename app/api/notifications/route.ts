import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import {
  channelNotificationSettings,
  channels,
  friendships,
  messageMentions,
  messages,
  servers,
} from "@/db/schema";
import { requireProfile } from "@/lib/community";
import {
  apiError,
  apiJson,
  assertTrustedMutation,
  enforceRateLimit,
  readJson,
  requireIdentity,
} from "@/lib/security";
import { getDb } from "@/db";

export async function GET(request: Request) {
  try {
    const identity = requireIdentity(request);
    const profile = await requireProfile(identity);
    const db = getDb();
    await enforceRateLimit(request, "notifications-list", identity.email, 30, 60_000);
    const mentionRows = await db
      .select()
      .from(messageMentions)
      .where(
        and(
          eq(messageMentions.profileId, profile.id),
          isNull(messageMentions.readAt),
        ),
      )
      .orderBy(desc(messageMentions.createdAt))
      .limit(50);
    if (!mentionRows.length) return apiJson({ notifications: [], unreadCount: 0 });
    const messageRows = await db
      .select()
      .from(messages)
      .where(inArray(messages.id, mentionRows.map((item) => item.messageId)));
    const channelIds = Array.from(new Set(messageRows.map((item) => item.channelId)));
    const channelRows = channelIds.length
      ? await db.select().from(channels).where(inArray(channels.id, channelIds))
      : [];
    const notificationSettings = channelIds.length
      ? await db
          .select()
          .from(channelNotificationSettings)
          .where(
            and(
              eq(channelNotificationSettings.profileId, profile.id),
              inArray(channelNotificationSettings.channelId, channelIds),
            ),
          )
      : [];
    const blockedRows = await db
      .select({
        requesterProfileId: friendships.requesterProfileId,
        addresseeProfileId: friendships.addresseeProfileId,
      })
      .from(friendships)
      .where(
        and(
          eq(friendships.status, "blocked"),
          or(
            eq(friendships.requesterProfileId, profile.id),
            eq(friendships.addresseeProfileId, profile.id),
          ),
        ),
      );
    const blockedProfileIds = new Set(
      blockedRows.map((item) =>
        item.requesterProfileId === profile.id
          ? item.addresseeProfileId
          : item.requesterProfileId,
      ),
    );
    const mutedChannelIds = new Set(
      notificationSettings
        .filter((setting) => setting.level === "none")
        .map((setting) => setting.channelId),
    );
    const serverIds = Array.from(new Set(channelRows.map((item) => item.serverId)));
    const serverRows = serverIds.length
      ? await db.select().from(servers).where(inArray(servers.id, serverIds))
      : [];
    const messageById = new Map(messageRows.map((item) => [item.id, item]));
    const channelById = new Map(channelRows.map((item) => [item.id, item]));
    const serverById = new Map(serverRows.map((item) => [item.id, item]));
    const notifications = mentionRows
      .map((mention) => {
        const message = messageById.get(mention.messageId);
        const channel = message ? channelById.get(message.channelId) : undefined;
        const server = channel ? serverById.get(channel.serverId) : undefined;
        if (
          !message ||
          !channel ||
          !server ||
          message.deletedAt ||
          (message.authorProfileId && blockedProfileIds.has(message.authorProfileId)) ||
          mutedChannelIds.has(channel.id)
        ) {
          return null;
        }
        return {
          id: mention.id,
          messageId: message.id,
          serverId: server.id,
          serverName: server.name,
          channelId: channel.id,
          channelName: channel.name,
          authorName: message.authorName,
          content: message.content.slice(0, 180),
          createdAt: mention.createdAt,
        };
      })
      .filter(Boolean);
    return apiJson({ notifications, unreadCount: notifications.length });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = requireIdentity(request);
    const profile = await requireProfile(identity);
    await enforceRateLimit(request, "notifications-read", identity.email, 30, 60_000);
    const payload = await readJson<{ id?: string; all?: boolean }>(request, 2_048);
    const db = getDb();
    const now = new Date().toISOString();
    if (payload.all) {
      await db
        .update(messageMentions)
        .set({ readAt: now })
        .where(eq(messageMentions.profileId, profile.id));
      return apiJson({ ok: true });
    }
    if (typeof payload.id !== "string" || !payload.id) {
      return apiJson({ error: "Bildirim bulunamadı." }, { status: 400 });
    }
    await db
      .update(messageMentions)
      .set({ readAt: now })
      .where(
        and(
          eq(messageMentions.id, payload.id),
          eq(messageMentions.profileId, profile.id),
        ),
      );
    return apiJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
