import { and, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { directMessageRequests, friendships, profiles } from "@/db/schema";
import { requireProfile } from "@/lib/community";
import {
  apiError,
  apiJson,
  assertTrustedMutation,
  cleanText,
  enforceRateLimit,
  readJson,
  requireIdentity,
} from "@/lib/security";
import { avatarUrlFor } from "@/lib/profile-view";

type FriendPayload = {
  action?: "request" | "accept" | "remove" | "block";
  username?: string;
  profileId?: string;
};

function relationshipId(first: string, second: string) {
  return [first, second].sort().join(":");
}

export async function GET(request: Request) {
  try {
    const identity = requireIdentity(request);
    const profile = await requireProfile(identity);
    const db = getDb();
    const rows = await db
      .select()
      .from(friendships)
      .where(
        or(
          eq(friendships.requesterProfileId, profile.id),
          eq(friendships.addresseeProfileId, profile.id),
        ),
      );
    const profileIds = new Set(
      rows.flatMap((row) => [row.requesterProfileId, row.addresseeProfileId]),
    );
    const profileRows = await db.select().from(profiles);
    const profileById = new Map(
      profileRows
        .filter((item) => profileIds.has(item.id))
        .map((item) => [item.id, item]),
    );
    const items = rows.map((row) => {
      const otherId =
        row.requesterProfileId === profile.id
          ? row.addresseeProfileId
          : row.requesterProfileId;
      const other = profileById.get(otherId);
      return {
        id: row.id,
        status: row.status,
        direction:
          row.requesterProfileId === profile.id ? "outgoing" : "incoming",
        profile: other
          ? {
              id: other.id,
              name: other.displayName,
              tag: `@${other.username}`,
              avatarUrl: avatarUrlFor(other.id, other.avatarKey),
            }
          : null,
      };
    });
    return apiJson({ friends: items.filter((item) => item.profile) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = requireIdentity(request);
    const profile = await requireProfile(identity);
    await enforceRateLimit(request, "friend-action", identity.email, 20, 24 * 60 * 60_000);
    const payload = await readJson<FriendPayload>(request, 4_096);
    const db = getDb();
    const now = new Date().toISOString();

    if (payload.action === "request") {
      const username =
        typeof payload.username === "string"
          ? payload.username.trim().toLocaleLowerCase("en-US").replace(/^@/, "")
          : "";
      if (!/^[a-z0-9_]{3,24}$/.test(username)) {
        return apiJson({ error: "Geçerli bir kullanıcı adı gir." }, { status: 400 });
      }
      const [target] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.username, username))
        .limit(1);
      if (!target || target.id === profile.id) {
        return apiJson({ error: "Kullanıcı bulunamadı." }, { status: 404 });
      }
      const id = relationshipId(profile.id, target.id);
      const [existing] = await db
        .select()
        .from(friendships)
        .where(eq(friendships.id, id))
        .limit(1);
      if (existing?.status === "blocked") {
        return apiJson({ error: "Bu kullanıcıyla arkadaşlık işlemi yapılamıyor." }, { status: 403 });
      }
      if (existing) {
        return apiJson({ error: "Bu kullanıcıyla zaten bir arkadaşlık işlemin var." }, { status: 409 });
      }
      await db.insert(friendships).values({
        id,
        requesterProfileId: profile.id,
        addresseeProfileId: target.id,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });
      return apiJson({ ok: true }, { status: 201 });
    }

    const targetProfileId = cleanText(payload.profileId, { max: 80 });
    const id = relationshipId(profile.id, targetProfileId);
    const [existing] = await db
      .select()
      .from(friendships)
      .where(eq(friendships.id, id))
      .limit(1);
    if (!existing) {
      if (payload.action === "block") {
        const [target] = await db
          .select({ id: profiles.id })
          .from(profiles)
          .where(eq(profiles.id, targetProfileId))
          .limit(1);
        if (!target || target.id === profile.id) {
          return apiJson({ error: "Kullanıcı engellenemedi." }, { status: 400 });
        }
        await db.insert(friendships).values({
          id,
          requesterProfileId: profile.id,
          addresseeProfileId: targetProfileId,
          status: "blocked",
          createdAt: now,
          updatedAt: now,
        });
        return apiJson({ ok: true });
      }
      return apiJson({ error: "Arkadaşlık kaydı bulunamadı." }, { status: 404 });
    }

    if (payload.action === "accept") {
      if (
        existing.status !== "pending" ||
        existing.addresseeProfileId !== profile.id
      ) {
        return apiJson({ error: "Bu isteği kabul edemezsin." }, { status: 403 });
      }
      await db
        .update(friendships)
        .set({ status: "accepted", updatedAt: now })
        .where(eq(friendships.id, id));
      await db
        .update(directMessageRequests)
        .set({ status: "accepted", updatedAt: now })
        .where(
          and(
            eq(directMessageRequests.status, "pending"),
            or(
              and(
                eq(directMessageRequests.requesterProfileId, existing.requesterProfileId),
                eq(directMessageRequests.recipientProfileId, existing.addresseeProfileId),
              ),
              and(
                eq(directMessageRequests.requesterProfileId, existing.addresseeProfileId),
                eq(directMessageRequests.recipientProfileId, existing.requesterProfileId),
              ),
            ),
          ),
        );
      return apiJson({ ok: true });
    }

    if (payload.action === "block") {
      if (
        existing.status === "blocked" &&
        existing.requesterProfileId !== profile.id
      ) {
        return apiJson({ error: "Bu ilişki üzerinde işlem yapamazsın." }, { status: 403 });
      }
      await db
        .update(friendships)
        .set({
          requesterProfileId: profile.id,
          addresseeProfileId: targetProfileId,
          status: "blocked",
          updatedAt: now,
        })
        .where(eq(friendships.id, id));
      return apiJson({ ok: true });
    }

    if (payload.action === "remove") {
      if (
        existing.status === "blocked" &&
        existing.requesterProfileId !== profile.id
      ) {
        return apiJson({ error: "Bu ilişki üzerinde işlem yapamazsın." }, { status: 403 });
      }
      await db
        .delete(friendships)
        .where(
          and(
            eq(friendships.id, id),
            or(
              eq(friendships.requesterProfileId, profile.id),
              eq(friendships.addresseeProfileId, profile.id),
            ),
          ),
        );
      return apiJson({ ok: true });
    }
    return apiJson({ error: "Geçersiz arkadaşlık işlemi." }, { status: 400 });
  } catch (error) {
    return apiError(error);
  }
}
