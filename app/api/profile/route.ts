import { eq, sql } from "drizzle-orm";
import { invites, memberRoles, profiles, servers } from "@/db/schema";
import {
  DEFAULT_SERVER_ID,
  ensureCommunity,
  ensureMembership,
  findProfile,
  isPrimaryOwnerEmail,
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

const LEGAL_VERSION = "2026-07-25.v1";

type RegistrationPayload = {
  displayName?: string;
  username?: string;
  inviteCode?: string | null;
  birthConfirmed?: boolean;
  termsAccepted?: boolean;
  noticeRead?: boolean;
  communityAccepted?: boolean;
};

export async function GET(request: Request) {
  try {
    const identity = requireIdentity(request);
    let profile = await findProfile(identity);
    if (profile && isPrimaryOwnerEmail(identity.email) && !profile.isOwner) {
      const { getDb } = await import("@/db");
      await getDb()
        .update(profiles)
        .set({ isOwner: true })
        .where(eq(profiles.id, profile.id));
      profile = { ...profile, isOwner: true };
    }
    if (profile?.isOwner) {
      const { getDb } = await import("@/db");
      const db = getDb();
      await db
        .update(servers)
        .set({ ownerProfileId: profile.id })
        .where(eq(servers.id, DEFAULT_SERVER_ID));
      await ensureMembership(profile.id, DEFAULT_SERVER_ID);
      await db
        .insert(memberRoles)
        .values({
          id: `${DEFAULT_SERVER_ID}:@${profile.username}:owner`,
          serverId: DEFAULT_SERVER_ID,
          memberTag: `@${profile.username}`,
          roleId: `${DEFAULT_SERVER_ID}:owner`,
          createdAt: new Date().toISOString(),
        })
        .onConflictDoNothing();
    }
    return apiJson({
      profile: profile ?? null,
      identity: {
        displayName: identity.displayName,
        suggestedUsername: identity.email
          .split("@")[0]
          .replace(/[^a-z0-9_]/g, "")
          .slice(0, 24),
      },
      legalVersion: LEGAL_VERSION,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = requireIdentity(request);
    await enforceRateLimit(request, "profile-create", identity.email, 5, 15 * 60_000);
    const payload = await readJson<RegistrationPayload>(request, 8_192);
    const displayName = cleanText(payload.displayName, { min: 2, max: 32 });
    const username =
      typeof payload.username === "string"
        ? payload.username.trim().toLocaleLowerCase("en-US")
        : "";

    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      return apiJson(
        { error: "Kullanıcı adı 3–24 karakter olmalı; yalnızca küçük harf, rakam ve _ kullanılabilir." },
        { status: 400 },
      );
    }
    if (
      payload.birthConfirmed !== true ||
      payload.termsAccepted !== true ||
      payload.noticeRead !== true ||
      payload.communityAccepted !== true
    ) {
      return apiJson({ error: "Zorunlu kayıt onayları tamamlanmalı." }, { status: 400 });
    }

    const db = await ensureCommunity();
    const existing = await findProfile(identity);
    if (existing) return apiJson({ profile: existing });

    const isOwner = isPrimaryOwnerEmail(identity.email);
    let invite: typeof invites.$inferSelect | undefined;
    if (!isOwner) {
      const inviteCode =
        typeof payload.inviteCode === "string"
          ? payload.inviteCode.trim().toLocaleUpperCase("en-US")
          : "";
      if (!/^[A-Z2-9]{10}$/.test(inviteCode)) {
        return apiJson({ error: "Geçerli bir Kuzens daveti gerekiyor." }, { status: 403 });
      }
      [invite] = await db.select().from(invites).where(eq(invites.code, inviteCode)).limit(1);
      if (
        !invite ||
        invite.revokedAt ||
        invite.uses >= invite.maxUses ||
        new Date(invite.expiresAt).getTime() <= Date.now()
      ) {
        return apiJson({ error: "Davet geçersiz, süresi dolmuş veya kullanım sınırına ulaşmış." }, { status: 403 });
      }
    }

    const now = new Date().toISOString();
    const profile = {
      id: crypto.randomUUID(),
      email: identity.email,
      displayName,
      username,
      isOwner,
      birthConfirmed: true,
      termsVersion: LEGAL_VERSION,
      noticeVersion: LEGAL_VERSION,
      communityVersion: LEGAL_VERSION,
      acceptedAt: now,
      createdAt: now,
    };
    await db.insert(profiles).values(profile);
    const targetServerId = invite?.serverId || DEFAULT_SERVER_ID;
    if (isOwner) {
      await db
        .update(servers)
        .set({ ownerProfileId: profile.id })
        .where(eq(servers.id, DEFAULT_SERVER_ID));
    }
    await ensureMembership(profile.id, targetServerId);
    await db
      .insert(memberRoles)
      .values({
        id: `${targetServerId}:@${username}:${isOwner ? "owner" : "member"}`,
        serverId: targetServerId,
        memberTag: `@${username}`,
        roleId: `${targetServerId}:${isOwner ? "owner" : "member"}`,
        createdAt: now,
      })
      .onConflictDoNothing();
    if (invite) {
      await db
        .update(invites)
        .set({ uses: sql`${invites.uses} + 1` })
        .where(eq(invites.id, invite.id));
    }
    return apiJson({ profile }, { status: 201 });
  } catch (error) {
    const duplicate =
      error instanceof Error && /unique|constraint/i.test(error.message);
    if (duplicate) {
      return apiJson({ error: "Bu kullanıcı adı zaten kullanılıyor." }, { status: 409 });
    }
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = requireIdentity(request);
    await enforceRateLimit(request, "profile-update", identity.email, 10, 60 * 60_000);
    const payload = await readJson<{
      displayName?: string;
      username?: string;
      bio?: string;
      customStatus?: string;
      presenceStatus?: "online" | "idle" | "dnd" | "invisible";
    }>(request, 8_192);
    const existing = await findProfile(identity);
    if (!existing) {
      return apiJson({ error: "Profil bulunamadı." }, { status: 404 });
    }
    const displayName = cleanText(payload.displayName, { min: 2, max: 32 });
    const username =
      typeof payload.username === "string"
        ? payload.username.trim().toLocaleLowerCase("en-US")
        : "";
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      return apiJson(
        { error: "Kullanıcı adı 3–24 karakter olmalı; küçük harf, rakam ve _ kullanılabilir." },
        { status: 400 },
      );
    }
    const bio = cleanText(payload.bio ?? "", { min: 0, max: 190, multiline: true });
    const customStatus = cleanText(payload.customStatus ?? "", { min: 0, max: 80 });
    const presenceStatus = ["online", "idle", "dnd", "invisible"].includes(
      payload.presenceStatus || "",
    )
      ? payload.presenceStatus!
      : "online";
    const db = await import("@/db").then(({ getDb }) => getDb());
    const [usernameOwner] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.username, username))
      .limit(1);
    if (usernameOwner && usernameOwner.id !== existing.id) {
      return apiJson({ error: "Bu kullanıcı adı zaten kullanılıyor." }, { status: 409 });
    }
    if (username !== existing.username) {
      await db
        .update(memberRoles)
        .set({ memberTag: `@${username}` })
        .where(eq(memberRoles.memberTag, `@${existing.username}`));
    }
    await db
      .update(profiles)
      .set({ displayName, username, bio, customStatus, presenceStatus })
      .where(eq(profiles.id, existing.id));
    return apiJson({
      profile: {
        ...existing,
        displayName,
        username,
        bio,
        customStatus,
        presenceStatus,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
