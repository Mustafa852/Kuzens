import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { memberRoles, profiles, roles } from "@/db/schema";
import { getRequestIdentity } from "@/lib/identity";

const ALL_PERMISSIONS = 255;

function defaultRoles(serverId: string) {
  const now = new Date().toISOString();
  return [
    { id: `${serverId}:owner`, serverId, name: "Kurucu", color: "#ffd166", permissions: ALL_PERMISSIONS, position: 0, createdAt: now },
    { id: `${serverId}:moderator`, serverId, name: "Moderatör", color: "#9c7cff", permissions: 123, position: 1, createdAt: now },
    { id: `${serverId}:member`, serverId, name: "Kuzen", color: "#5be39a", permissions: 193, position: 2, createdAt: now },
  ];
}

async function ensureRoles(serverId: string) {
  const db = getDb();
  await db.insert(roles).values(defaultRoles(serverId)).onConflictDoNothing();
  return db;
}

export async function GET(request: Request) {
  const serverId = new URL(request.url).searchParams.get("server") || "kuzens";
  try {
    const db = await ensureRoles(serverId);
    const roleRows = await db
      .select()
      .from(roles)
      .where(eq(roles.serverId, serverId))
      .orderBy(asc(roles.position));
    const assignmentRows = await db
      .select()
      .from(memberRoles)
      .where(eq(memberRoles.serverId, serverId));
    return Response.json({ roles: roleRows, assignments: assignmentRows });
  } catch {
    return Response.json({ roles: defaultRoles(serverId), assignments: [], mode: "demo" });
  }
}

export async function POST(request: Request) {
  try {
    const identity = getRequestIdentity(request);
    const payload = (await request.json()) as {
      serverId?: string;
      roleId?: string;
      permissions?: number;
      assignments?: Array<{ memberTag?: string; roleId?: string }>;
    };
    const serverId = payload.serverId?.trim() || "kuzens";
    const db = await ensureRoles(serverId);
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.email, identity.email))
      .limit(1);

    if (!profile?.isOwner) {
      return Response.json({ error: "Bu işlem için Kurucu yetkisi gerekiyor." }, { status: 403 });
    }

    if (
      !payload.roleId ||
      !Number.isInteger(payload.permissions) ||
      payload.permissions! < 0 ||
      payload.permissions! > ALL_PERMISSIONS
    ) {
      return Response.json({ error: "Geçersiz rol veya yetki değeri." }, { status: 400 });
    }

    const roleId = payload.roleId;
    if (!roleId.startsWith(`${serverId}:`)) {
      return Response.json({ error: "Rol bu sunucuya ait değil." }, { status: 400 });
    }
    if (roleId.endsWith(":owner") && payload.permissions !== ALL_PERMISSIONS) {
      return Response.json({ error: "Kurucu rolünün tüm yetkileri açık kalmalıdır." }, { status: 400 });
    }

    await db.update(roles).set({ permissions: payload.permissions }).where(eq(roles.id, roleId));

    for (const assignment of payload.assignments ?? []) {
      const memberTag = assignment.memberTag?.trim();
      const assignedRoleId = assignment.roleId?.trim();
      if (!memberTag || !assignedRoleId || !assignedRoleId.startsWith(`${serverId}:`)) continue;
      await db
        .insert(memberRoles)
        .values({
          id: `${serverId}:${memberTag}`,
          serverId,
          memberTag,
          roleId: assignedRoleId,
          createdAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: [memberRoles.serverId, memberRoles.memberTag],
          set: { roleId: assignedRoleId },
        });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Yetkiler kaydedilemedi." },
      { status: 500 },
    );
  }
}
