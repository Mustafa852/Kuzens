import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  auditLogs,
  channels,
  memberRoles,
  profiles,
  roles,
  serverMembers,
  servers,
} from "@/db/schema";
import type { RequestIdentity } from "@/lib/identity";
import { ApiError } from "@/lib/security";

export const DEFAULT_SERVER_ID = "kuzens";
export const PERMISSIONS = {
  manageServer: 1,
  manageChannels: 2,
  manageRoles: 4,
  manageMessages: 8,
  kickMembers: 16,
  banMembers: 32,
  joinVoice: 64,
  shareScreen: 128,
} as const;
export const ALL_PERMISSIONS = 255;

const defaultChannels = [
  { id: "genel", serverId: DEFAULT_SERVER_ID, name: "genel", kind: "text" as const, position: 0 },
  { id: "oyun-gecesi", serverId: DEFAULT_SERVER_ID, name: "oyun-gecesi", kind: "text" as const, position: 1 },
  { id: "paylasimlar", serverId: DEFAULT_SERVER_ID, name: "paylaşımlar", kind: "text" as const, position: 2 },
  { id: "muhabbet", serverId: DEFAULT_SERVER_ID, name: "Muhabbet", kind: "voice" as const, position: 3 },
  { id: "gece-ekibi", serverId: DEFAULT_SERVER_ID, name: "Gece Ekibi", kind: "voice" as const, position: 4 },
];

export function defaultRoles(serverId = DEFAULT_SERVER_ID) {
  const now = new Date().toISOString();
  return [
    { id: `${serverId}:owner`, serverId, name: "Kurucu", color: "#ffd166", permissions: ALL_PERMISSIONS, position: 0, createdAt: now },
    { id: `${serverId}:moderator`, serverId, name: "Moderatör", color: "#9c7cff", permissions: 123, position: 1, createdAt: now },
    { id: `${serverId}:member`, serverId, name: "Kuzen", color: "#5be39a", permissions: 192, position: 2, createdAt: now },
  ];
}

export async function ensureCommunity() {
  const db = getDb();
  const now = new Date().toISOString();
  await db
    .insert(servers)
    .values({ id: DEFAULT_SERVER_ID, name: "Kuzens", icon: "K", createdAt: now })
    .onConflictDoNothing();
  await db
    .insert(channels)
    .values(defaultChannels.map((channel) => ({ ...channel, createdAt: now })))
    .onConflictDoNothing();
  await db.insert(roles).values(defaultRoles()).onConflictDoNothing();
  return db;
}

export async function findProfile(identity: RequestIdentity) {
  const db = getDb();
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.email, identity.email))
    .limit(1);
  return profile;
}

export async function requireProfile(identity: RequestIdentity) {
  const profile = await findProfile(identity);
  if (!profile) throw new ApiError(403, "Önce Kuzens hesabını oluşturmalısın.");
  return profile;
}

export async function requireMember(identity: RequestIdentity, serverId = DEFAULT_SERVER_ID) {
  const db = getDb();
  const profile = await requireProfile(identity);
  const [server] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
  if (!server) throw new ApiError(404, "Topluluk bulunamadı.");
  const isServerOwner =
    server.ownerProfileId === profile.id ||
    (serverId === DEFAULT_SERVER_ID && profile.isOwner);
  if (isServerOwner) return { db, profile };

  const [membership] = await db
    .select()
    .from(serverMembers)
    .where(
      and(
        eq(serverMembers.serverId, serverId),
        eq(serverMembers.profileId, profile.id),
      ),
    )
    .limit(1);
  if (!membership) throw new ApiError(403, "Bu topluluğa katılmak için geçerli bir davet gerekiyor.");
  return { db, profile };
}

export async function ensureMembership(profileId: string, serverId = DEFAULT_SERVER_ID) {
  const db = getDb();
  const now = new Date().toISOString();
  await db
    .insert(serverMembers)
    .values({
      id: `${serverId}:${profileId}`,
      serverId,
      profileId,
      lastSeenAt: now,
      sharing: false,
      joinedAt: now,
    })
    .onConflictDoUpdate({
      target: [serverMembers.serverId, serverMembers.profileId],
      set: { lastSeenAt: now },
    });
  return db;
}

export async function permissionsFor(
  profile: typeof profiles.$inferSelect,
  serverId = DEFAULT_SERVER_ID,
) {
  const db = getDb();
  const [server] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
  if (
    server?.ownerProfileId === profile.id ||
    (serverId === DEFAULT_SERVER_ID && profile.isOwner)
  ) {
    return ALL_PERMISSIONS;
  }
  const memberTag = `@${profile.username}`;
  const [assignment] = await db
    .select()
    .from(memberRoles)
    .where(
      and(
        eq(memberRoles.serverId, serverId),
        eq(memberRoles.memberTag, memberTag),
      ),
    )
    .limit(1);
  const roleId = assignment?.roleId || `${serverId}:member`;
  const [role] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
  return role?.permissions ?? 0;
}

export async function requirePermission(
  profile: typeof profiles.$inferSelect,
  permission: number,
  serverId = DEFAULT_SERVER_ID,
) {
  const permissions = await permissionsFor(profile, serverId);
  if ((permissions & permission) !== permission) {
    throw new ApiError(403, "Bu işlem için gerekli yetkin yok.");
  }
  return permissions;
}

export async function writeAudit(
  actorProfileId: string,
  action: string,
  targetId?: string,
  detail?: string,
  serverId = DEFAULT_SERVER_ID,
) {
  const db = getDb();
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    serverId,
    actorProfileId,
    action,
    targetId,
    detail: detail?.slice(0, 500),
    createdAt: new Date().toISOString(),
  });
}
