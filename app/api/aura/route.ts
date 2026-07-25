import { and, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import {
  auraCodes,
  auraMemberships,
  auraRedemptions,
  profiles,
} from "@/db/schema";
import { requireProfile } from "@/lib/community";
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
import { getDb } from "@/db";

type AuraPayload = {
  action?: "redeem" | "create-code" | "grant" | "revoke" | "disable-code";
  code?: string;
  codeId?: string;
  username?: string;
  durationDays?: number | null;
  maxUses?: number;
};

function normalizeCode(value: unknown) {
  if (typeof value !== "string") throw new ApiError(400, "Aura kodu geçersiz.");
  const normalized = value
    .toLocaleUpperCase("en-US")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
  if (!/^AURA[A-Z0-9]{12}$/.test(normalized)) {
    throw new ApiError(400, "Aura kodu AURA-XXXX-XXXX-XXXX biçiminde olmalı.");
  }
  return normalized;
}

async function hashCode(code: string) {
  const bytes = new TextEncoder().encode(code);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const body = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `AURA-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
}

function validatedDuration(value: unknown, allowLifetime = false) {
  if (allowLifetime && value === null) return null;
  if (!Number.isInteger(value) || ![30, 90, 365].includes(Number(value))) {
    throw new ApiError(400, "Süre 30, 90 veya 365 gün olmalı.");
  }
  return Number(value);
}

function membershipExpiry(
  current: string | null | undefined,
  durationDays: number | null,
  hasMembership = false,
) {
  if (durationDays === null) return null;
  if (hasMembership && current === null) return null;
  const now = Date.now();
  const currentTime = current ? new Date(current).getTime() : 0;
  const base = Number.isFinite(currentTime) && currentTime > now ? currentTime : now;
  return new Date(base + durationDays * 86_400_000).toISOString();
}

function isAuraActive(expiresAt: string | null | undefined) {
  return expiresAt === null || Boolean(expiresAt && new Date(expiresAt).getTime() > Date.now());
}

export async function GET(request: Request) {
  try {
    const identity = requireIdentity(request);
    const profile = await requireProfile(identity);
    const db = getDb();
    const [membership] = await db
      .select()
      .from(auraMemberships)
      .where(eq(auraMemberships.profileId, profile.id))
      .limit(1);

    let owner:
      | {
          codes: Array<typeof auraCodes.$inferSelect>;
          memberships: Array<{
            id: string;
            profileId: string;
            username: string;
            displayName: string;
            source: string;
            expiresAt: string | null;
          }>;
        }
      | undefined;

    if (profile.isOwner) {
      const [codes, memberships] = await Promise.all([
        db
          .select()
          .from(auraCodes)
          .where(eq(auraCodes.createdByProfileId, profile.id))
          .orderBy(desc(auraCodes.createdAt))
          .limit(50),
        db
          .select({
            id: auraMemberships.id,
            profileId: auraMemberships.profileId,
            username: profiles.username,
            displayName: profiles.displayName,
            source: auraMemberships.source,
            expiresAt: auraMemberships.expiresAt,
          })
          .from(auraMemberships)
          .innerJoin(profiles, eq(auraMemberships.profileId, profiles.id))
          .where(
            or(
              isNull(auraMemberships.expiresAt),
              gt(auraMemberships.expiresAt, new Date().toISOString()),
            ),
          )
          .orderBy(desc(auraMemberships.updatedAt))
          .limit(100),
      ]);
      owner = { codes, memberships };
    }

    return apiJson({
      membership: membership
        ? { ...membership, active: isAuraActive(membership.expiresAt) }
        : null,
      owner,
      perks: [
        "Profilinde özel Aura rozeti",
        "1080p ve 60 FPS ekran paylaşımı",
        "10 adede kadar topluluk kurabilme",
        "Aura renkleri ve destekçi görünümü",
        "Süreli veya süresiz hediye üyelik",
        "Öncelikli deneysel özellik erişimi",
      ],
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = requireIdentity(request);
    const profile = await requireProfile(identity);
    const payload = await readJson<AuraPayload>(request, 8_192);
    const db = getDb();

    if (payload.action === "redeem") {
      await enforceRateLimit(request, "aura-redeem", identity.email, 8, 60 * 60_000);
      const normalized = normalizeCode(payload.code);
      const codeHash = await hashCode(normalized);
      const [code] = await db
        .select()
        .from(auraCodes)
        .where(eq(auraCodes.codeHash, codeHash))
        .limit(1);
      if (!code || !code.active || code.uses >= code.maxUses) {
        throw new ApiError(400, "Bu Aura kodu geçersiz, kapalı veya kullanım sınırına ulaşmış.");
      }
      const [redeemed] = await db
        .select({ id: auraRedemptions.id })
        .from(auraRedemptions)
        .where(
          and(
            eq(auraRedemptions.codeId, code.id),
            eq(auraRedemptions.profileId, profile.id),
          ),
        )
        .limit(1);
      if (redeemed) throw new ApiError(400, "Bu Aura kodunu daha önce kullandın.");

      const [current] = await db
        .select()
        .from(auraMemberships)
        .where(eq(auraMemberships.profileId, profile.id))
        .limit(1);
      const now = new Date().toISOString();
      const expiresAt = membershipExpiry(current?.expiresAt, code.durationDays, Boolean(current));
      await db.insert(auraRedemptions).values({
        id: crypto.randomUUID(),
        codeId: code.id,
        profileId: profile.id,
        redeemedAt: now,
      });
      await db
        .update(auraCodes)
        .set({ uses: sql`${auraCodes.uses} + 1` })
        .where(and(eq(auraCodes.id, code.id), lt(auraCodes.uses, auraCodes.maxUses)));
      await db
        .insert(auraMemberships)
        .values({
          id: crypto.randomUUID(),
          profileId: profile.id,
          source: "code",
          expiresAt,
          createdAt: current?.createdAt || now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: auraMemberships.profileId,
          set: { source: "code", expiresAt, updatedAt: now },
        });
      return apiJson({ ok: true, expiresAt });
    }

    if (!profile.isOwner) {
      throw new ApiError(403, "Bu işlem yalnızca Kuzens sahibine açıktır.");
    }
    await enforceRateLimit(request, "aura-owner", identity.email, 40, 60 * 60_000);

    if (payload.action === "create-code") {
      const durationDays = validatedDuration(payload.durationDays);
      const maxUses = Number(payload.maxUses ?? 1);
      if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100) {
        throw new ApiError(400, "Kod kullanım sınırı 1–100 arasında olmalı.");
      }
      const plainCode = randomCode();
      const normalized = normalizeCode(plainCode);
      const now = new Date().toISOString();
      const code = {
        id: crypto.randomUUID(),
        codeHash: await hashCode(normalized),
        codeHint: `AURA-••••-••••-${plainCode.slice(-4)}`,
        durationDays,
        maxUses,
        uses: 0,
        active: true,
        createdByProfileId: profile.id,
        createdAt: now,
      };
      await db.insert(auraCodes).values(code);
      return apiJson({ code: plainCode, item: code }, { status: 201 });
    }

    if (payload.action === "grant") {
      const username = cleanText(payload.username, { min: 3, max: 24 })
        .toLocaleLowerCase("en-US")
        .replace(/^@/, "");
      const durationDays = validatedDuration(payload.durationDays, true);
      const [target] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.username, username))
        .limit(1);
      if (!target) throw new ApiError(404, "Kullanıcı bulunamadı.");
      const [current] = await db
        .select()
        .from(auraMemberships)
        .where(eq(auraMemberships.profileId, target.id))
        .limit(1);
      const now = new Date().toISOString();
      const expiresAt = membershipExpiry(current?.expiresAt, durationDays, Boolean(current));
      await db
        .insert(auraMemberships)
        .values({
          id: crypto.randomUUID(),
          profileId: target.id,
          source: "owner",
          grantedByProfileId: profile.id,
          expiresAt,
          createdAt: current?.createdAt || now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: auraMemberships.profileId,
          set: {
            source: "owner",
            grantedByProfileId: profile.id,
            expiresAt,
            updatedAt: now,
          },
        });
      return apiJson({ ok: true, expiresAt });
    }

    if (payload.action === "revoke") {
      const username = cleanText(payload.username, { min: 3, max: 24 })
        .toLocaleLowerCase("en-US")
        .replace(/^@/, "");
      const [target] = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.username, username))
        .limit(1);
      if (!target) throw new ApiError(404, "Kullanıcı bulunamadı.");
      await db.delete(auraMemberships).where(eq(auraMemberships.profileId, target.id));
      return apiJson({ ok: true });
    }

    if (payload.action === "disable-code") {
      const codeId = cleanText(payload.codeId, { max: 80 });
      await db
        .update(auraCodes)
        .set({ active: false })
        .where(
          and(
            eq(auraCodes.id, codeId),
            eq(auraCodes.createdByProfileId, profile.id),
          ),
        );
      return apiJson({ ok: true });
    }

    throw new ApiError(400, "Aura işlemi geçersiz.");
  } catch (error) {
    return apiError(error);
  }
}
