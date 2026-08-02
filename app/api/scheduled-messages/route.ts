import { and, asc, eq, inArray } from "drizzle-orm";
import { channels, messages, scheduledMessages, serverMembers, servers } from "@/db/schema";
import {
  PERMISSIONS,
  permissionsFor,
  requireChannelPermission,
  requireMember,
  requireProfile,
} from "@/lib/community";
import { autoModError, checkAutoModeration } from "@/lib/automod";
import { getDb } from "@/db";
import { publishDueScheduledMessages, publishScheduledMessage } from "@/lib/scheduled-messages";
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

type ScheduledPayload = {
  id?: string;
  serverId?: string;
  channelId?: string;
  content?: string;
  replyToId?: string | null;
  sendAt?: string;
  action?: "send_now" | "reschedule";
};

function parseSendAt(value: unknown, allowNow = false) {
  if (typeof value !== "string") throw new ApiError(400, "Gönderim zamanı geçersiz.");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, "Gönderim zamanı geçersiz.");
  const minimum = Date.now() + (allowNow ? -5_000 : 60_000);
  if (date.getTime() < minimum) {
    throw new ApiError(400, "Mesajı en az bir dakika sonrasına planlamalısın.");
  }
  if (date.getTime() > Date.now() + 365 * 24 * 60 * 60 * 1_000) {
    throw new ApiError(400, "Mesaj en fazla bir yıl sonrasına planlanabilir.");
  }
  return date.toISOString();
}

async function requireTargetChannel(
  db: ReturnType<typeof getDb>,
  serverId: string,
  channelId: string,
) {
  const [channel] = await db
    .select()
    .from(channels)
    .where(and(eq(channels.id, channelId), eq(channels.serverId, serverId)))
    .limit(1);
  if (!channel) throw new ApiError(404, "Oda bulunamadı.");
  return channel;
}

