import { and, eq, inArray } from "drizzle-orm";
import {
  auditLogs,
  channels,
  invites,
  memberRoles,
  messages,
  roles,
  rtcSignals,
  serverBans,
  serverMembers,
  servers,
} from "@/db/schema";
import {
  DEFAULT_SERVER_ID,
  defaultRoles,
  ensureMembership,
  requireProfile,
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
import { getDb } from "@/db";

type ServerPayload = { id?: string; name?: string };

function serverSlug(name: string) {
  const base = name
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28) || "topluluk";
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

export async function GET(request: Request) {
  try {
    const identity = requireIdentity(request);
    const profile = await requireProfile(identity);
    const db = getDb();
    const memberships = await db
      .select({ serverId: serverMembers.serverId })
      .from(serverMembers)
      .where(eq(serverMembers.profileId, profile.id));
    const serverIds = new Set(memberships.map((item) => item.serverId));
    if (profile.isOwner) serverIds.add(DEFAULT_SERVER_ID);
    if (!serverIds.size) return apiJson({ servers: [] });
    const rows = await db
      .select()
      .from(servers)
      .where(inArray(servers.id, Array.from(serverIds)));
    return apiJson({ servers: rows });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = requireIdentity(request);
    const profile = await requireProfile(identity);
    await enforceRateLimit(request, "server-create", identity.email, 3, 24 * 60 * 60_000);
    const payload = await readJson<ServerPayload>(request, 4_096);
    const name = cleanText(payload.name, { min: 2, max: 40 });
    const db = getDb();
    const owned = await db
      .select({ id: servers.id })
      .from(servers)
      .where(eq(servers.ownerProfileId, profile.id));
    if (owned.length >= 5) {
      return apiJson({ error: "Ücretsiz sürümde en fazla 5 topluluk kurabilirsin." }, { status: 400 });
    }
    const id = serverSlug(name);
    const now = new Date().toISOString();
    const server = {
      id,
      name,
      icon: name.slice(0, 2).toLocaleUpperCase("tr-TR"),
      ownerProfileId: profile.id,
      createdAt: now,
    };
    await db.insert(servers).values(server);
    await db.insert(channels).values([
      {
        id: `${id}:genel`,
        serverId: id,
        name: "genel",
        kind: "text",
        position: 0,
        createdAt: now,
      },
      {
        id: `${id}:muhabbet`,
        serverId: id,
        name: "Muhabbet",
        kind: "voice",
        position: 1,
        createdAt: now,
      },
    ]);
    await db.insert(roles).values(defaultRoles(id));
    await ensureMembership(profile.id, id);
    await db.insert(memberRoles).values({
      id: `${id}:@${profile.username}`,
      serverId: id,
      memberTag: `@${profile.username}`,
      roleId: `${id}:owner`,
      createdAt: now,
    });
    await writeAudit(profile.id, "server.create", id, name, id);
    return apiJson({ server }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = requireIdentity(request);
    const profile = await requireProfile(identity);
    await enforceRateLimit(request, "server-delete", identity.email, 3, 24 * 60 * 60_000);
    const payload = await readJson<ServerPayload>(request, 2_048);
    const id = cleanText(payload.id, { max: 80 });
    if (id === DEFAULT_SERVER_ID) {
      return apiJson({ error: "Ana Kuzens topluluğu silinemez." }, { status: 400 });
    }
    const db = getDb();
    const [server] = await db
      .select()
      .from(servers)
      .where(and(eq(servers.id, id), eq(servers.ownerProfileId, profile.id)))
      .limit(1);
    if (!server) return apiJson({ error: "Topluluk bulunamadı." }, { status: 404 });
    const channelRows = await db
      .select({ id: channels.id })
      .from(channels)
      .where(eq(channels.serverId, id));
    const channelIds = channelRows.map((item) => item.id);
    if (channelIds.length) {
      await db.delete(messages).where(inArray(messages.channelId, channelIds));
    }
    await db.delete(rtcSignals).where(eq(rtcSignals.serverId, id));
    await db.delete(serverBans).where(eq(serverBans.serverId, id));
    await db.delete(invites).where(eq(invites.serverId, id));
    await db.delete(memberRoles).where(eq(memberRoles.serverId, id));
    await db.delete(serverMembers).where(eq(serverMembers.serverId, id));
    await db.delete(roles).where(eq(roles.serverId, id));
    await db.delete(channels).where(eq(channels.serverId, id));
    await db.delete(auditLogs).where(eq(auditLogs.serverId, id));
    await db.delete(servers).where(eq(servers.id, id));
    return apiJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
