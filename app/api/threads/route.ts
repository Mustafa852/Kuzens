import { and, asc, eq, inArray, or } from "drizzle-orm";
import {
  channels,
  friendships,
  messages,
  messageThreads,
  profiles,
  threadMessages,
} from "@/db/schema";
import {
  PERMISSIONS,
  permissionsFor,
  requireChannelPermission,
  requireMember,
} from "@/lib/community";
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
import { getDb } from "@/db";
import { autoModError, checkAutoModeration } from "@/lib/automod";

type ThreadPayload = {
  action?: "create" | "reply" | "state";
  serverId?: string;
  channelId?: string;
  parentMessageId?: string;
  threadId?: string;
  title?: string;
  content?: string;
  locked?: boolean;
  archived?: boolean;
  messageId?: string;
};

async function threadWithServer(threadId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      thread: messageThreads,
      channelName: channels.name,
    })
    .from(messageThreads)
    .innerJoin(channels, eq(messageThreads.channelId, channels.id))
    .where(eq(messageThreads.id, threadId))
    .limit(1);
  return row || null;
}

export async function GET(request: Request) {
  try {
    const identity = await requireIdentity(request);
    const threadId = cleanText(
      new URL(request.url).searchParams.get("thread"),
      { max: 80 },
    );
    const row = await threadWithServer(threadId);
    if (!row) throw new ApiError(404, "Konu başlığı bulunamadı.");
    const { db, profile } = await requireMember(identity, row.thread.serverId);
    await requireChannelPermission(
      profile,
      PERMISSIONS.viewChannels,
      row.thread.serverId,
      row.thread.channelId,
    );
    const [parent] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, row.thread.parentMessageId))
      .limit(1);
    const [replies, blockedRows] = await Promise.all([
      db
        .select({
          id: threadMessages.id,
          threadId: threadMessages.threadId,
          authorProfileId: threadMessages.authorProfileId,
          authorName: profiles.displayName,
          authorUsername: profiles.username,
          content: threadMessages.content,
          editedAt: threadMessages.editedAt,
          deletedAt: threadMessages.deletedAt,
          createdAt: threadMessages.createdAt,
        })
        .from(threadMessages)
        .innerJoin(profiles, eq(threadMessages.authorProfileId, profiles.id))
        .where(eq(threadMessages.threadId, threadId))
        .orderBy(asc(threadMessages.createdAt))
        .limit(500),
      db
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
        ),
    ]);
    const blockedProfileIds = new Set(
      blockedRows.map((item) =>
        item.requesterProfileId === profile.id
          ? item.addresseeProfileId
          : item.requesterProfileId,
      ),
    );
    const permissions = await permissionsFor(profile, row.thread.serverId);
    return apiJson({
      thread: {
        ...row.thread,
        channelName: row.channelName,
        parent: parent
          ? {
              id: parent.id,
              authorName: parent.authorName,
              authorTag: parent.authorTag,
              content: parent.deletedAt ? "Bu mesaj silindi." : parent.content,
              createdAt: parent.createdAt,
              blockedAuthor: Boolean(
                parent.authorProfileId &&
                  blockedProfileIds.has(parent.authorProfileId),
              ),
            }
          : null,
      },
      replies: replies.map((reply) => ({
        ...reply,
        blockedAuthor: blockedProfileIds.has(reply.authorProfileId),
      })),
      canManage:
        row.thread.creatorProfileId === profile.id ||
        (permissions & PERMISSIONS.manageMessages) !== 0,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    const payload = await readJson<ThreadPayload>(request, 8_192);

    if (payload.action === "create") {
      await enforceRateLimit(request, "thread-create", identity.email, 12, 60_000);
      const serverId = cleanText(payload.serverId, { max: 80 });
      const channelId = cleanText(payload.channelId, { max: 80 });
      const parentMessageId = cleanText(payload.parentMessageId, { max: 80 });
      const title = cleanText(payload.title, { min: 2, max: 80 });
      const { db, profile } = await requireMember(identity, serverId);
      await requireChannelPermission(
        profile,
        PERMISSIONS.sendMessages,
        serverId,
        channelId,
      );
      const [parent] = await db
        .select({ id: messages.id })
        .from(messages)
        .innerJoin(channels, eq(messages.channelId, channels.id))
        .where(
          and(
            eq(messages.id, parentMessageId),
            eq(messages.channelId, channelId),
            eq(channels.serverId, serverId),
            inArray(channels.kind, ["text", "forum", "announcement"]),
          ),
        )
        .limit(1);
      if (!parent) throw new ApiError(404, "Başlangıç mesajı bulunamadı.");
      const autoModReason = await checkAutoModeration({
        db,
        profile,
        serverId,
        channelId,
        content: title,
      });
      if (autoModReason) throw new ApiError(422, autoModError(autoModReason));
      const now = new Date().toISOString();
      const thread = {
        id: crypto.randomUUID(),
        parentMessageId,
        channelId,
        serverId,
        creatorProfileId: profile.id,
        title,
        locked: false,
        archived: false,
        createdAt: now,
        updatedAt: now,
      };
      try {
        await db.insert(messageThreads).values(thread);
      } catch {
        throw new ApiError(409, "Bu mesaj için zaten bir konu başlığı var.");
      }
      return apiJson({ thread }, { status: 201 });
    }

    if (payload.action === "reply") {
      await enforceRateLimit(request, "thread-reply", identity.email, 40, 60_000);
      const threadId = cleanText(payload.threadId, { max: 80 });
      const row = await threadWithServer(threadId);
      if (!row) throw new ApiError(404, "Konu başlığı bulunamadı.");
      const { db, profile } = await requireMember(identity, row.thread.serverId);
      await requireChannelPermission(
        profile,
        PERMISSIONS.sendMessages,
        row.thread.serverId,
        row.thread.channelId,
      );
      if (row.thread.locked || row.thread.archived) {
        throw new ApiError(409, "Bu konu başlığı yeni yanıtlara kapalı.");
      }
      const content = cleanText(payload.content, {
        min: 1,
        max: 2_000,
        multiline: true,
      });
      const autoModReason = await checkAutoModeration({
        db,
        profile,
        serverId: row.thread.serverId,
        channelId: row.thread.channelId,
        content,
      });
      if (autoModReason) throw new ApiError(422, autoModError(autoModReason));
      const now = new Date().toISOString();
      const reply = {
        id: crypto.randomUUID(),
        threadId,
        authorProfileId: profile.id,
        authorName: profile.displayName,
        authorUsername: profile.username,
        content,
        editedAt: null,
        deletedAt: null,
        createdAt: now,
      };
      await db.insert(threadMessages).values({
        id: reply.id,
        threadId,
        authorProfileId: profile.id,
        content,
        createdAt: now,
      });
      await db
        .update(messageThreads)
        .set({ updatedAt: now })
        .where(eq(messageThreads.id, threadId));
      return apiJson({ reply }, { status: 201 });
    }

    throw new ApiError(400, "Konu başlığı işlemi geçersiz.");
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    const payload = await readJson<ThreadPayload>(request, 4_096);
    const threadId = cleanText(payload.threadId, { max: 80 });
    const row = await threadWithServer(threadId);
    if (!row) throw new ApiError(404, "Konu başlığı bulunamadı.");
    const { db, profile } = await requireMember(identity, row.thread.serverId);
    await enforceRateLimit(request, "thread-state", identity.email, 20, 60_000);
    const permissions = await permissionsFor(profile, row.thread.serverId);
    if (
      row.thread.creatorProfileId !== profile.id &&
      (permissions & PERMISSIONS.manageMessages) === 0
    ) {
      throw new ApiError(403, "Bu konu başlığını yönetme yetkin yok.");
    }
    const title =
      payload.title === undefined
        ? row.thread.title
        : cleanText(payload.title, { min: 2, max: 80 });
    const updatedAt = new Date().toISOString();
    await db
      .update(messageThreads)
      .set({
        title,
        locked: payload.locked ?? row.thread.locked,
        archived: payload.archived ?? row.thread.archived,
        updatedAt,
      })
      .where(eq(messageThreads.id, threadId));
    return apiJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    const payload = await readJson<ThreadPayload>(request, 2_048);
    const messageId = cleanText(payload.messageId, { max: 80 });
    const db = getDb();
    const [reply] = await db
      .select()
      .from(threadMessages)
      .where(eq(threadMessages.id, messageId))
      .limit(1);
    if (!reply) throw new ApiError(404, "Yanıt bulunamadı.");
    const row = await threadWithServer(reply.threadId);
    if (!row) throw new ApiError(404, "Konu başlığı bulunamadı.");
    const { profile } = await requireMember(identity, row.thread.serverId);
    await enforceRateLimit(request, "thread-delete", identity.email, 30, 60_000);
    const permissions = await permissionsFor(profile, row.thread.serverId);
    if (
      reply.authorProfileId !== profile.id &&
      (permissions & PERMISSIONS.manageMessages) === 0
    ) {
      throw new ApiError(403, "Bu yanıtı silme yetkin yok.");
    }
    await db
      .update(threadMessages)
      .set({ content: "", deletedAt: new Date().toISOString() })
      .where(eq(threadMessages.id, messageId));
    return apiJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
