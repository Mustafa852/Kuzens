import { and, eq, gt, sql } from "drizzle-orm";
import { invites, memberRoles, profiles, serverAutoModerationSettings, serverMembers, servers } from "@/db/schema";
import { publicProfile } from "@/lib/profile-view";
import { getUploads } from "@/lib/storage";
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

function decodeProfileImage(value: unknown, maxBytes = 600_000, label = "Profil fotoğrafı") {
  if (typeof value !== "string") {
    throw new Error("Profil fotoğrafı verisi geçersiz.");
  }
  const match = value.match(
    /^data:(image\/(?:webp|png|jpeg));base64,([A-Za-z0-9+/=]+)$/,
  );
  if (!match) throw new Error("Profil fotoğrafı WebP, PNG veya JPEG olmalı.");
  const binary = atob(match[2]);
  if (binary.length < 32 || binary.length > maxBytes) {
    throw new Error(`${label} en fazla ${Math.round(maxBytes / 100_000) / 10} MB olabilir.`);
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  const isJpeg =
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp =
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (
    (match[1] === "image/png" && !isPng) ||
    (match[1] === "image/jpeg" && !isJpeg) ||
    (match[1] === "image/webp" && !isWebp)
  ) {
    throw new Error("Profil fotoğrafının dosya imzası doğrulanamadı.");
  }
  return { bytes, contentType: match[1] };
}

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
      profile: profile ? publicProfile(profile) : null,
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
    if (existing) return apiJson({ profile: publicProfile(existing) });

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
      const [autoMod] = await db
        .select()
        .from(serverAutoModerationSettings)
        .where(eq(serverAutoModerationSettings.serverId, invite.serverId))
        .limit(1);
      if (autoMod?.enabled && autoMod.raidJoinLimit > 0) {
        const recentJoins = await db
          .select({ id: serverMembers.id })
          .from(serverMembers)
          .where(and(eq(serverMembers.serverId, invite.serverId), gt(serverMembers.joinedAt, new Date(Date.now() - 60_000).toISOString())));
        if (recentJoins.length >= autoMod.raidJoinLimit) {
          return apiJson({ error: "Toplu katılım koruması etkin. Birkaç dakika sonra tekrar dene." }, { status: 429 });
        }
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
    return apiJson({ profile: publicProfile(profile) }, { status: 201 });
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
      avatarDataUrl?: string;
      removeAvatar?: boolean;
      bannerDataUrl?: string;
      removeBanner?: boolean;
      profileColor?: string;
      statusExpiresAt?: string | null;
      allowFriendRequests?: boolean;
    }>(request, 900_000);
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
    const profileColor = /^#[0-9a-f]{6}$/i.test(payload.profileColor || "")
      ? payload.profileColor!.toLocaleLowerCase("en-US")
      : existing.profileColor || "#8b5cf6";
    let statusExpiresAt: string | null = null;
    if (payload.statusExpiresAt) {
      const statusDate = new Date(payload.statusExpiresAt);
      if (Number.isNaN(statusDate.getTime()) || statusDate.getTime() <= Date.now()) {
        return apiJson({ error: "Durum bitiş zamanı gelecekte olmalı." }, { status: 400 });
      }
      statusExpiresAt = statusDate.toISOString();
    }
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
    let avatarKey = existing.avatarKey;
    const previousAvatarKey = existing.avatarKey;
    if (payload.removeAvatar === true) {
      avatarKey = null;
    }
    if (payload.avatarDataUrl) {
      let decoded: ReturnType<typeof decodeProfileImage>;
      try {
        decoded = decodeProfileImage(payload.avatarDataUrl);
      } catch (error) {
        return apiJson(
          {
            error:
              error instanceof Error
                ? error.message
                : "Profil fotoğrafı işlenemedi.",
          },
          { status: 400 },
        );
      }
      const extension =
        decoded.contentType === "image/png"
          ? "png"
          : decoded.contentType === "image/jpeg"
            ? "jpg"
            : "webp";
      avatarKey = `avatars/${existing.id}/${crypto.randomUUID()}.${extension}`;
      await getUploads().put(avatarKey, decoded.bytes, {
        httpMetadata: {
          contentType: decoded.contentType,
          cacheControl: "private, max-age=31536000, immutable",
        },
        customMetadata: { ownerProfileId: existing.id },
      });
    }
    let bannerKey = existing.bannerKey;
    const previousBannerKey = existing.bannerKey;
    if (payload.removeBanner === true) bannerKey = null;
    if (payload.bannerDataUrl) {
      let decoded: ReturnType<typeof decodeProfileImage>;
      try {
        decoded = decodeProfileImage(payload.bannerDataUrl, 1_500_000, "Profil kapağı");
      } catch (error) {
        return apiJson(
          { error: error instanceof Error ? error.message : "Profil kapağı işlenemedi." },
          { status: 400 },
        );
      }
      const extension =
        decoded.contentType === "image/png"
          ? "png"
          : decoded.contentType === "image/jpeg"
            ? "jpg"
            : "webp";
      bannerKey = `banners/${existing.id}/${crypto.randomUUID()}.${extension}`;
      await getUploads().put(bannerKey, decoded.bytes, {
        httpMetadata: {
          contentType: decoded.contentType,
          cacheControl: "private, max-age=31536000, immutable",
        },
        customMetadata: { ownerProfileId: existing.id },
      });
    }
    await db
      .update(profiles)
      .set({
        displayName,
        username,
        bio,
        customStatus,
        presenceStatus,
        avatarKey,
        bannerKey,
        profileColor,
        statusExpiresAt,
        allowFriendRequests: payload.allowFriendRequests ?? existing.allowFriendRequests,
      })
      .where(eq(profiles.id, existing.id));
    if (previousAvatarKey && previousAvatarKey !== avatarKey) {
      await getUploads().delete(previousAvatarKey).catch(() => undefined);
    }
    if (previousBannerKey && previousBannerKey !== bannerKey) {
      await getUploads().delete(previousBannerKey).catch(() => undefined);
    }
    return apiJson({
      profile: publicProfile({
        ...existing,
        displayName,
        username,
        bio,
        customStatus,
        presenceStatus,
        avatarKey,
        bannerKey,
        profileColor,
        statusExpiresAt,
        allowFriendRequests: payload.allowFriendRequests ?? existing.allowFriendRequests,
      }),
    });
  } catch (error) {
    return apiError(error);
  }
}
