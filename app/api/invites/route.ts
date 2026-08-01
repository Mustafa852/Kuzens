import { and, eq, gt, sql } from "drizzle-orm";
import { invites, memberRoles, serverAutoModerationSettings, serverBans, serverMembers, servers } from "@/db/schema";
import {
  DEFAULT_SERVER_ID,
  ensureMembership,
  requireMember,
  requireProfile,
  writeAudit,
} from "@/lib/community";
import {
  apiError,
  apiJson,
  assertTrustedMutation,
  enforceRateLimit,
  readJson,
  requireIdentity,
  cleanText,
} from "@/lib/security";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function inviteCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

function validInvite(invite: typeof invites.$inferSelect | undefined) {
  return Boolean(
    invite &&
      !invite.revokedAt &&
      invite.uses < invite.maxUses &&
      new Date(invite.expiresAt).getTime() > Date.now(),
  );
}

export async function GET(request: Request) {
  try {
    await requireIdentity(request);
    const code = new URL(request.url).searchParams.get("code")?.toLocaleUpperCase("en-US") || "";
    if (!/^[A-Z2-9]{10}$/.test(code)) {
      return apiJson({ valid: false }, { status: 400 });
    }
    const { getDb } = await import("@/db");
    const db = getDb();
    const [invite] = await db.select().from(invites).where(eq(invites.code, code)).limit(1);
    const [server] = invite
      ? await db.select({ name: servers.name }).from(servers).where(eq(servers.id, invite.serverId)).limit(1)
      : [];
    return apiJson({
      valid: validInvite(invite),
      server: server?.name ?? null,
      expiresAt: invite?.expiresAt ?? null,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    const payload = await readJson<{ action?: "create" | "join"; code?: string; serverId?: string }>(
      request,
      2_048,
    );

    if (payload.action === "join") {
      const profile = await requireProfile(identity);
      await enforceRateLimit(request, "invite-join", identity.email, 10, 60 * 60_000);
      const code = payload.code?.trim().toLocaleUpperCase("en-US") || "";
      const { getDb } = await import("@/db");
      const db = getDb();
      const [invite] = await db.select().from(invites).where(eq(invites.code, code)).limit(1);
      if (!validInvite(invite)) {
        return apiJson({ error: "Davet geçersiz veya süresi dolmuş." }, { status: 403 });
      }
      const [ban] = await db
        .select({ id: serverBans.id })
        .from(serverBans)
        .where(
          and(
            eq(serverBans.serverId, invite!.serverId),
            eq(serverBans.profileId, profile.id),
          ),
        )
        .limit(1);
      if (ban) {
        return apiJson({ error: "Bu topluluğa erişimin yasaklanmış." }, { status: 403 });
      }
      const [existingMembership] = await db
        .select({ id: serverMembers.id })
        .from(serverMembers)
        .where(
          and(
            eq(serverMembers.serverId, invite!.serverId),
            eq(serverMembers.profileId, profile.id),
          ),
        )
        .limit(1);
      if (existingMembership) {
        return apiJson({ joined: true, existing: true });
      }
      const [autoMod] = await db
        .select()
        .from(serverAutoModerationSettings)
        .where(eq(serverAutoModerationSettings.serverId, invite!.serverId))
        .limit(1);
      if (autoMod?.enabled && autoMod.raidJoinLimit > 0) {
        const recentJoins = await db
          .select({ id: serverMembers.id })
          .from(serverMembers)
          .where(
            and(
              eq(serverMembers.serverId, invite!.serverId),
              gt(serverMembers.joinedAt, new Date(Date.now() - 60_000).toISOString()),
            ),
          );
        if (recentJoins.length >= autoMod.raidJoinLimit) {
          await writeAudit(profile.id, "automod.raid-block", invite!.id, `${recentJoins.length} katılım/dk`, invite!.serverId);
          return apiJson({ error: "Toplu katılım koruması etkin. Birkaç dakika sonra tekrar dene." }, { status: 429 });
        }
      }
      await ensureMembership(profile.id, invite!.serverId);
      await db
        .insert(memberRoles)
        .values({
          id: `${invite!.serverId}:@${profile.username}`,
          serverId: invite!.serverId,
          memberTag: `@${profile.username}`,
          roleId: `${invite!.serverId}:member`,
          createdAt: new Date().toISOString(),
        })
        .onConflictDoNothing();
      await db
        .update(invites)
        .set({ uses: sql`${invites.uses} + 1` })
        .where(eq(invites.id, invite!.id));
      return apiJson({ joined: true });
    }

    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await enforceRateLimit(request, "invite-create", identity.email, 8, 60 * 60_000);
    const now = Date.now();
    const code = inviteCode();
    const invite = {
      id: crypto.randomUUID(),
      code,
      serverId,
      createdByProfileId: profile.id,
      maxUses: 10,
      uses: 0,
      expiresAt: new Date(now + 24 * 60 * 60_000).toISOString(),
      revokedAt: null,
      createdAt: new Date(now).toISOString(),
    };
    await db.insert(invites).values(invite);
    const url = new URL(request.url);
    url.pathname = "/";
    url.search = `?davet=${code}`;
    return apiJson({ invite, url: url.toString() }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
