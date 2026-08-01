import { and, asc, eq } from "drizzle-orm";
import {
  channelMemberPermissionOverwrites,
  channelPermissionOverwrites,
  channels,
  profiles,
  roles,
} from "@/db/schema";
import {
  DEFAULT_SERVER_ID,
  PERMISSIONS,
  requireMember,
  requirePermission,
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

const CHANNEL_PERMISSION_MASK =
  PERMISSIONS.viewChannels |
  PERMISSIONS.sendMessages |
  PERMISSIONS.joinVoice |
  PERMISSIONS.speakVoice |
  PERMISSIONS.shareScreen;

type OverwriteInput = {
  roleId?: string;
  allowPermissions?: number;
  denyPermissions?: number;
};

type MemberOverwriteInput = {
  profileId?: string;
  allowPermissions?: number;
  denyPermissions?: number;
};

async function scopedChannel(
  db: Awaited<ReturnType<typeof requireMember>>["db"],
  serverId: string,
  channelId: string,
) {
  const [channel] = await db
    .select()
    .from(channels)
    .where(
      and(
        eq(channels.id, channelId),
        eq(channels.serverId, serverId),
      ),
    )
    .limit(1);
  if (!channel) throw new ApiError(404, "Oda bulunamadı.");
  return channel;
}

export async function GET(request: Request) {
  try {
    const identity = await requireIdentity(request);
    const url = new URL(request.url);
    const serverId = cleanText(
      url.searchParams.get("server") || DEFAULT_SERVER_ID,
      { max: 80 },
    );
    const channelId = cleanText(url.searchParams.get("channel"), { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    const channel = await scopedChannel(db, serverId, channelId);
    const [roleRows, overwrites, memberOverwrites, memberRows] = await Promise.all([
      db
        .select()
        .from(roles)
        .where(eq(roles.serverId, serverId))
        .orderBy(asc(roles.position)),
      db
        .select()
        .from(channelPermissionOverwrites)
        .where(eq(channelPermissionOverwrites.channelId, channelId)),
      db
        .select()
        .from(channelMemberPermissionOverwrites)
        .where(eq(channelMemberPermissionOverwrites.channelId, channelId)),
      db
        .select({ id: profiles.id, displayName: profiles.displayName, username: profiles.username })
        .from(profiles),
    ]);
    return apiJson({
      channel,
      roles: roleRows,
      overwrites,
      memberOverwrites,
      members: memberRows,
      permissionMask: CHANNEL_PERMISSION_MASK,
      canManage:
        ((await requirePermission(
          profile,
          PERMISSIONS.manageChannels,
          serverId,
        )) &
          PERMISSIONS.manageChannels) !==
        0,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    const payload = await readJson<{
      serverId?: string;
      channelId?: string;
      overwrites?: OverwriteInput[];
      memberOverwrites?: MemberOverwriteInput[];
    }>(request, 16_384);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, {
      max: 80,
    });
    const channelId = cleanText(payload.channelId, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await requirePermission(profile, PERMISSIONS.manageChannels, serverId);
    await enforceRateLimit(
      request,
      "channel-permissions",
      identity.email,
      20,
      60 * 60_000,
    );
    await scopedChannel(db, serverId, channelId);

    if (!Array.isArray(payload.overwrites) || payload.overwrites.length > 50) {
      throw new ApiError(400, "Oda izinleri geçersiz.");
    }
    const roleRows = await db
      .select()
      .from(roles)
      .where(eq(roles.serverId, serverId));
    const validRoleIds = new Set(roleRows.map((role) => role.id));
    const normalized = payload.overwrites.map((overwrite) => {
      const roleId = cleanText(overwrite.roleId, { max: 100 });
      const allowPermissions = Number(overwrite.allowPermissions || 0);
      const denyPermissions = Number(overwrite.denyPermissions || 0);
      if (
        !validRoleIds.has(roleId) ||
        roleId.endsWith(":owner") ||
        !Number.isInteger(allowPermissions) ||
        !Number.isInteger(denyPermissions) ||
        allowPermissions < 0 ||
        denyPermissions < 0 ||
        (allowPermissions & ~CHANNEL_PERMISSION_MASK) !== 0 ||
        (denyPermissions & ~CHANNEL_PERMISSION_MASK) !== 0 ||
        (allowPermissions & denyPermissions) !== 0
      ) {
        throw new ApiError(400, "Rol için seçilen oda izinleri geçersiz.");
      }
      return { roleId, allowPermissions, denyPermissions };
    });
    const requestedMemberOverwrites = payload.memberOverwrites || [];
    if (!Array.isArray(requestedMemberOverwrites) || requestedMemberOverwrites.length > 50) {
      throw new ApiError(400, "Üye oda izinleri geçersiz.");
    }
    const memberRows = await db.select({ id: profiles.id }).from(profiles);
    const validProfileIds = new Set(memberRows.map((member) => member.id));
    const normalizedMembers = requestedMemberOverwrites.map((overwrite) => {
      const profileId = cleanText(overwrite.profileId, { max: 80 });
      const allowPermissions = Number(overwrite.allowPermissions || 0);
      const denyPermissions = Number(overwrite.denyPermissions || 0);
      if (
        !validProfileIds.has(profileId) ||
        !Number.isInteger(allowPermissions) ||
        !Number.isInteger(denyPermissions) ||
        allowPermissions < 0 ||
        denyPermissions < 0 ||
        (allowPermissions & ~CHANNEL_PERMISSION_MASK) !== 0 ||
        (denyPermissions & ~CHANNEL_PERMISSION_MASK) !== 0 ||
        (allowPermissions & denyPermissions) !== 0
      ) {
        throw new ApiError(400, "Üye için seçilen oda izinleri geçersiz.");
      }
      return { profileId, allowPermissions, denyPermissions };
    });

    await db
      .delete(channelPermissionOverwrites)
      .where(eq(channelPermissionOverwrites.channelId, channelId));
    const active = normalized.filter(
      (overwrite) =>
        overwrite.allowPermissions !== 0 || overwrite.denyPermissions !== 0,
    );
    if (active.length) {
      const now = new Date().toISOString();
      await db.insert(channelPermissionOverwrites).values(
        active.map((overwrite) => ({
          id: `${channelId}:${overwrite.roleId}`,
          channelId,
          roleId: overwrite.roleId,
          allowPermissions: overwrite.allowPermissions,
          denyPermissions: overwrite.denyPermissions,
          updatedByProfileId: profile.id,
          updatedAt: now,
        })),
      );
    }
    await db
      .delete(channelMemberPermissionOverwrites)
      .where(eq(channelMemberPermissionOverwrites.channelId, channelId));
    const activeMembers = normalizedMembers.filter(
      (overwrite) => overwrite.allowPermissions !== 0 || overwrite.denyPermissions !== 0,
    );
    if (activeMembers.length) {
      const now = new Date().toISOString();
      await db.insert(channelMemberPermissionOverwrites).values(
        activeMembers.map((overwrite) => ({
          id: `${channelId}:${overwrite.profileId}`,
          channelId,
          profileId: overwrite.profileId,
          allowPermissions: overwrite.allowPermissions,
          denyPermissions: overwrite.denyPermissions,
          updatedByProfileId: profile.id,
          updatedAt: now,
        })),
      );
    }
    await writeAudit(
      profile.id,
      "channel.permissions",
      channelId,
      `${active.length} rol geçersiz kılma`,
      serverId,
    );
    return apiJson({ ok: true, overwrites: active, memberOverwrites: activeMembers });
  } catch (error) {
    return apiError(error);
  }
}
