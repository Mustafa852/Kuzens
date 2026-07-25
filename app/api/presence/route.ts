import { and, eq } from "drizzle-orm";
import { channels, serverMembers } from "@/db/schema";
import {
  DEFAULT_SERVER_ID,
  PERMISSIONS,
  ensureMembership,
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

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = requireIdentity(request);
    const payload = await readJson<{ serverId?: string; voiceChannelId?: string | null; sharing?: boolean }>(
      request,
      2_048,
    );
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await enforceRateLimit(request, "presence", identity.email, 40, 60_000);
    let voiceChannelId: string | null = null;
    if (payload.voiceChannelId) {
      const [voiceChannel] = await db
        .select()
        .from(channels)
        .where(
          and(
            eq(channels.id, payload.voiceChannelId),
            eq(channels.serverId, serverId),
            eq(channels.kind, "voice"),
          ),
        )
        .limit(1);
      if (!voiceChannel) {
        return apiJson({ error: "Ses odası bulunamadı." }, { status: 404 });
      }
      await requireChannelPermission(
        profile,
        PERMISSIONS.joinVoice,
        serverId,
        voiceChannel.id,
      );
      if (voiceChannel.userLimit > 0) {
        const participants = await db
          .select({ profileId: serverMembers.profileId })
          .from(serverMembers)
          .where(
            and(
              eq(serverMembers.serverId, serverId),
              eq(serverMembers.voiceChannelId, voiceChannel.id),
            ),
          );
        if (
          participants.length >= voiceChannel.userLimit &&
          !participants.some((item) => item.profileId === profile.id)
        ) {
          return apiJson({ error: "Ses odası kullanıcı sınırına ulaştı." }, { status: 409 });
        }
      }
      voiceChannelId = voiceChannel.id;
    }
    if (payload.sharing) {
      if (!voiceChannelId) {
        return apiJson({ error: "Ekran paylaşımı için bir ses odasında olmalısın." }, { status: 400 });
      }
      await requireChannelPermission(
        profile,
        PERMISSIONS.shareScreen,
        serverId,
        voiceChannelId,
      );
    }

    await ensureMembership(profile.id, serverId);
    const now = new Date().toISOString();
    await db
      .update(serverMembers)
      .set({ lastSeenAt: now, voiceChannelId, sharing: Boolean(payload.sharing) })
      .where(
        and(
          eq(serverMembers.serverId, serverId),
          eq(serverMembers.profileId, profile.id),
        ),
      );
    return apiJson({ ok: true, lastSeenAt: now });
  } catch (error) {
    return apiError(error);
  }
}
