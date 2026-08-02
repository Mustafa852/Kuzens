import { and, asc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import {
  channels,
  channelCanvases,
  contentReports,
  channelPermissionOverwrites,
  channelNotificationSettings,
  channelReads,
  communityEvents,
  messageBookmarks,
  messageAttachments,
  messageMentions,
  messageReactions,
  messageThreads,
  messages,
  pollOptions,
  polls,
  pollVotes,
  rtcSignals,
  scheduledMessages,
  serverAuraMemberships,
  threadMessages,
} from "@/db/schema";
import {
  DEFAULT_SERVER_ID,
  PERMISSIONS,
  channelPermissionsFor,
  requireMember,
  requirePermission,
  writeAudit,
} from "@/lib/community";
import {
  apiError,
  apiJson,
  assertTrustedMutation,
  cleanText,
  enforceRateLimit,
  readJson,
  requireIdentity,
} from "@/lib/security";
import { getUploads } from "@/lib/storage";

type ChannelPayload = {
  action?: "reorder";
  id?: string;
  name?: string;
  kind?: "text" | "voice" | "forum" | "announcement";
  categoryId?: string | null;
  serverId?: string;
  topic?: string;
  slowModeSeconds?: number;
  bitrate?: number;
  userLimit?: number;
  region?: string;
  historyMode?: "all" | "since_join";
  orderedIds?: string[];
};

function channelName(value: unknown) {
  return cleanText(value, { max: 32 })
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9ğüşöçı_-]/g, "");
}

async function maxVoiceBitrate(
  db: ReturnType<typeof import("@/db").getDb>,
  serverId: string,
  isPlatformOwner: boolean,
) {
  if (isPlatformOwner) return 384_000;
  const [membership] = await db
    .select({ tier: serverAuraMemberships.tier })
    .from(serverAuraMemberships)
    .where(
      and(
        eq(serverAuraMemberships.serverId, serverId),
        or(
          isNull(serverAuraMemberships.expiresAt),
          gt(serverAuraMemberships.expiresAt, new Date().toISOString()),
        ),
      ),
    )
    .limit(1);
  return membership ? [64_000, 128_000, 192_000, 256_000][membership.tier] || 128_000 : 64_000;
}

