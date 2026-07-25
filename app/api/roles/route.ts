import { asc, eq } from "drizzle-orm";
import { memberRoles, profiles, roles, serverMembers, servers } from "@/db/schema";
import {
  DEFAULT_SERVER_ID,
  PERMISSIONS,
  defaultRoles,
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

type RolesPayload = {
  serverId?: string;
  roleId?: string;
  permissions?: number;
  assignments?: Array<{ memberTag?: string; roleId?: string }>;
};

export async function GET(request: Request) {
  try {
    const identity = requireIdentity(request);
    const serverId = cleanText(
      new URL(request.url).searchParams.get("server") || DEFAULT_SERVER_ID,
      { max: 80 },
    );
    const { db, profile } = await requireMember(identity, serverId);
    await db.insert(roles).values(defaultRoles(serverId)).onConflictDoNothing();
    const roleRows = await db
      .select()
      .from(roles)
      .where(eq(roles.serverId, serverId))
      .orderBy(asc(roles.position));
    const assignmentRows = await db
      .select()
      .from(memberRoles)
      .where(eq(memberRoles.serverId, serverId));
    const [server] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
    const canManage =
      server?.ownerProfileId === profile.id ||
      (serverId === DEFAULT_SERVER_ID && profile.isOwner);
    return apiJson({
      roles: roleRows,
      assignments: assignmentRows,
      permissions: await permissionsFor(profile, serverId),
      canManage,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = requireIdentity(request);
    const payload = await readJson<RolesPayload>(request, 16_384);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await requirePermission(profile, PERMISSIONS.manageRoles, serverId);
    const [server] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
    const isServerOwner =
      server?.ownerProfileId === profile.id ||
      (serverId === DEFAULT_SERVER_ID && profile.isOwner);
    if (!isServerOwner) {
      return apiJson(
        { error: "Rol hiyerarşisini yalnızca doğrulanmış Kurucu hesabı değiştirebilir." },
        { status: 403 },
      );
    }
    await enforceRateLimit(request, "roles-update", identity.email, 20, 60 * 60_000);
    const roleId = typeof payload.roleId === "string" ? payload.roleId : "";
    if (
      !roleId.startsWith(`${serverId}:`) ||
      !Number.isInteger(payload.permissions) ||
      payload.permissions! < 0 ||
      payload.permissions! > 255
    ) {
      return apiJson({ error: "Geçersiz rol veya yetki değeri." }, { status: 400 });
    }
    if (roleId.endsWith(":owner") && payload.permissions !== 255) {
      return apiJson({ error: "Kurucu rolünün tüm yetkileri açık kalmalı." }, { status: 400 });
    }

    const validRoles = await db
      .select()
      .from(roles)
      .where(eq(roles.serverId, serverId));
    const validRoleIds = new Set(validRoles.map((role) => role.id));
    if (!validRoleIds.has(roleId)) {
      return apiJson({ error: "Rol bulunamadı." }, { status: 404 });
    }

    const membershipRows = await db
      .select({ profileId: serverMembers.profileId })
      .from(serverMembers)
      .where(eq(serverMembers.serverId, serverId));
    const allowedProfileIds = new Set(membershipRows.map((item) => item.profileId));
    allowedProfileIds.add(profile.id);
    const profileRows = await db.select().from(profiles);
    const allowedTags = new Set(
      profileRows
        .filter((item) => allowedProfileIds.has(item.id))
        .map((item) => `@${item.username}`),
    );
    const ownerTag = `@${profile.username}`;
    const ownerRoleId = `${serverId}:owner`;
    const validatedAssignments: Array<{ memberTag: string; roleId: string }> = [];

    for (const assignment of payload.assignments ?? []) {
      const memberTag = assignment.memberTag?.trim();
      const assignedRoleId = assignment.roleId?.trim();
      if (
        !memberTag ||
        !assignedRoleId ||
        !allowedTags.has(memberTag) ||
        !validRoleIds.has(assignedRoleId)
      ) {
        continue;
      }
      if (
        (assignedRoleId === ownerRoleId && memberTag !== ownerTag) ||
        (memberTag === ownerTag && assignedRoleId !== ownerRoleId)
      ) {
        return apiJson(
          { error: "Kurucu rolü başka bir üyeye atanamaz veya kurucudan alınamaz." },
          { status: 400 },
        );
      }
      validatedAssignments.push({ memberTag, roleId: assignedRoleId });
    }

    await db.update(roles).set({ permissions: payload.permissions! }).where(eq(roles.id, roleId));
    for (const assignment of validatedAssignments) {
      await db
        .insert(memberRoles)
        .values({
          id: `${serverId}:${assignment.memberTag}`,
          serverId,
          memberTag: assignment.memberTag,
          roleId: assignment.roleId,
          createdAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: [memberRoles.serverId, memberRoles.memberTag],
          set: { roleId: assignment.roleId },
        });
    }
    await writeAudit(profile.id, "roles.update", roleId, String(payload.permissions), serverId);
    return apiJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
