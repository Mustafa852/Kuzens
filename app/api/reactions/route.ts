import { and, eq } from "drizzle-orm";
import { channels, messageReactions, messages } from "@/db/schema";
import {
  DEFAULT_SERVER_ID,
  PERMISSIONS,
  requireChannelPermission,
  requireMember,
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

const ALLOWED_REACTIONS = new Set(["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "✅"]);

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = requireIdentity(request);
    const payload = await readJson<{
      serverId?: string;
      messageId?: string;
      emoji?: string;
    }>(request, 2_048);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const messageId = cleanText(payload.messageId, { max: 80 });
    const emoji = cleanText(payload.emoji, { max: 8 });
    if (!ALLOWED_REACTIONS.has(emoji)) {
      return apiJson({ error: "Bu tepki desteklenmiyor." }, { status: 400 });
    }
    const { db, profile } = await requireMember(identity, serverId);
    await enforceRateLimit(request, "message-reaction", identity.email, 40, 60_000);
    const [message] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
    if (!message || message.deletedAt) {
      return apiJson({ error: "Mesaj bulunamadı." }, { status: 404 });
    }
    const [channel] = await db
      .select({ id: channels.id })
      .from(channels)
      .where(
        and(
          eq(channels.id, message.channelId),
          eq(channels.serverId, serverId),
        ),
      )
      .limit(1);
    if (!channel) {
      return apiJson({ error: "Mesaj bu topluluğa ait değil." }, { status: 403 });
    }
    await requireChannelPermission(
      profile,
      PERMISSIONS.viewChannels,
      serverId,
      channel.id,
    );
    const id = `${messageId}:${profile.id}:${emoji}`;
    const [existing] = await db
      .select({ id: messageReactions.id })
      .from(messageReactions)
      .where(eq(messageReactions.id, id))
      .limit(1);
    if (existing) {
      await db.delete(messageReactions).where(eq(messageReactions.id, id));
      return apiJson({ active: false });
    }
    await db.insert(messageReactions).values({
      id,
      messageId,
      profileId: profile.id,
      emoji,
      createdAt: new Date().toISOString(),
    });
    return apiJson({ active: true }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
