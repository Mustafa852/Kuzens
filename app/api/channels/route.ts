import { and, asc, eq, inArray } from "drizzle-orm";
import {
  channels,
  messageMentions,
  messageReactions,
  messages,
  rtcSignals,
} from "@/db/schema";
import {
  DEFAULT_SERVER_ID,
  PERMISSIONS,
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

type ChannelPayload = {
  id?: string;
  name?: string;
  kind?: "text" | "voice";
  serverId?: string;
  topic?: string;
  slowModeSeconds?: number;
};

function channelName(value: unknown) {
  return cleanText(value, { max: 32 })
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9ğüşöçı_-]/g, "");
}

export async function GET(request: Request) {
  try {
    const identity = requireIdentity(request);
    const serverId = cleanText(
      new URL(request.url).searchParams.get("server") || DEFAULT_SERVER_ID,
      { max: 80 },
    );
    const { db } = await requireMember(identity, serverId);
    const rows = await db
      .select()
      .from(channels)
      .where(eq(channels.serverId, serverId))
      .orderBy(asc(channels.position));
    return apiJson({ channels: rows });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = requireIdentity(request);
    const payload = await readJson<ChannelPayload>(request, 4_096);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await requirePermission(profile, PERMISSIONS.manageChannels, serverId);
    await enforceRateLimit(request, "channel-create", identity.email, 10, 60 * 60_000);
    const name = channelName(payload.name);
    const kind: "text" | "voice" = payload.kind === "voice" ? "voice" : "text";

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
    const identity = requireIdentity(request);
    const payload = await readJson<ChannelPayload>(request, 4_096);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await requirePermission(profile, PERMISSIONS.manageChannels, serverId);
    await enforceRateLimit(request, "channel-update", identity.email, 20, 60 * 60_000);
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

    await db
      .update(channels)
      .set({ name, topic, slowModeSeconds })
      .where(eq(channels.id, id));
    await writeAudit(
      profile.id,
      "channel.update",
      id,
      `${name}:${slowModeSeconds}`,
      serverId,
    );
    return apiJson({ channel: { ...existing, name, topic, slowModeSeconds } });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = requireIdentity(request);
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
    if (messageIds.length) {
      await db.delete(messageMentions).where(inArray(messageMentions.messageId, messageIds));
      await db.delete(messageReactions).where(inArray(messageReactions.messageId, messageIds));
    }
    await db.delete(messages).where(eq(messages.channelId, id));
    await db.delete(rtcSignals).where(eq(rtcSignals.channelId, id));
    await db.delete(channels).where(eq(channels.id, id));
    await writeAudit(profile.id, "channel.delete", id, existing.name, serverId);
    return apiJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
