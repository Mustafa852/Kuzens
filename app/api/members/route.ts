import { and, eq } from "drizzle-orm";
import {
  memberRoles,
  profiles,
  roles,
  serverBans,
  serverMembers,
  servers,
} from "@/db/schema";
import {
  DEFAULT_SERVER_ID,
  PERMISSIONS,
  permissionsFor,
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
import { avatarUrlFor } from "@/lib/profile-view";

export async function GET(request: Request) {
  try {
    const identity = requireIdentity(request);
    const serverId = cleanText(
      new URL(request.url).searchParams.get("server") || DEFAULT_SERVER_ID,
      { max: 80 },
    );
    const { db, profile: currentProfile } = await requireMember(identity, serverId);
    const [membershipRows, profileRows, assignmentRows, roleRows] = await Promise.all([
      db.select().from(serverMembers).where(eq(serverMembers.serverId, serverId)),
      db.select().from(profiles),
      db.select().from(memberRoles).where(eq(memberRoles.serverId, serverId)),
      db.select().from(roles).where(eq(roles.serverId, serverId)),
    ]);
    const membershipByProfile = new Map(membershipRows.map((item) => [item.profileId, item]));
    const roleById = new Map(roleRows.map((role) => [role.id, role]));
    const assignmentsByTag = new Map<string, typeof assignmentRows>();
    for (const assignment of assignmentRows) {
      const grouped = assignmentsByTag.get(assignment.memberTag) || [];
      grouped.push(assignment);
      assignmentsByTag.set(assignment.memberTag, grouped);
    }
    const now = Date.now();
    const members = profileRows
      .filter(
        (profile) =>
          membershipByProfile.has(profile.id) ||
          (serverId === DEFAULT_SERVER_ID && profile.isOwner),
      )
      .map((profile) => {
        const membership = membershipByProfile.get(profile.id);
        const lastSeen = membership?.lastSeenAt
          ? new Date(membership.lastSeenAt).getTime()
          : 0;
        const online =
          profile.presenceStatus !== "invisible" && now - lastSeen < 90_000;
        const memberRoleRows = [
          roleById.get(`${serverId}:member`),
          ...(assignmentsByTag.get(`@${profile.username}`) || []).map(
            (assignment) => roleById.get(assignment.roleId),
          ),
        ]
          .filter(
            (role): role is (typeof roleRows)[number] => Boolean(role),
          )
          .filter(
            (role, index, all) =>
              all.findIndex((candidate) => candidate.id === role.id) === index,
          )
          .sort((a, b) => a.position - b.position);
        const role = memberRoleRows[0];
        return {
          id: profile.id,
          name: profile.displayName,
          tag: `@${profile.username}`,
          online,
          lastSeenAt: membership?.lastSeenAt ?? null,
          voiceChannelId: membership?.voiceChannelId ?? null,
          sharing: membership?.sharing ?? false,
          customStatus: profile.customStatus,
          presenceStatus: online ? profile.presenceStatus : "offline",
          bio: profile.bio,
          avatarUrl: avatarUrlFor(profile.id, profile.avatarKey),
          role: role ? { id: role.id, name: role.name, color: role.color } : null,
          roles: memberRoleRows.map((item) => ({
            id: item.id,
            name: item.name,
            color: item.color,
          })),
        };
      })
      .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, "tr"));
    const permissions = await permissionsFor(currentProfile, serverId);
    const banned =
      (permissions & PERMISSIONS.banMembers) !== 0
        ? await db
            .select()
            .from(serverBans)
            .where(eq(serverBans.serverId, serverId))
            .then((rows) =>
              rows.map((ban) => {
                const bannedProfile = profileRows.find((item) => item.id === ban.profileId);
                return {
                  id: ban.profileId,
                  name: bannedProfile?.displayName || "Bilinmeyen üye",
                  tag: bannedProfile ? `@${bannedProfile.username}` : "",
                  reason: ban.reason,
                  createdAt: ban.createdAt,
                };
              }),
            )
        : [];
    return apiJson({
      members,
      banned,
      selfProfileId: currentProfile.id,
      permissions,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = requireIdentity(request);
    const payload = await readJson<{
      serverId?: string;
      profileId?: string;
      action?: "kick" | "ban" | "unban";
      reason?: string;
    }>(request, 4_096);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const targetProfileId = cleanText(payload.profileId, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    if (targetProfileId === profile.id) {
      return apiJson({ error: "Kendine moderasyon işlemi uygulayamazsın." }, { status: 400 });
    }
    await enforceRateLimit(request, "member-moderation", identity.email, 20, 60 * 60_000);
    if (!["kick", "ban", "unban"].includes(payload.action || "")) {
      return apiJson({ error: "Geçersiz moderasyon işlemi." }, { status: 400 });
    }
    const [[server], [target], membershipRows, assignmentRows, roleRows] = await Promise.all([
      db.select().from(servers).where(eq(servers.id, serverId)).limit(1),
      db.select().from(profiles).where(eq(profiles.id, targetProfileId)).limit(1),
      db.select().from(serverMembers).where(eq(serverMembers.serverId, serverId)),
      db.select().from(memberRoles).where(eq(memberRoles.serverId, serverId)),
      db.select().from(roles).where(eq(roles.serverId, serverId)),
    ]);
    if (!target) return apiJson({ error: "Üye bulunamadı." }, { status: 404 });
    const actorIsOwner =
      server?.ownerProfileId === profile.id ||
      (serverId === DEFAULT_SERVER_ID && profile.isOwner);
    const targetIsOwner =
      server?.ownerProfileId === target.id ||
      (serverId === DEFAULT_SERVER_ID && target.isOwner);
    if (targetIsOwner) {
      return apiJson({ error: "Topluluk kurucusuna moderasyon uygulanamaz." }, { status: 403 });
    }
    const membershipIds = new Set(membershipRows.map((item) => item.profileId));
    const roleById = new Map(roleRows.map((role) => [role.id, role]));
    const assignmentsByTag = new Map<string, typeof assignmentRows>();
    for (const assignment of assignmentRows) {
      const grouped = assignmentsByTag.get(assignment.memberTag) || [];
      grouped.push(assignment);
      assignmentsByTag.set(assignment.memberTag, grouped);
    }
    const rolePosition = (member: typeof profiles.$inferSelect) => {
      const memberIsOwner =
        server?.ownerProfileId === member.id ||
        (serverId === DEFAULT_SERVER_ID && member.isOwner);
      if (memberIsOwner) return -1;
      const positions = [
        roleById.get(`${serverId}:member`)?.position,
        ...(assignmentsByTag.get(`@${member.username}`) || []).map(
          (assignment) => roleById.get(assignment.roleId)?.position,
        ),
      ].filter((position): position is number => typeof position === "number");
      return positions.length ? Math.min(...positions) : Number.MAX_SAFE_INTEGER;
    };
    if (!actorIsOwner && rolePosition(target) <= rolePosition(profile)) {
      return apiJson({ error: "Eşit veya üst roldeki bir üyeye işlem uygulayamazsın." }, { status: 403 });
    }

    if (payload.action === "unban") {
      await requirePermission(profile, PERMISSIONS.banMembers, serverId);
      await db
        .delete(serverBans)
        .where(
          and(
            eq(serverBans.serverId, serverId),
            eq(serverBans.profileId, targetProfileId),
          ),
        );
      await writeAudit(profile.id, "member.unban", targetProfileId, undefined, serverId);
      return apiJson({ ok: true });
    }

    if (!membershipIds.has(targetProfileId)) {
      return apiJson({ error: "Bu kullanıcı topluluğun üyesi değil." }, { status: 404 });
    }
    if (payload.action === "ban") {
      await requirePermission(profile, PERMISSIONS.banMembers, serverId);
      const reason =
        typeof payload.reason === "string" && payload.reason.trim()
          ? cleanText(payload.reason, { max: 200 })
          : "Topluluk kuralları ihlali";
      await db
        .insert(serverBans)
        .values({
          id: `${serverId}:${targetProfileId}`,
          serverId,
          profileId: targetProfileId,
          bannedByProfileId: profile.id,
          reason,
          createdAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: [serverBans.serverId, serverBans.profileId],
          set: {
            bannedByProfileId: profile.id,
            reason,
            createdAt: new Date().toISOString(),
          },
        });
      await writeAudit(profile.id, "member.ban", targetProfileId, reason, serverId);
    } else if (payload.action === "kick") {
      await requirePermission(profile, PERMISSIONS.kickMembers, serverId);
      await writeAudit(profile.id, "member.kick", targetProfileId, undefined, serverId);
    }

    await db
      .delete(serverMembers)
      .where(
        and(
          eq(serverMembers.serverId, serverId),
          eq(serverMembers.profileId, targetProfileId),
        ),
      );
    await db
      .delete(memberRoles)
      .where(
        and(
          eq(memberRoles.serverId, serverId),
          eq(memberRoles.memberTag, `@${target.username}`),
        ),
      );
    return apiJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
