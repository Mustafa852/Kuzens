import { count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { memberRoles, profiles, roles } from "@/db/schema";
import { getRequestIdentity } from "@/lib/identity";

const LEGAL_VERSION = "2026-07-25.v1";

export async function GET(request: Request) {
  try {
    const identity = getRequestIdentity(request);
    const db = getDb();
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.email, identity.email))
      .limit(1);

    return Response.json({
      profile: profile ?? null,
      identity: {
        displayName: identity.displayName,
        suggestedUsername: identity.email.split("@")[0].replace(/[^a-z0-9_]/g, "").slice(0, 24),
      },
      legalVersion: LEGAL_VERSION,
    });
  } catch {
    return Response.json({
      profile: null,
      identity: { displayName: "Savaş", suggestedUsername: "savas" },
      legalVersion: LEGAL_VERSION,
      mode: "demo",
    });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      displayName?: string;
      username?: string;
      birthConfirmed?: boolean;
      termsAccepted?: boolean;
      noticeRead?: boolean;
      communityAccepted?: boolean;
    };
    const displayName = payload.displayName?.trim() || "";
    const username = payload.username?.trim().toLocaleLowerCase("en-US") || "";

    if (displayName.length < 2 || displayName.length > 32) {
      return Response.json({ error: "Görünen ad 2–32 karakter olmalı." }, { status: 400 });
    }
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      return Response.json(
        { error: "Kullanıcı adı 3–24 karakter olmalı; yalnızca küçük harf, rakam ve _ kullanılabilir." },
        { status: 400 },
      );
    }
    if (!payload.birthConfirmed || !payload.termsAccepted || !payload.noticeRead || !payload.communityAccepted) {
      return Response.json({ error: "Zorunlu kayıt onayları tamamlanmalı." }, { status: 400 });
    }

    const identity = getRequestIdentity(request);
    const db = getDb();
    const [existing] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.email, identity.email))
      .limit(1);
    if (existing) return Response.json({ profile: existing });

    const [{ value: profileCount }] = await db.select({ value: count() }).from(profiles);
    const now = new Date().toISOString();
    const profile = {
      id: crypto.randomUUID(),
      email: identity.email,
      displayName,
      username,
      isOwner: profileCount === 0,
      birthConfirmed: true,
      termsVersion: LEGAL_VERSION,
      noticeVersion: LEGAL_VERSION,
      communityVersion: LEGAL_VERSION,
      acceptedAt: now,
      createdAt: now,
    };
    await db.insert(profiles).values(profile);

    if (profile.isOwner) {
      const ownerRole = {
        id: "kuzens:owner",
        serverId: "kuzens",
        name: "Kurucu",
        color: "#ffd166",
        permissions: 255,
        position: 0,
        createdAt: now,
      };
      await db.insert(roles).values(ownerRole).onConflictDoNothing();
      await db.insert(memberRoles).values({
        id: `kuzens:@${username}`,
        serverId: "kuzens",
        memberTag: `@${username}`,
        roleId: ownerRole.id,
        createdAt: now,
      }).onConflictDoNothing();
    }

    return Response.json({ profile }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kayıt oluşturulamadı.";
    const isDuplicate = /unique|constraint/i.test(message);
    return Response.json(
      { error: isDuplicate ? "Bu kullanıcı adı zaten kullanılıyor." : message },
      { status: isDuplicate ? 409 : 500 },
    );
  }
}
