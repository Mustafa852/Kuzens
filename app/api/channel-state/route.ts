import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  channelNotificationSettings,
  channelReads,
  channels,
  messageMentions,
  messages,
} from "@/db/schema";
import { DEFAULT_SERVER_ID, requireMember } from "@/lib/community";
import {
  ApiError,
  apiError,
  apiJson,
  assertTrustedMutation,
  cleanText,
  enforceRateLimit,
  readJson,
  requireIdentity,
} from "@/lib/security";

type ChannelStatePayload = {
  action?: "read" | "settings";
  serverId?: string;
  channelId?: string;
  level?: "all" | "mentions" | "none";
  showUnread?: boolean;
};

export async function GET(request: Request) {
  try {
    const identity = requireIdentity(request);
    const serverId = cleanText(
      new URL(request.url).searchParams.get("server") || DEFAULT_SERVER_ID,
      { max: 80 },
    );
    const { db, profile } = await requireMember(identity, serverId);
    const channelRows = await db
      .select()
      .from(channels)
      .where(and(eq(channels.serverId, serverId), eq(channels.kind, "text")));
    const channelIds = channelRows.map((channel) => channel.id);
    if (!channelIds.length) return apiJson({ states: [] });

    const [readRows, settingRows, messageRows, mentionRows] = await Promise.all([
      db
        .select()
        .from(channelReads)
        .where(
          and(
            eq(channelReads.profileId, profile.id),
            inArray(channelReads.channelId, channelIds),
          ),
        ),
      db
        .select()
        .from(channelNotificationSettings)
        .where(
          and(
            eq(channelNotificationSettings.profileId, profile.id),
            inArray(channelNotificationSettings.channelId, channelIds),
          ),
        ),
      db
        .select({
          id: messages.id,
          channelId: messages.channelId,
          authorProfileId: messages.authorProfileId,
          deletedAt: messages.deletedAt,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(inArray(messages.channelId, channelIds))
        .orderBy(desc(messages.createdAt))
        .limit(2_000),
      db
        .select({
          id: messageMentions.id,
          channelId: messages.channelId,
        })
        .from(messageMentions)
        .innerJoin(messages, eq(messageMentions.messageId, messages.id))
        .where(
          and(
            eq(messageMentions.profileId, profile.id),
            isNull(messageMentions.readAt),
            inArray(messages.channelId, channelIds),
          ),
        ),
    ]);

    const now = new Date().toISOString();
    const states = channelRows.map((channel) => {
      const read = readRows.find((item) => item.channelId === channel.id);
      const setting = settingRows.find((item) => item.channelId === channel.id);
      const lastReadAt = read?.lastReadAt || now;
      const unreadCount = messageRows.filter(
        (message) =>
          message.channelId === channel.id &&
          !message.deletedAt &&
          message.authorProfileId !== profile.id &&
          message.createdAt > lastReadAt,
      ).length;
      return {
        channelId: channel.id,
        unreadCount,
        mentionCount: mentionRows.filter((mention) => mention.channelId === channel.id).length,
        level: setting?.level || "mentions",
        showUnread: setting?.showUnread || false,
      };
    });
    return apiJson({ states });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = requireIdentity(request);
    const payload = await readJson<ChannelStatePayload>(request, 4_096);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const channelId = cleanText(payload.channelId, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await enforceRateLimit(request, "channel-state", identity.email, 120, 60_000);
    const [channel] = await db
      .select()
      .from(channels)
      .where(
        and(
          eq(channels.id, channelId),
          eq(channels.serverId, serverId),
          eq(channels.kind, "text"),
        ),
      )
      .limit(1);
    if (!channel) throw new ApiError(404, "Metin odası bulunamadı.");
    const now = new Date().toISOString();

    if (payload.action === "read") {
      await db
        .insert(channelReads)
        .values({
          id: `${profile.id}:${channelId}`,
          profileId: profile.id,
          channelId,
          lastReadAt: now,
        })
        .onConflictDoUpdate({
          target: [channelReads.profileId, channelReads.channelId],
          set: { lastReadAt: now },
        });
      const channelMessages = await db
        .select({ id: messages.id })
        .from(messages)
        .where(eq(messages.channelId, channelId));
      const messageIds = channelMessages.map((message) => message.id);
      if (messageIds.length) {
        await db
          .update(messageMentions)
          .set({ readAt: now })
          .where(
            and(
              eq(messageMentions.profileId, profile.id),
              inArray(messageMentions.messageId, messageIds),
            ),
          );
      }
      return apiJson({ ok: true, lastReadAt: now });
    }

    if (payload.action === "settings") {
      if (!["all", "mentions", "none"].includes(payload.level || "")) {
        throw new ApiError(400, "Bildirim düzeyi geçersiz.");
      }
      await db
        .insert(channelNotificationSettings)
        .values({
          id: `${profile.id}:${channelId}`,
          profileId: profile.id,
          channelId,
          level: payload.level!,
          showUnread: Boolean(payload.showUnread),
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            channelNotificationSettings.profileId,
            channelNotificationSettings.channelId,
          ],
          set: {
            level: payload.level!,
            showUnread: Boolean(payload.showUnread),
            updatedAt: now,
          },
        });
      return apiJson({ ok: true });
    }

    throw new ApiError(400, "Kanal durumu işlemi geçersiz.");
  } catch (error) {
    return apiError(error);
  }
}