export async function GET(request: Request) {
  try {
    const identity = await requireIdentity(request);
    const serverId = cleanText(
      new URL(request.url).searchParams.get("server") || DEFAULT_SERVER_ID,
      { max: 80 },
    );
    const { db, profile } = await requireMember(identity, serverId);
    const rows = await db
      .select()
      .from(channels)
      .where(eq(channels.serverId, serverId))
      .orderBy(asc(channels.position));
    const visibleRows = (
      await Promise.all(
        rows.map(async (channel) => ({
          channel,
          permissions: await channelPermissionsFor(
            profile,
            serverId,
            channel.id,
          ),
        })),
      )
    )
      .filter(
        ({ permissions }) =>
          (permissions & PERMISSIONS.viewChannels) !== 0,
      )
      .map(({ channel, permissions }) => ({
        ...channel,
        permissions,
      }));
    return apiJson({ channels: visibleRows });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    const payload = await readJson<ChannelPayload>(request, 4_096);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await requirePermission(profile, PERMISSIONS.manageChannels, serverId);
    await enforceRateLimit(request, "channel-create", identity.email, 10, 60 * 60_000);
    const name = channelName(payload.name);
    const kind = (["text", "voice", "forum", "announcement"] as const).includes(
      payload.kind || "text",
    )
      ? (payload.kind || "text") as "text" | "voice" | "forum" | "announcement"
      : "text";
    const categoryId = payload.categoryId
      ? cleanText(payload.categoryId, { max: 100 })
      : null;
    if (categoryId) {
      const { channelCategories } = await import("@/db/schema");
      const [category] = await db
        .select({ id: channelCategories.id })
        .from(channelCategories)
        .where(and(eq(channelCategories.id, categoryId), eq(channelCategories.serverId, serverId)))
        .limit(1);
      if (!category) return apiJson({ error: "Kategori bulunamadı." }, { status: 404 });
    }
    const bitrateLimit = await maxVoiceBitrate(db, serverId, profile.isOwner);
    const bitrate =
      kind === "voice" && Number.isInteger(payload.bitrate)
        ? Math.max(16_000, Math.min(bitrateLimit, Number(payload.bitrate)))
        : 64_000;
    const userLimit =
      kind === "voice" && Number.isInteger(payload.userLimit)
        ? Math.max(0, Math.min(99, Number(payload.userLimit)))
        : 0;

    if (!name) return apiJson({ error: "Geçerli bir oda adı gir." }, { status: 400 });
    const existing = await db
      .select()
      .from(channels)
      .where(eq(channels.serverId, serverId));
    if (existing.some((channel) => channel.name.toLocaleLowerCase("tr-TR") === name)) {
      return apiJson({ error: "Bu isimde bir oda zaten var." }, { status: 409 });
    }

    const channel = {
      id: `${name}-${crypto.randomUUID().slice(0, 8)}`,
      serverId,
      name,
      kind,
      categoryId,
      bitrate,
      userLimit,
      region: kind === "voice" ? cleanText(payload.region || "auto", { max: 24 }) : "auto",
      historyMode: payload.historyMode === "since_join" ? "since_join" as const : "all" as const,
      position: existing.length,
      createdAt: new Date().toISOString(),
    };
    await db.insert(channels).values(channel);
    await writeAudit(profile.id, "channel.create", channel.id, `${kind}:${name}`, serverId);
    return apiJson({ channel }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    const payload = await readJson<ChannelPayload>(request, 4_096);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await requirePermission(profile, PERMISSIONS.manageChannels, serverId);
    await enforceRateLimit(request, "channel-update", identity.email, 20, 60 * 60_000);
    if (payload.action === "reorder") {
      if (
        !Array.isArray(payload.orderedIds) ||
        !payload.orderedIds.every((id) => typeof id === "string")
      ) {
        return apiJson({ error: "Oda sıralaması geçersiz." }, { status: 400 });
      }
      const existingChannels = await db
        .select({ id: channels.id })
        .from(channels)
        .where(eq(channels.serverId, serverId));
      const expected = new Set(existingChannels.map((channel) => channel.id));
      const received = new Set(payload.orderedIds);
      if (
        received.size !== expected.size ||
        payload.orderedIds.length !== expected.size ||
        payload.orderedIds.some((id) => !expected.has(id))
      ) {
        return apiJson({ error: "Sıralama tüm odaları tam olarak içermeli." }, { status: 400 });
      }
      for (const [position, channelId] of payload.orderedIds.entries()) {
        await db
          .update(channels)
          .set({ position })
          .where(
            and(
              eq(channels.id, channelId),
              eq(channels.serverId, serverId),
            ),
          );
      }
      await writeAudit(profile.id, "channel.reorder", serverId, `${received.size} oda`, serverId);
      return apiJson({ ok: true });
    }
    const id = cleanText(payload.id, { max: 80 });
    const name = channelName(payload.name);
    const topic =
      typeof payload.topic === "string"
        ? cleanText(payload.topic, { min: 0, max: 160, multiline: true })
        : "";
    const slowModeSeconds = Number(payload.slowModeSeconds || 0);
    if (
      !Number.isInteger(slowModeSeconds) ||
      slowModeSeconds < 0 ||
      slowModeSeconds > 21_600
    ) {
      return apiJson({ error: "Geçersiz yavaş mod süresi." }, { status: 400 });
    }
    const [existing] = await db
      .select()
      .from(channels)
      .where(and(eq(channels.id, id), eq(channels.serverId, serverId)))
      .limit(1);
    if (!existing) return apiJson({ error: "Oda bulunamadı." }, { status: 404 });
    const bitrateLimit = await maxVoiceBitrate(db, serverId, profile.isOwner);
    const bitrate = Number(payload.bitrate ?? existing.bitrate ?? 64_000);
    const userLimit = Number(payload.userLimit ?? existing.userLimit ?? 0);
    if (
      !Number.isInteger(bitrate) ||
      bitrate < 16_000 ||
      bitrate > bitrateLimit ||
      !Number.isInteger(userLimit) ||
      userLimit < 0 ||
      userLimit > 99
    ) {
      return apiJson({ error: "Ses odası kapasitesi veya bit hızı geçersiz." }, { status: 400 });
    }
    const region = cleanText(payload.region || existing.region || "auto", {
      max: 24,
    });
    const categoryId = payload.categoryId === null
      ? null
      : payload.categoryId
        ? cleanText(payload.categoryId, { max: 100 })
        : existing.categoryId;
    if (categoryId) {
      const { channelCategories } = await import("@/db/schema");
      const [category] = await db
        .select({ id: channelCategories.id })
        .from(channelCategories)
        .where(and(eq(channelCategories.id, categoryId), eq(channelCategories.serverId, serverId)))
        .limit(1);
      if (!category) return apiJson({ error: "Kategori bulunamadı." }, { status: 404 });
    }
    const historyMode = payload.historyMode === "since_join" ? "since_join" : "all";

    await db
      .update(channels)
      .set({ name, topic, slowModeSeconds, bitrate, userLimit, region, categoryId, historyMode })
      .where(eq(channels.id, id));
    await writeAudit(
      profile.id,
      "channel.update",
      id,
      `${name}:${slowModeSeconds}`,
      serverId,
    );
    return apiJson({
      channel: {
        ...existing,
        name,
        topic,
        slowModeSeconds,
        bitrate,
        userLimit,
        region,
        categoryId,
        historyMode,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    const payload = await readJson<ChannelPayload>(request, 2_048);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await requirePermission(profile, PERMISSIONS.manageChannels, serverId);
    await enforceRateLimit(request, "channel-delete", identity.email, 10, 60 * 60_000);
    const id = cleanText(payload.id, { max: 80 });
    if (id === "genel" || id === `${serverId}:genel`) {
      return apiJson({ error: "#genel odası güvenlik için silinemez." }, { status: 400 });
    }
    const [existing] = await db
      .select()
      .from(channels)
      .where(and(eq(channels.id, id), eq(channels.serverId, serverId)))
      .limit(1);
    if (!existing) return apiJson({ error: "Oda bulunamadı." }, { status: 404 });
    const messageRows = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.channelId, id));
    const messageIds = messageRows.map((message) => message.id);
    const [pollRows, threadRows] = await Promise.all([
      db.select({ id: polls.id }).from(polls).where(eq(polls.channelId, id)),
      db
        .select({ id: messageThreads.id })
        .from(messageThreads)
        .where(eq(messageThreads.channelId, id)),
    ]);
    const pollIds = pollRows.map((poll) => poll.id);
    const threadIds = threadRows.map((thread) => thread.id);
    if (pollIds.length) {
      await db.delete(pollVotes).where(inArray(pollVotes.pollId, pollIds));
      await db.delete(pollOptions).where(inArray(pollOptions.pollId, pollIds));
      await db.delete(polls).where(inArray(polls.id, pollIds));
    }
    if (threadIds.length) {
      await db.delete(threadMessages).where(inArray(threadMessages.threadId, threadIds));
      await db.delete(messageThreads).where(inArray(messageThreads.id, threadIds));
    }
    if (messageIds.length) {
      const attachmentRows = await db
        .select()
        .from(messageAttachments)
        .where(inArray(messageAttachments.messageId, messageIds));
      await Promise.all(attachmentRows.map((attachment) => getUploads().delete(attachment.storageKey).catch(() => undefined)));
      await db.delete(messageAttachments).where(inArray(messageAttachments.messageId, messageIds));
      await db.delete(messageMentions).where(inArray(messageMentions.messageId, messageIds));
      await db.delete(messageReactions).where(inArray(messageReactions.messageId, messageIds));
      await db.delete(messageBookmarks).where(inArray(messageBookmarks.messageId, messageIds));
      await db.delete(contentReports).where(and(eq(contentReports.targetType, "message"), inArray(contentReports.targetId, messageIds)));
    }
    await db
      .update(communityEvents)
      .set({ channelId: null })
      .where(eq(communityEvents.channelId, id));
    await db
      .delete(channelNotificationSettings)
      .where(eq(channelNotificationSettings.channelId, id));
    await db.delete(channelCanvases).where(eq(channelCanvases.channelId, id));
    await db.delete(scheduledMessages).where(eq(scheduledMessages.channelId, id));
    await db.delete(channelReads).where(eq(channelReads.channelId, id));
    await db
      .delete(channelPermissionOverwrites)
      .where(eq(channelPermissionOverwrites.channelId, id));
    const { channelMemberPermissionOverwrites } = await import("@/db/schema");
    await db
      .delete(channelMemberPermissionOverwrites)
      .where(eq(channelMemberPermissionOverwrites.channelId, id));
    await db.delete(messages).where(eq(messages.channelId, id));
    await db.delete(rtcSignals).where(eq(rtcSignals.channelId, id));
    await db.delete(channels).where(eq(channels.id, id));
    await writeAudit(profile.id, "channel.delete", id, existing.name, serverId);
    return apiJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
