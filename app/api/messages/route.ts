import { and, asc, desc, eq, gt, lte } from "drizzle-orm";
import { channels, messages } from "@/db/schema";
import {
  DEFAULT_SERVER_ID,
  PERMISSIONS,
  permissionsFor,
  requireMember,
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

type MessagePayload = {
  id?: string;
  serverId?: string;
  channelId?: string;
  content?: string;
  replyToId?: string | null;
};

async function requireTextChannel(
  db: Awaited<ReturnType<typeof requireMember>>["db"],
  channelId: string,
  serverId: string,
) {
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
  if (!channel) return null;
  return channel;
}

export async function GET(request: Request) {
  try {
    const identity = requireIdentity(request);
    const url = new URL(request.url);
    const syncBoundary = new Date().toISOString();
    const serverId = cleanText(url.searchParams.get("server") || DEFAULT_SERVER_ID, { max: 80 });
    const { db } = await requireMember(identity, serverId);
    const channelId = cleanText(url.searchParams.get("channel") || "genel", { max: 80 });
    if (!(await requireTextChannel(db, channelId, serverId))) {
      return apiJson({ error: "Metin odası bulunamadı." }, { status: 404 });
    }

    const after = url.searchParams.get("after");
    if (after) {
      const afterDate = new Date(after);
      if (Number.isNaN(afterDate.getTime())) {
        return apiJson({ error: "Geçersiz eşitleme zamanı." }, { status: 400 });
      }
      const rows = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.channelId, channelId),
            gt(messages.createdAt, afterDate.toISOString()),
            lte(messages.createdAt, syncBoundary),
          ),
        )
        .orderBy(asc(messages.createdAt))
        .limit(100);
      return apiJson({ messages: rows, syncedAt: syncBoundary });
    }

    const latest = await db
      .select()
      .from(messages)
      .where(eq(messages.channelId, channelId))
      .orderBy(desc(messages.createdAt))
      .limit(100);
    return apiJson({ messages: latest.reverse(), syncedAt: syncBoundary });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = requireIdentity(request);
    const payload = await readJson<MessagePayload>(request, 8_192);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await enforceRateLimit(request, "message-send", identity.email, 15, 10_000);
    const channelId = cleanText(payload.channelId, { max: 80 });
    const content = cleanText(payload.content, { max: 2_000, multiline: true });
    if (!(await requireTextChannel(db, channelId, serverId))) {
      return apiJson({ error: "Metin odası bulunamadı." }, { status: 404 });
    }

    let replyToId: string | null = null;
    if (payload.replyToId) {
      replyToId = cleanText(payload.replyToId, { max: 80 });
      const [reply] = await db
        .select({ id: messages.id })
        .from(messages)
        .where(and(eq(messages.id, replyToId), eq(messages.channelId, channelId)))
        .limit(1);
      if (!reply) return apiJson({ error: "Yanıtlanan mesaj bulunamadı." }, { status: 400 });
    }

    const message = {
      id: crypto.randomUUID(),
      channelId,
      authorProfileId: profile.id,
      authorName: profile.displayName,
      authorTag: `@${profile.username}`,
      content,
      replyToId,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
    };
    await db.insert(messages).values(message);
    return apiJson({ message }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = requireIdentity(request);
    const payload = await readJson<MessagePayload>(request, 8_192);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await enforceRateLimit(request, "message-edit", identity.email, 20, 60_000);
    const id = cleanText(payload.id, { max: 80 });
    const content = cleanText(payload.content, { max: 2_000, multiline: true });
    const [message] = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
    if (!message || message.deletedAt) {
      return apiJson({ error: "Mesaj bulunamadı." }, { status: 404 });
    }
    const [messageChannel] = await db
      .select({ serverId: channels.serverId })
      .from(channels)
      .where(eq(channels.id, message.channelId))
      .limit(1);
    if (messageChannel?.serverId !== serverId) {
      return apiJson({ error: "Mesaj bu topluluğa ait değil." }, { status: 403 });
    }
    const permissions = await permissionsFor(profile, serverId);
    const ownsMessage =
      message.authorProfileId === profile.id || message.authorTag === `@${profile.username}`;
    if (!ownsMessage && (permissions & PERMISSIONS.manageMessages) === 0) {
      return apiJson({ error: "Bu mesajı düzenleyemezsin." }, { status: 403 });
    }
    const editedAt = new Date().toISOString();
    await db.update(messages).set({ content, editedAt }).where(eq(messages.id, id));
    await writeAudit(profile.id, "message.edit", id, undefined, serverId);
    return apiJson({ message: { ...message, content, editedAt } });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = requireIdentity(request);
    const payload = await readJson<MessagePayload>(request, 2_048);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await enforceRateLimit(request, "message-delete", identity.email, 20, 60_000);
    const id = cleanText(payload.id, { max: 80 });
    const [message] = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
    if (!message || message.deletedAt) {
      return apiJson({ error: "Mesaj bulunamadı." }, { status: 404 });
    }
    const [messageChannel] = await db
      .select({ serverId: channels.serverId })
      .from(channels)
      .where(eq(channels.id, message.channelId))
      .limit(1);
    if (messageChannel?.serverId !== serverId) {
      return apiJson({ error: "Mesaj bu topluluğa ait değil." }, { status: 403 });
    }
    const permissions = await permissionsFor(profile, serverId);
    const ownsMessage =
      message.authorProfileId === profile.id || message.authorTag === `@${profile.username}`;
    if (!ownsMessage && (permissions & PERMISSIONS.manageMessages) === 0) {
      return apiJson({ error: "Bu mesajı silemezsin." }, { status: 403 });
    }
    const deletedAt = new Date().toISOString();
    await db
      .update(messages)
      .set({ content: "Mesaj silindi.", deletedAt, editedAt: null })
      .where(eq(messages.id, id));
    await writeAudit(profile.id, "message.delete", id, undefined, serverId);
    return apiJson({ ok: true, deletedAt });
  } catch (error) {
    return apiError(error);
  }
}
