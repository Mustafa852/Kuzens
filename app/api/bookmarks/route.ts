import { and, desc, eq, inArray } from "drizzle-orm";
import {
  channels,
  messageBookmarks,
  messages,
  serverMembers,
  servers,
} from "@/db/schema";
import { requireMember, requireProfile } from "@/lib/community";
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

type BookmarkPayload = {
  messageId?: string;
  note?: string;
  remindAt?: string | null;
};

function parseReminder(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new ApiError(400, "Hatırlatma zamanı geçersiz.");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, "Hatırlatma zamanı geçersiz.");
  if (date.getTime() < Date.now() - 60_000) {
    throw new ApiError(400, "Hatırlatma geçmişte olamaz.");
  }
  if (date.getTime() > Date.now() + 365 * 24 * 60 * 60 * 1_000) {
    throw new ApiError(400, "Hatırlatma en fazla bir yıl sonrasına ayarlanabilir.");
  }
  return date.toISOString();
}

export async function GET(request: Request) {
  try {
    const identity = await requireIdentity(request);
    const profile = await requireProfile(identity);
    const db = getDb();
    const rows = await db
      .select()
      .from(messageBookmarks)
      .where(eq(messageBookmarks.profileId, profile.id))
      .orderBy(desc(messageBookmarks.updatedAt))
      .limit(200);
    if (!rows.length) return apiJson({ bookmarks: [] });
    const messageRows = await db
      .select({
        id: messages.id,
        channelId: messages.channelId,
        authorName: messages.authorName,
        authorTag: messages.authorTag,
        content: messages.content,
        deletedAt: messages.deletedAt,
        createdAt: messages.createdAt,
        channelName: channels.name,
        serverId: channels.serverId,
        serverName: servers.name,
      })
      .from(messages)
      .innerJoin(channels, eq(messages.channelId, channels.id))
      .innerJoin(servers, eq(channels.serverId, servers.id))
      .where(inArray(messages.id, rows.map((row) => row.messageId)));
    const [memberRows, ownedRows] = await Promise.all([
      db
        .select({ serverId: serverMembers.serverId })
        .from(serverMembers)
        .where(eq(serverMembers.profileId, profile.id)),
      db
        .select({ id: servers.id })
        .from(servers)
        .where(eq(servers.ownerProfileId, profile.id)),
    ]);
    const allowedServers = new Set([
      ...memberRows.map((item) => item.serverId),
      ...ownedRows.map((item) => item.id),
    ]);
    const bookmarks = rows.flatMap((bookmark) => {
      const message = messageRows.find((item) => item.id === bookmark.messageId);
      if (!message || !allowedServers.has(message.serverId)) return [];
      return [{
        ...bookmark,
        message: {
          ...message,
          content: message.deletedAt ? "Bu mesaj silindi." : message.content,
        },
        reminderDue: Boolean(
          bookmark.remindAt && new Date(bookmark.remindAt).getTime() <= Date.now(),
        ),
      }];
    });
    return apiJson({ bookmarks });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    const profile = await requireProfile(identity);
    await enforceRateLimit(request, "bookmark-save", identity.email, 40, 60_000);
    const payload = await readJson<BookmarkPayload>(request, 4_096);
    const messageId = cleanText(payload.messageId, { max: 80 });
    const db = getDb();
    const [message] = await db
      .select({ id: messages.id, serverId: channels.serverId })
      .from(messages)
      .innerJoin(channels, eq(messages.channelId, channels.id))
      .where(eq(messages.id, messageId))
      .limit(1);
    if (!message) throw new ApiError(404, "Mesaj bulunamadı.");
    await requireMember(identity, message.serverId);
    const note = cleanText(payload.note || "", { min: 0, max: 240, multiline: true });
    const remindAt = parseReminder(payload.remindAt);
    const now = new Date().toISOString();
    await db
      .insert(messageBookmarks)
      .values({
        id: `${profile.id}:${messageId}`,
        profileId: profile.id,
        messageId,
        note,
        remindAt,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [messageBookmarks.profileId, messageBookmarks.messageId],
        set: { note, remindAt, updatedAt: now },
      });
    return apiJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    const profile = await requireProfile(identity);
    await enforceRateLimit(request, "bookmark-delete", identity.email, 40, 60_000);
    const payload = await readJson<BookmarkPayload>(request, 2_048);
    const messageId = cleanText(payload.messageId, { max: 80 });
    const db = getDb();
    await db
      .delete(messageBookmarks)
      .where(
        and(
          eq(messageBookmarks.profileId, profile.id),
          eq(messageBookmarks.messageId, messageId),
        ),
      );
    return apiJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