export async function GET(request: Request) {
  try {
    const identity = await requireIdentity(request);
    const profile = await requireProfile(identity);
    const db = getDb();
    await publishDueScheduledMessages(db, { authorProfileId: profile.id, limit: 25 });
    const rows = await db
      .select({
        id: scheduledMessages.id,
        serverId: scheduledMessages.serverId,
        channelId: scheduledMessages.channelId,
        content: scheduledMessages.content,
        replyToId: scheduledMessages.replyToId,
        sendAt: scheduledMessages.sendAt,
        status: scheduledMessages.status,
        sentMessageId: scheduledMessages.sentMessageId,
        failureReason: scheduledMessages.failureReason,
        createdAt: scheduledMessages.createdAt,
        updatedAt: scheduledMessages.updatedAt,
        channelName: channels.name,
        serverName: servers.name,
      })
      .from(scheduledMessages)
      .innerJoin(channels, eq(scheduledMessages.channelId, channels.id))
      .innerJoin(servers, eq(scheduledMessages.serverId, servers.id))
      .where(
        and(
          eq(scheduledMessages.authorProfileId, profile.id),
          inArray(scheduledMessages.status, ["pending", "failed"]),
        ),
      )
      .orderBy(asc(scheduledMessages.sendAt))
      .limit(100);
    return apiJson({ scheduledMessages: rows });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    await enforceRateLimit(request, "message-schedule", identity.email, 20, 60_000);
    const payload = await readJson<ScheduledPayload>(request, 8_192);
    const serverId = cleanText(payload.serverId, { max: 80 });
    const channelId = cleanText(payload.channelId, { max: 80 });
    const content = cleanText(payload.content, { max: 2_000, multiline: true });
    const sendAt = parseSendAt(payload.sendAt);
    const { db, profile } = await requireMember(identity, serverId);
    const channel = await requireTargetChannel(db, serverId, channelId);
    await requireChannelPermission(profile, PERMISSIONS.sendMessages, serverId, channelId);
    const [membership] = await db
      .select({ timeoutUntil: serverMembers.timeoutUntil })
      .from(serverMembers)
      .where(
        and(
          eq(serverMembers.serverId, serverId),
          eq(serverMembers.profileId, profile.id),
        ),
      )
      .limit(1);
    if (membership?.timeoutUntil && membership.timeoutUntil > new Date().toISOString()) {
      throw new ApiError(403, "Timeout süren bitene kadar mesaj planlayamazsın.");
    }
    const permissions = await permissionsFor(profile, serverId);
    if (
      (content.includes("@everyone") || content.includes("@here")) &&
      (permissions & (PERMISSIONS.manageServer | PERMISSIONS.manageMessages)) === 0
    ) {
      throw new ApiError(403, "@everyone ve @here yalnızca yetkili roller tarafından kullanılabilir.");
    }
    const autoModReason = await checkAutoModeration({
      db,
      profile,
      serverId,
      channelId,
      content,
    });
    if (autoModReason) throw new ApiError(422, autoModError(autoModReason));
    let replyToId: string | null = null;
    if (payload.replyToId) {
      replyToId = cleanText(payload.replyToId, { max: 80 });
      const [reply] = await db
        .select({ id: messages.id })
        .from(messages)
        .where(and(eq(messages.id, replyToId), eq(messages.channelId, channelId)))
        .limit(1);
      if (!reply) throw new ApiError(400, "Yanıtlanan mesaj bulunamadı.");
    }
    const now = new Date().toISOString();
    const scheduled = {
      id: crypto.randomUUID(),
      serverId,
      channelId,
      authorProfileId: profile.id,
      content,
      replyToId,
      sendAt,
      status: "pending" as const,
      sentMessageId: null,
      failureReason: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(scheduledMessages).values(scheduled);
    return apiJson({ scheduledMessage: { ...scheduled, channelName: channel.name } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    const profile = await requireProfile(identity);
    await enforceRateLimit(request, "message-schedule-update", identity.email, 30, 60_000);
    const payload = await readJson<ScheduledPayload>(request, 4_096);
    const id = cleanText(payload.id, { max: 80 });
    const db = getDb();
    const [row] = await db
      .select()
      .from(scheduledMessages)
      .where(
        and(
          eq(scheduledMessages.id, id),
          eq(scheduledMessages.authorProfileId, profile.id),
        ),
      )
      .limit(1);
    if (!row) throw new ApiError(404, "Planlanan mesaj bulunamadı.");
    if (row.status !== "pending") throw new ApiError(409, "Bu plan artık değiştirilemez.");
    await requireMember(identity, row.serverId);
    if (payload.action === "send_now") {
      const sendAt = new Date().toISOString();
      const updated = { ...row, sendAt, updatedAt: sendAt };
      await db
        .update(scheduledMessages)
        .set({ sendAt, updatedAt: sendAt })
        .where(eq(scheduledMessages.id, row.id));
      const sentMessageId = await publishScheduledMessage(db, updated);
      if (!sentMessageId) throw new ApiError(409, "Mesaj güvenlik denetiminden geçemedi.");
      return apiJson({ ok: true, sentMessageId });
    }
    if (payload.action === "reschedule") {
      const sendAt = parseSendAt(payload.sendAt);
      await db
        .update(scheduledMessages)
        .set({ sendAt, updatedAt: new Date().toISOString() })
        .where(eq(scheduledMessages.id, row.id));
      return apiJson({ ok: true, sendAt });
    }
    throw new ApiError(400, "Planlama işlemi geçersiz.");
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    const profile = await requireProfile(identity);
    await enforceRateLimit(request, "message-schedule-delete", identity.email, 30, 60_000);
    const payload = await readJson<ScheduledPayload>(request, 2_048);
    const id = cleanText(payload.id, { max: 80 });
    const db = getDb();
    await db
      .update(scheduledMessages)
      .set({ status: "cancelled", updatedAt: new Date().toISOString() })
      .where(
        and(
          eq(scheduledMessages.id, id),
          eq(scheduledMessages.authorProfileId, profile.id),
          inArray(scheduledMessages.status, ["pending", "failed"]),
        ),
      );
    return apiJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
