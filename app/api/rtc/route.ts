import { and, asc, eq, gt, lt, lte, ne } from "drizzle-orm";
import { channels, rtcSignals, serverMembers } from "@/db/schema";
import {
  DEFAULT_SERVER_ID,
  PERMISSIONS,
  requireMember,
  requirePermission,
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

type SignalPayload = {
  serverId?: string;
  channelId?: string;
  recipientProfileId?: string;
  type?: "offer" | "answer" | "ice";
  payload?: unknown;
};

export async function GET(request: Request) {
  try {
    const identity = requireIdentity(request);
    const url = new URL(request.url);
    const syncBoundary = new Date().toISOString();
    const serverId = cleanText(url.searchParams.get("server") || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await requirePermission(profile, PERMISSIONS.joinVoice, serverId);
    await enforceRateLimit(request, "rtc-poll", identity.email, 120, 60_000);
    const channelId = cleanText(url.searchParams.get("channel"), { max: 80 });
    const after = url.searchParams.get("after") || new Date(Date.now() - 30_000).toISOString();
    if (Number.isNaN(new Date(after).getTime())) {
      return apiJson({ error: "Geçersiz sinyal zamanı." }, { status: 400 });
    }
    const [presence] = await db
      .select({ profileId: serverMembers.profileId })
      .from(serverMembers)
      .where(
        and(
          eq(serverMembers.serverId, serverId),
          eq(serverMembers.profileId, profile.id),
          eq(serverMembers.voiceChannelId, channelId),
        ),
      )
      .limit(1);
    if (!presence) {
      return apiJson({ error: "Sinyalleri yalnızca bağlı olduğun ses odasında alabilirsin." }, { status: 403 });
    }
    const signals = await db
      .select()
      .from(rtcSignals)
      .where(
        and(
          eq(rtcSignals.serverId, serverId),
          eq(rtcSignals.channelId, channelId),
          eq(rtcSignals.recipientProfileId, profile.id),
          ne(rtcSignals.senderProfileId, profile.id),
          gt(rtcSignals.createdAt, new Date(after).toISOString()),
          lte(rtcSignals.createdAt, syncBoundary),
        ),
      )
      .orderBy(asc(rtcSignals.createdAt))
      .limit(100);
    return apiJson({ signals, syncedAt: syncBoundary });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = requireIdentity(request);
    const body = await readJson<SignalPayload>(request, 32_768);
    const serverId = cleanText(body.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await requirePermission(profile, PERMISSIONS.joinVoice, serverId);
    await enforceRateLimit(request, "rtc-signal", identity.email, 240, 60_000);
    const channelId = cleanText(body.channelId, { max: 80 });
    const recipientProfileId = cleanText(body.recipientProfileId, { max: 80 });
    if (!["offer", "answer", "ice"].includes(body.type || "")) {
      return apiJson({ error: "Geçersiz WebRTC sinyali." }, { status: 400 });
    }
    if (recipientProfileId === profile.id) {
      return apiJson({ error: "Kendine sinyal gönderemezsin." }, { status: 400 });
    }
    const payload = JSON.stringify(body.payload);
    if (!payload || payload.length > 24_000) {
      return apiJson({ error: "WebRTC sinyali çok büyük." }, { status: 413 });
    }

    const [voiceChannel] = await db
      .select({ id: channels.id })
      .from(channels)
      .where(
        and(
          eq(channels.id, channelId),
          eq(channels.serverId, serverId),
          eq(channels.kind, "voice"),
        ),
      )
      .limit(1);
    const participants = await db
      .select()
      .from(serverMembers)
      .where(
        and(
          eq(serverMembers.serverId, serverId),
          eq(serverMembers.voiceChannelId, channelId),
        ),
      );
    const participantIds = new Set(participants.map((item) => item.profileId));
    if (
      !voiceChannel ||
      !participantIds.has(profile.id) ||
      !participantIds.has(recipientProfileId)
    ) {
      return apiJson({ error: "Yalnızca aynı ses odasındaki üyeler sinyal gönderebilir." }, { status: 403 });
    }

    const now = new Date().toISOString();
    await db.delete(rtcSignals).where(lt(rtcSignals.createdAt, new Date(Date.now() - 5 * 60_000).toISOString()));
    const signal = {
      id: crypto.randomUUID(),
      serverId,
      channelId,
      senderProfileId: profile.id,
      recipientProfileId,
      type: body.type!,
      payload,
      createdAt: now,
    };
    await db.insert(rtcSignals).values(signal);
    return apiJson({ signalId: signal.id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
