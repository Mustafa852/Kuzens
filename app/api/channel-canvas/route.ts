import { and, eq } from "drizzle-orm";
import { channelCanvases, channels, profiles } from "@/db/schema";
import {
  PERMISSIONS,
  channelPermissionsFor,
  requireChannelPermission,
  requireMember,
  writeAudit,
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

type CanvasPayload = {
  serverId?: string;
  channelId?: string;
  title?: string;
  content?: string;
};

async function requireCanvasChannel(
  db: Awaited<ReturnType<typeof requireMember>>["db"],
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
    const url = new URL(request.url);
    const serverId = cleanText(url.searchParams.get("server"), { max: 80 });
    const channelId = cleanText(url.searchParams.get("channel"), { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    const channel = await requireCanvasChannel(db, serverId, channelId);
    await requireChannelPermission(profile, PERMISSIONS.viewChannels, serverId, channelId);
    const permissions = await channelPermissionsFor(profile, serverId, channelId);
    const [row] = await db
      .select({
        channelId: channelCanvases.channelId,
        title: channelCanvases.title,
        content: channelCanvases.content,
        updatedAt: channelCanvases.updatedAt,
        updatedByName: profiles.displayName,
      })
      .from(channelCanvases)
      .leftJoin(profiles, eq(channelCanvases.updatedByProfileId, profiles.id))
      .where(
        and(
          eq(channelCanvases.channelId, channelId),
          eq(channelCanvases.serverId, serverId),
        ),
      )
      .limit(1);
    return apiJson({
      canvas: row || {
        channelId,
        title: `${channel.name} Panosu`,
        content: "",
        updatedAt: null,
        updatedByName: null,
      },
      canEdit: (permissions & PERMISSIONS.manageChannels) !== 0,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    await enforceRateLimit(request, "channel-canvas-save", identity.email, 20, 60_000);
    const payload = await readJson<CanvasPayload>(request, 32_768);
    const serverId = cleanText(payload.serverId, { max: 80 });
    const channelId = cleanText(payload.channelId, { max: 80 });
    const title = cleanText(payload.title, { min: 1, max: 80 });
    const content = cleanText(payload.content || "", {
      min: 0,
      max: 12_000,
      multiline: true,
    });
    const { db, profile } = await requireMember(identity, serverId);
    await requireCanvasChannel(db, serverId, channelId);
    await requireChannelPermission(profile, PERMISSIONS.manageChannels, serverId, channelId);
    const updatedAt = new Date().toISOString();
    await db
      .insert(channelCanvases)
      .values({
        channelId,
        serverId,
        title,
        content,
        updatedByProfileId: profile.id,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: channelCanvases.channelId,
        set: { title, content, updatedByProfileId: profile.id, updatedAt },
      });
    await writeAudit(profile.id, "channel.canvas.update", channelId, title, serverId);
    return apiJson({
      canvas: {
        channelId,
        title,
        content,
        updatedAt,
        updatedByName: profile.displayName,
      },
      canEdit: true,
    });
  } catch (error) {
    return apiError(error);
  }
}
