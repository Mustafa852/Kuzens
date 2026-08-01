import { and, asc, eq, inArray } from "drizzle-orm";
import {
  channelPermissionOverwrites,
  memberRoles,
  profiles,
  roles,
  serverMembers,
  servers,
} from "@/db/schema";
import {
  DEFAULT_SERVER_ID,
  ALL_PERMISSIONS,
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
  action?: "save" | "create" | "delete";
  serverId?: string;
  roleId?: string;
  name?: string;
  color?: string;
  permissions?: number;
  assignments?: Array<{ memberTag?: string; roleId?: string }>;
};

function roleColor(value: unknown) {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) {
    return "#9c7cff";
  }
  return value.toLocaleLowerCase("en-US");
}

export async function GET(request: Request) {
  try {
    const identity = await requireIdentity(request);
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
    const canManage =
      ((await permissionsFor(profile, serverId)) & PERMISSIONS.manageRoles) !== 0;
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
    const identity = await requireIdentity(request);
    const payload = await readJson<RolesPayload>(request, 16_384);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await requirePermission(profile, PERMISSIONS.manageRoles, serverId);
    const [server] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
    const isServerOwner = server?.ownerProfileId === profile.id;
    const actorPermissions = await permissionsFor(profile, serverId);
    await enforceRateLimit(request, "roles-update", identity.email, 20, 60 * 60_000);
    const action = payload.action || "save";
    const validRoles = await db
      .select()
      .from(roles)
      .where(eq(roles.serverId, serverId));
    const actorTag = `@${profile.username}`;
    const currentAssignments = await db
      .select()
      .from(memberRoles)
      .where(eq(memberRoles.serverId, serverId));
    const memberRole = validRoles.find((role) => role.id.endsWith(":member"));
    const actorRoleIds = new Set(
      currentAssignments
        .filter((assignment) => assignment.memberTag === actorTag)
        .map((assignment) => assignment.roleId),
    );
    const actorHighestPosition = isServerOwner
      ? -1
      : Math.min(
          memberRole?.position ?? Number.MAX_SAFE_INTEGER,
          ...validRoles
            .filter((role) => actorRoleIds.has(role.id))
            .map((role) => role.position),
        );
    const canManageRole = (role: (typeof validRoles)[number]) =>
      isServerOwner || role.position > actorHighestPosition;

    if (action === "create") {
      if (validRoles.length >= 20) {
        return apiJson({ error: "Bir toplulukta en fazla 20 rol olabilir." }, { status: 400 });
      }
      const name = cleanText(payload.name, { min: 1, max: 32 });
      const now = new Date().toISOString();
      const requestedPermissions = Number.isInteger(payload.permissions)
        ? Math.max(0, Math.min(ALL_PERMISSIONS, Number(payload.permissions)))
        : PERMISSIONS.viewChannels | PERMISSIONS.sendMessages;
      if (!isServerOwner && (requestedPermissions & ~actorPermissions) !== 0) {
        return apiJson(
          { error: "Sahip olmadığın bir yetkiyi yeni role veremezsin." },
          { status: 403 },
        );
      }
      const role = {
        id: `${serverId}:custom:${crypto.randomUUID().slice(0, 10)}`,
        serverId,
        name,
        color: roleColor(payload.color),
        permissions: requestedPermissions,
        position: Math.max(...validRoles.map((item) => item.position), 0) + 1,
        createdAt: now,
      };
      await db.insert(roles).values(role);
      await writeAudit(profile.id, "roles.create", role.id, role.name, serverId);
      return apiJson({ role }, { status: 201 });
    }

    const roleId = typeof payload.roleId === "string" ? payload.roleId : "";
    if (action === "delete") {
      const role = validRoles.find((item) => item.id === roleId);
      if (!role || !role.id.includes(":custom:")) {
        return apiJson({ error: "Yalnızca özel roller silinebilir." }, { status: 400 });
      }
      if (!canManageRole(role)) {
        return apiJson({ error: "Bu rol hiyerarşide senin rolüne eşit veya daha yüksek." }, { status: 403 });
      }
      await db.delete(memberRoles).where(eq(memberRoles.roleId, role.id));
      await db
        .delete(channelPermissionOverwrites)
        .where(eq(channelPermissionOverwrites.roleId, role.id));
      await db.delete(roles).where(eq(roles.id, role.id));
      await writeAudit(profile.id, "roles.delete", role.id, role.name, serverId);
      return apiJson({ ok: true });
    }

    if (
      !roleId.startsWith(`${serverId}:`) ||
      !Number.isInteger(payload.permissions) ||
      payload.permissions! < 0 ||
      payload.permissions! > ALL_PERMISSIONS
    ) {
      return apiJson({ error: "Geçersiz rol veya yetki değeri." }, { status: 400 });
    }
    if (roleId.endsWith(":owner") && payload.permissions !== ALL_PERMISSIONS) {
      return apiJson({ error: "Kurucu rolünün tüm yetkileri açık kalmalı." }, { status: 400 });
    }

    const validRoleIds = new Set(validRoles.map((role) => role.id));
    if (!validRoleIds.has(roleId)) {
      return apiJson({ error: "Rol bulunamadı." }, { status: 404 });
    }
    const currentRole = validRoles.find((role) => role.id === roleId)!;
    if (!canManageRole(currentRole)) {
      return apiJson({ error: "Bu rol hiyerarşide senin rolüne eşit veya daha yüksek." }, { status: 403 });
    }
    if (!isServerOwner && (payload.permissions! & ~actorPermissions) !== 0) {
      return apiJson(
        { error: "Sahip olmadığın bir yetkiyi role veremezsin." },
        { status: 403 },
      );
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
    const ownerProfile = profileRows.find((item) => item.id === server?.ownerProfileId);
    const ownerTag = ownerProfile ? `@${ownerProfile.username}` : "";
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

    const name =
      roleId.endsWith(":owner")
        ? currentRole.name
        : cleanText(payload.name || currentRole.name, { min: 1, max: 32 });
    const color = roleId.endsWith(":owner")
      ? currentRole.color
      : roleColor(payload.color || currentRole.color);
    await db
      .update(roles)
      .set({ name, color, permissions: payload.permissions! })
      .where(eq(roles.id, roleId));
    if (!roleId.endsWith(":member") && !roleId.endsWith(":owner")) {
      const highestPositionFor = (memberTag: string) =>
        Math.min(
          memberRole?.position ?? Number.MAX_SAFE_INTEGER,
          ...currentAssignments
            .filter((assignment) => assignment.memberTag === memberTag)
            .map((assignment) => {
              const role = validRoles.find((item) => item.id === assignment.roleId);
              return role?.position ?? Number.MAX_SAFE_INTEGER;
            }),
        );
      const manageableTags = Array.from(allowedTags).filter(
        (memberTag) =>
          isServerOwner ||
          (memberTag !== ownerTag && highestPositionFor(memberTag) > actorHighestPosition),
      );
      await db
        .delete(memberRoles)
        .where(
          and(
            eq(memberRoles.serverId, serverId),
            eq(memberRoles.roleId, roleId),
            manageableTags.length
              ? inArray(memberRoles.memberTag, manageableTags)
              : eq(memberRoles.memberTag, "__none__"),
          ),
        );
      const selectedAssignments = validatedAssignments.filter(
        (assignment) =>
          assignment.roleId === roleId &&
          manageableTags.includes(assignment.memberTag),
      );
      if (selectedAssignments.length) {
        await db
          .insert(memberRoles)
          .values(
            selectedAssignments.map((assignment) => ({
              id: `${serverId}:${assignment.memberTag}:${roleId}`,
              serverId,
              memberTag: assignment.memberTag,
              roleId,
              createdAt: new Date().toISOString(),
            })),
          )
          .onConflictDoNothing();
      }
    }
    await writeAudit(profile.id, "roles.update", roleId, String(payload.permissions), serverId);
    return apiJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
