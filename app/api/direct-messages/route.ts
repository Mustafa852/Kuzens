import { and, asc, desc, eq, gt, inArray, lte, or } from "drizzle-orm";
import {
  directConversationMembers,
  directConversationReads,
  directConversationSettings,
  directConversations,
  directMessageRequests,
  directMessages,
  directMessageSettings,
  friendships,
  profiles,
  serverMembers,
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
import { avatarUrlFor } from "@/lib/profile-view";

type DirectPayload = {
  action?: "start" | "group" | "rename" | "send" | "privacy" | "read" | "request" | "settings" | "pin";
  conversationId?: string;
  username?: string;
  content?: string;
  allowFrom?: "friends" | "shared_servers" | "none";
  messageId?: string;
  requestResponse?: "accept" | "ignore";
  usernames?: string[];
  name?: string;
  pinned?: boolean;
  mutedMinutes?: number;
};

async function pairConversationId(first: string, second: string) {
  const pair = [first, second].sort().join("|");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pair));
  const hash = Array.from(new Uint8Array(digest))
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `dm:${hash}`;
}

async function requireConversationMember(
  db: ReturnType<typeof getDb>,
  conversationId: string,
  profileId: string,
) {
  const [membership] = await db
    .select()
    .from(directConversationMembers)
    .where(
      and(
        eq(directConversationMembers.conversationId, conversationId),
        eq(directConversationMembers.profileId, profileId),
      ),
    )
    .limit(1);
  if (!membership) throw new ApiError(403, "Bu özel konuşmaya erişimin yok.");
  return membership;
}

async function requireConversationUnblocked(
  db: ReturnType<typeof getDb>,
  conversationId: string,
  profileId: string,
) {
  const members = await db
    .select({ profileId: directConversationMembers.profileId })
    .from(directConversationMembers)
    .where(eq(directConversationMembers.conversationId, conversationId));
  const otherProfileIds = members
    .filter((member) => member.profileId !== profileId)
    .map((member) => member.profileId);
  if (!otherProfileIds.length) throw new ApiError(404, "Özel konuşmanın diğer üyesi bulunamadı.");
  const relationships = await db
    .select({ status: friendships.status })
    .from(friendships)
    .where(
      or(
        and(
          eq(friendships.requesterProfileId, profileId),
          inArray(friendships.addresseeProfileId, otherProfileIds),
        ),
        and(
          inArray(friendships.requesterProfileId, otherProfileIds),
          eq(friendships.addresseeProfileId, profileId),
        ),
      ),
    );
  if (relationships.some((relationship) => relationship.status === "blocked")) {
    throw new ApiError(403, "Engellenen bir kullanıcıyla mesajlaşamazsın.");
  }
}

export async function GET(request: Request) {
  try {
    const identity = await requireIdentity(request);
    await enforceRateLimit(request, "direct-message-sync", identity.email, 180, 60_000);
    const profile = await requireProfile(identity);
    const db = getDb();
    const url = new URL(request.url);
    const conversationId = url.searchParams.get("conversation");

    if (conversationId) {
      const id = cleanText(conversationId, { max: 80 });
      await requireConversationMember(db, id, profile.id);
      const after = url.searchParams.get("after");
      const requestedWait = Number(url.searchParams.get("wait") || 0);
      const waitMs = Number.isFinite(requestedWait)
        ? Math.min(15_000, Math.max(0, Math.trunc(requestedWait)))
        : 0;
      const afterDate = after ? new Date(after) : null;
      if (afterDate && Number.isNaN(afterDate.getTime())) {
        throw new ApiError(400, "Geçersiz eşitleme zamanı.");
      }
      const waitUntil = Date.now() + (afterDate ? waitMs : 0);
      let boundary = new Date().toISOString();
      let rows: Array<{
        id: string;
        conversationId: string;
        authorProfileId: string;
        authorName: string;
        authorUsername: string;
        authorAvatarKey: string | null;
        content: string;
        pinned: boolean;
        editedAt: string | null;
        deletedAt: string | null;
        createdAt: string;
      }> = [];
      do {
        boundary = new Date().toISOString();
        rows = await db
          .select({
            id: directMessages.id,
            conversationId: directMessages.conversationId,
            authorProfileId: directMessages.authorProfileId,
            authorName: profiles.displayName,
            authorUsername: profiles.username,
            authorAvatarKey: profiles.avatarKey,
            content: directMessages.content,
            pinned: directMessages.pinned,
            editedAt: directMessages.editedAt,
            deletedAt: directMessages.deletedAt,
            createdAt: directMessages.createdAt,
          })
          .from(directMessages)
          .innerJoin(profiles, eq(directMessages.authorProfileId, profiles.id))
          .where(
            afterDate
              ? and(
                  eq(directMessages.conversationId, id),
                  gt(directMessages.createdAt, afterDate.toISOString()),
                  lte(directMessages.createdAt, boundary),
                )
              : eq(directMessages.conversationId, id),
          )
          .orderBy(afterDate ? asc(directMessages.createdAt) : desc(directMessages.createdAt))
          .limit(afterDate ? 100 : 250);
        if (rows.length || Date.now() >= waitUntil || request.signal.aborted) break;
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(450, Math.max(25, waitUntil - Date.now()))),
        );
      } while (Date.now() < waitUntil);
      const orderedRows = afterDate ? rows : rows.reverse();
      return apiJson({
        messages: orderedRows.map(({ authorAvatarKey, ...message }) => ({
          ...message,
          authorAvatarUrl: avatarUrlFor(message.authorProfileId, authorAvatarKey),
        })),
        syncedAt: boundary,
      });
    }

    const memberships = await db
      .select({ conversationId: directConversationMembers.conversationId })
      .from(directConversationMembers)
      .where(eq(directConversationMembers.profileId, profile.id));
    const conversationIds = memberships.map((item) => item.conversationId);
    const [privacy] = await db
      .select()
      .from(directMessageSettings)
      .where(eq(directMessageSettings.profileId, profile.id))
      .limit(1);
    if (!conversationIds.length) {
      return apiJson({
        conversations: [],
        requests: [],
        privacy: privacy?.allowFrom || "friends",
      });
    }

    const [conversationRows, memberRows, recentMessages, readRows, requestRows, settingRows] = await Promise.all([
      db
        .select()
        .from(directConversations)
        .where(inArray(directConversations.id, conversationIds))
        .orderBy(desc(directConversations.updatedAt)),
      db
        .select()
        .from(directConversationMembers)
        .where(inArray(directConversationMembers.conversationId, conversationIds)),
      db
        .select()
        .from(directMessages)
        .where(inArray(directMessages.conversationId, conversationIds))
        .orderBy(desc(directMessages.createdAt))
        .limit(500),
      db
        .select()
        .from(directConversationReads)
        .where(
          and(
            eq(directConversationReads.profileId, profile.id),
            inArray(directConversationReads.conversationId, conversationIds),
          ),
        ),
      db
        .select()
        .from(directMessageRequests)
        .where(inArray(directMessageRequests.conversationId, conversationIds)),
      db
        .select()
        .from(directConversationSettings)
        .where(
          and(
            eq(directConversationSettings.profileId, profile.id),
            inArray(directConversationSettings.conversationId, conversationIds),
          ),
        ),
    ]);
    const otherProfileIds = memberRows
      .filter((item) => item.profileId !== profile.id)
      .map((item) => item.profileId);
    const otherProfiles = otherProfileIds.length
      ? await db.select().from(profiles).where(inArray(profiles.id, otherProfileIds))
      : [];
    const blockedRelationships = await db
      .select({
        requesterProfileId: friendships.requesterProfileId,
        addresseeProfileId: friendships.addresseeProfileId,
      })
      .from(friendships)
      .where(
        and(
          eq(friendships.status, "blocked"),
          or(
            eq(friendships.requesterProfileId, profile.id),
            eq(friendships.addresseeProfileId, profile.id),
          ),
        ),
      );
    const blockedProfileIds = new Set(
      blockedRelationships.map((item) =>
        item.requesterProfileId === profile.id
          ? item.addresseeProfileId
          : item.requesterProfileId,
      ),
    );
    const allConversations = conversationRows
      .map((conversation) => {
        const otherMembership = memberRows.find(
          (item) =>
            item.conversationId === conversation.id &&
            item.profileId !== profile.id,
        );
        const other = otherProfiles.find((item) => item.id === otherMembership?.profileId);
        const lastMessage = recentMessages.find(
          (message) => message.conversationId === conversation.id,
        );
        const lastReadAt =
          readRows.find((item) => item.conversationId === conversation.id)?.lastReadAt ||
          conversation.createdAt;
        const unreadCount = recentMessages.filter(
          (message) =>
            message.conversationId === conversation.id &&
            message.authorProfileId !== profile.id &&
            !message.deletedAt &&
            message.createdAt > lastReadAt,
        ).length;
        const request = requestRows.find(
          (item) => item.conversationId === conversation.id,
        );
        const settings = settingRows.find(
          (item) => item.conversationId === conversation.id,
        );
        const conversationMemberIds = memberRows
          .filter(
            (item) =>
              item.conversationId === conversation.id && item.profileId !== profile.id,
          )
          .map((item) => item.profileId);
        const groupProfiles = otherProfiles.filter((item) =>
          conversationMemberIds.includes(item.id),
        );
        if (!other || groupProfiles.some((item) => blockedProfileIds.has(item.id))) return null;
        return {
          id: conversation.id,
          isGroup: conversation.isGroup,
          name: conversation.isGroup
            ? conversation.name || groupProfiles.map((item) => item.displayName).join(", ")
            : null,
          members: groupProfiles.map((item) => ({
            id: item.id,
            name: item.displayName,
            username: item.username,
            avatarUrl: avatarUrlFor(item.id, item.avatarKey),
          })),
          profile: {
            id: other.id,
            name: other.displayName,
            username: other.username,
            bio: other.bio,
            status: other.customStatus,
            avatarUrl: avatarUrlFor(other.id, other.avatarKey),
          },
          lastMessage: lastMessage?.deletedAt
            ? "Mesaj silindi"
            : lastMessage?.content || "Yeni konuşma",
          updatedAt: conversation.updatedAt,
          unreadCount,
          pinned: settings?.pinned || false,
          mutedUntil: settings?.mutedUntil || null,
          requestStatus: request?.status || null,
          requestDirection: request
            ? request.recipientProfileId === profile.id
              ? "incoming"
              : "outgoing"
            : null,
        };
      })
      .filter(Boolean);
    const conversations = allConversations.filter(
      (conversation) =>
        conversation &&
        conversation.requestStatus !== "ignored" &&
        !(
          conversation.requestStatus === "pending" &&
          conversation.requestDirection === "incoming"
        ),
    ).sort((left, right) => Number(Boolean(right?.pinned)) - Number(Boolean(left?.pinned)));
    const requests = allConversations.filter(
      (conversation) =>
        conversation?.requestStatus === "pending" &&
        conversation.requestDirection === "incoming",
    );
    return apiJson({
      conversations,
      requests,
      privacy: privacy?.allowFrom || "friends",
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    const profile = await requireProfile(identity);
    const payload = await readJson<DirectPayload>(request, 16_384);
    const db = getDb();

    if (payload.action === "request") {
      await enforceRateLimit(request, "dm-request", identity.email, 30, 60_000);
      const conversationId = cleanText(payload.conversationId, { max: 80 });
      if (!["accept", "ignore"].includes(payload.requestResponse || "")) {
        throw new ApiError(400, "Mesaj isteği yanıtı geçersiz.");
      }
      const [messageRequest] = await db
        .select()
        .from(directMessageRequests)
        .where(
          and(
            eq(directMessageRequests.conversationId, conversationId),
            eq(directMessageRequests.recipientProfileId, profile.id),
            eq(directMessageRequests.status, "pending"),
          ),
        )
        .limit(1);
      if (!messageRequest) throw new ApiError(404, "Bekleyen mesaj isteği bulunamadı.");
      const status = payload.requestResponse === "accept" ? "accepted" : "ignored";
      await db
        .update(directMessageRequests)
        .set({ status, updatedAt: new Date().toISOString() })
        .where(eq(directMessageRequests.id, messageRequest.id));
      return apiJson({ ok: true, status });
    }

    if (payload.action === "read") {
      await enforceRateLimit(request, "dm-read", identity.email, 120, 60_000);
      const conversationId = cleanText(payload.conversationId, { max: 80 });
      await requireConversationMember(db, conversationId, profile.id);
      const lastReadAt = new Date().toISOString();
      await db
        .insert(directConversationReads)
        .values({
          id: `${conversationId}:${profile.id}`,
          conversationId,
          profileId: profile.id,
          lastReadAt,
        })
        .onConflictDoUpdate({
          target: [
            directConversationReads.conversationId,
            directConversationReads.profileId,
          ],
          set: { lastReadAt },
        });
      return apiJson({ ok: true });
    }

    if (payload.action === "settings") {
      await enforceRateLimit(request, "dm-settings", identity.email, 30, 60_000);
      const conversationId = cleanText(payload.conversationId, { max: 80 });
      await requireConversationMember(db, conversationId, profile.id);
      const mutedMinutes = Math.max(0, Math.min(43_200, Math.trunc(payload.mutedMinutes || 0)));
      const mutedUntil = mutedMinutes
        ? new Date(Date.now() + mutedMinutes * 60_000).toISOString()
        : null;
      const now = new Date().toISOString();
      await db
        .insert(directConversationSettings)
        .values({
          id: `${conversationId}:${profile.id}`,
          conversationId,
          profileId: profile.id,
          pinned: Boolean(payload.pinned),
          mutedUntil,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            directConversationSettings.conversationId,
            directConversationSettings.profileId,
          ],
          set: { pinned: Boolean(payload.pinned), mutedUntil, updatedAt: now },
        });
      return apiJson({ ok: true, pinned: Boolean(payload.pinned), mutedUntil });
    }

    if (payload.action === "privacy") {
      await enforceRateLimit(request, "dm-privacy", identity.email, 20, 60 * 60_000);
      if (!["friends", "shared_servers", "none"].includes(payload.allowFrom || "")) {
        throw new ApiError(400, "Özel mesaj gizlilik tercihi geçersiz.");
      }
      const now = new Date().toISOString();
      await db
        .insert(directMessageSettings)
        .values({ profileId: profile.id, allowFrom: payload.allowFrom!, updatedAt: now })
        .onConflictDoUpdate({
          target: directMessageSettings.profileId,
          set: { allowFrom: payload.allowFrom!, updatedAt: now },
        });
      return apiJson({ ok: true });
    }

    if (payload.action === "start") {
      await enforceRateLimit(request, "dm-start", identity.email, 20, 60 * 60_000);
      const username = cleanText(payload.username, { min: 3, max: 24 })
        .toLocaleLowerCase("en-US")
        .replace(/^@/, "");
      const [target] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.username, username))
        .limit(1);
      if (!target) throw new ApiError(404, "Kullanıcı bulunamadı.");
      if (target.id === profile.id) throw new ApiError(400, "Kendine özel mesaj gönderemezsin.");

      const relationshipFilter = or(
        and(
          eq(friendships.requesterProfileId, profile.id),
          eq(friendships.addresseeProfileId, target.id),
        ),
        and(
          eq(friendships.requesterProfileId, target.id),
          eq(friendships.addresseeProfileId, profile.id),
        ),
      );
      const relationships = await db
        .select()
        .from(friendships)
        .where(relationshipFilter);
      if (relationships.some((item) => item.status === "blocked")) {
        throw new ApiError(403, "Bu kullanıcıyla özel mesaj başlatılamıyor.");
      }
      const [targetPrivacy] = await db
        .select()
        .from(directMessageSettings)
        .where(eq(directMessageSettings.profileId, target.id))
        .limit(1);
      const allowFrom = targetPrivacy?.allowFrom || "friends";
      const friends = relationships.some((item) => item.status === "accepted");
      if (allowFrom === "none") {
        throw new ApiError(403, "Bu kullanıcı özel mesajları kapatmış.");
      }
      if (allowFrom === "friends" && !friends) {
        throw new ApiError(403, "Bu kullanıcı yalnızca arkadaşlarından özel mesaj kabul ediyor.");
      }
      if (allowFrom === "shared_servers" && !friends) {
        const sharedMemberships = await db
          .select()
          .from(serverMembers)
          .where(inArray(serverMembers.profileId, [profile.id, target.id]));
        const mine = new Set(
          sharedMemberships
            .filter((item) => item.profileId === profile.id)
            .map((item) => item.serverId),
        );
        const shared = sharedMemberships.some(
          (item) => item.profileId === target.id && mine.has(item.serverId),
        );
        if (!shared) throw new ApiError(403, "Bu kullanıcıyla ortak bir topluluğun yok.");
      }

      const conversationId = await pairConversationId(profile.id, target.id);
      const now = new Date().toISOString();
      await db
        .insert(directConversations)
        .values({ id: conversationId, createdAt: now, updatedAt: now })
        .onConflictDoNothing();
      await db
        .insert(directConversationMembers)
        .values([
          {
            id: `${conversationId}:${profile.id}`,
            conversationId,
            profileId: profile.id,
            joinedAt: now,
          },
          {
            id: `${conversationId}:${target.id}`,
            conversationId,
            profileId: target.id,
            joinedAt: now,
          },
        ])
        .onConflictDoNothing();
      let storedRequest: typeof directMessageRequests.$inferSelect | null = null;
      if (!friends) {
        await db
          .insert(directMessageRequests)
          .values({
            id: conversationId,
            conversationId,
            requesterProfileId: profile.id,
            recipientProfileId: target.id,
            status: "pending",
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing();
        [storedRequest] = await db
          .select()
          .from(directMessageRequests)
          .where(eq(directMessageRequests.conversationId, conversationId))
          .limit(1);
        if (storedRequest?.status === "ignored") {
          throw new ApiError(403, "Bu kullanıcı mesaj isteğini kabul etmedi.");
        }
      }
      return apiJson({
        conversation: {
          id: conversationId,
          profile: {
            id: target.id,
            name: target.displayName,
            username: target.username,
            bio: target.bio,
            status: target.customStatus,
            avatarUrl: avatarUrlFor(target.id, target.avatarKey),
          },
          lastMessage: "Yeni konuşma",
          updatedAt: now,
          unreadCount: 0,
          requestStatus: storedRequest?.status || null,
          requestDirection: storedRequest
            ? storedRequest.recipientProfileId === profile.id
              ? "incoming"
              : "outgoing"
            : null,
        },
      });
    }

    if (payload.action === "group") {
      await enforceRateLimit(request, "dm-group", identity.email, 10, 60 * 60_000);
      const usernames = Array.from(
        new Set(
          (payload.usernames || [])
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim().replace(/^@/, "").toLocaleLowerCase("en-US")),
        ),
      ).slice(0, 9);
      if (usernames.length < 2) {
        throw new ApiError(400, "Grup konuşması için en az iki kişi seçmelisin.");
      }
      const targets = await db.select().from(profiles).where(inArray(profiles.username, usernames));
      if (targets.length !== usernames.length || targets.some((target) => target.id === profile.id)) {
        throw new ApiError(404, "Gruba eklenecek kullanıcılardan biri bulunamadı.");
      }
      const relationships = await db
        .select()
        .from(friendships)
        .where(
          and(
            eq(friendships.status, "accepted"),
            or(
              eq(friendships.requesterProfileId, profile.id),
              eq(friendships.addresseeProfileId, profile.id),
            ),
          ),
        );
      const friendIds = new Set(
        relationships.map((relationship) =>
          relationship.requesterProfileId === profile.id
            ? relationship.addresseeProfileId
            : relationship.requesterProfileId,
        ),
      );
      if (targets.some((target) => !friendIds.has(target.id))) {
        throw new ApiError(403, "Grup konuşmasına yalnızca arkadaşlarını ekleyebilirsin.");
      }
      const now = new Date().toISOString();
      const conversationId = `group:${crypto.randomUUID()}`;
      const name = payload.name ? cleanText(payload.name, { min: 1, max: 40 }) : null;
      await db.insert(directConversations).values({
        id: conversationId,
        name,
        isGroup: true,
        ownerProfileId: profile.id,
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(directConversationMembers).values(
        [profile, ...targets].map((member) => ({
          id: `${conversationId}:${member.id}`,
          conversationId,
          profileId: member.id,
          joinedAt: now,
        })),
      );
      return apiJson(
        {
          conversation: {
            id: conversationId,
            isGroup: true,
            name: name || targets.map((target) => target.displayName).join(", "),
            members: targets.map((target) => ({
              id: target.id,
              name: target.displayName,
              username: target.username,
              avatarUrl: avatarUrlFor(target.id, target.avatarKey),
            })),
            profile: {
              id: targets[0].id,
              name: targets[0].displayName,
              username: targets[0].username,
              avatarUrl: avatarUrlFor(targets[0].id, targets[0].avatarKey),
            },
            lastMessage: "Yeni grup konuşması",
            updatedAt: now,
            unreadCount: 0,
            requestStatus: null,
            requestDirection: null,
          },
        },
        { status: 201 },
      );
    }

    if (payload.action === "rename") {
      const conversationId = cleanText(payload.conversationId, { max: 80 });
      await requireConversationMember(db, conversationId, profile.id);
      const [conversation] = await db
        .select()
        .from(directConversations)
        .where(eq(directConversations.id, conversationId))
        .limit(1);
      if (!conversation?.isGroup) {
        throw new ApiError(400, "Yalnızca grup konuşmaları adlandırılabilir.");
      }
      const name = cleanText(payload.name, { min: 1, max: 40 });
      await db
        .update(directConversations)
        .set({ name, updatedAt: new Date().toISOString() })
        .where(eq(directConversations.id, conversationId));
      return apiJson({ ok: true, name });
    }

    if (payload.action === "send") {
      await enforceRateLimit(request, "dm-send", identity.email, 40, 60_000);
      const conversationId = cleanText(payload.conversationId, { max: 80 });
      await requireConversationMember(db, conversationId, profile.id);
      await requireConversationUnblocked(db, conversationId, profile.id);
      const [messageRequest] = await db
        .select()
        .from(directMessageRequests)
        .where(eq(directMessageRequests.conversationId, conversationId))
        .limit(1);
      if (messageRequest?.status === "ignored") {
        throw new ApiError(403, "Bu mesaj isteği kabul edilmedi.");
      }
      if (
        messageRequest?.status === "pending" &&
        messageRequest.recipientProfileId === profile.id
      ) {
        throw new ApiError(403, "Yanıt vermeden önce mesaj isteğini kabul etmelisin.");
      }
      if (
        messageRequest?.status === "pending" &&
        messageRequest.requesterProfileId === profile.id
      ) {
        const sentWhilePending = await db
          .select({ id: directMessages.id })
          .from(directMessages)
          .where(
            and(
              eq(directMessages.conversationId, conversationId),
              eq(directMessages.authorProfileId, profile.id),
            ),
          )
          .limit(2);
        if (sentWhilePending.length >= 2) {
          throw new ApiError(429, "İstek kabul edilene kadar en fazla iki mesaj gönderebilirsin.");
        }
      }
      const content = cleanText(payload.content, { min: 1, max: 2_000, multiline: true });
      const now = new Date().toISOString();
      const message = {
        id: crypto.randomUUID(),
        conversationId,
        authorProfileId: profile.id,
        authorName: profile.displayName,
        authorUsername: profile.username,
        authorAvatarUrl: avatarUrlFor(profile.id, profile.avatarKey),
        content,
        editedAt: null,
        deletedAt: null,
        createdAt: now,
      };
      await db.insert(directMessages).values({
        id: message.id,
        conversationId,
        authorProfileId: profile.id,
        content,
        createdAt: now,
      });
      await db
        .update(directConversations)
        .set({ updatedAt: now })
        .where(eq(directConversations.id, conversationId));
      await db
        .insert(directConversationReads)
        .values({
          id: `${conversationId}:${profile.id}`,
          conversationId,
          profileId: profile.id,
          lastReadAt: now,
        })
        .onConflictDoUpdate({
          target: [
            directConversationReads.conversationId,
            directConversationReads.profileId,
          ],
          set: { lastReadAt: now },
        });
      return apiJson({ message }, { status: 201 });
    }

    throw new ApiError(400, "Özel mesaj işlemi geçersiz.");
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    const profile = await requireProfile(identity);
    await enforceRateLimit(request, "dm-edit", identity.email, 30, 60_000);
    const payload = await readJson<DirectPayload>(request, 8_192);
    const messageId = cleanText(payload.messageId, { max: 80 });
    const db = getDb();
    const [message] = await db
      .select()
      .from(directMessages)
      .where(eq(directMessages.id, messageId))
      .limit(1);
    if (!message || message.deletedAt) {
      throw new ApiError(404, "Mesaj bulunamadı.");
    }
    await requireConversationMember(db, message.conversationId, profile.id);
    if (payload.action === "pin") {
      const pinned = Boolean(payload.pinned);
      await db
        .update(directMessages)
        .set({ pinned })
        .where(eq(directMessages.id, messageId));
      return apiJson({ message: { ...message, pinned } });
    }
    if (message.authorProfileId !== profile.id) {
      throw new ApiError(403, "Bu özel mesajı düzenleyemezsin.");
    }
    const content = cleanText(payload.content, { min: 1, max: 2_000, multiline: true });
    const editedAt = new Date().toISOString();
    await db
      .update(directMessages)
      .set({ content, editedAt })
      .where(eq(directMessages.id, messageId));
    return apiJson({ message: { ...message, content, editedAt } });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    const profile = await requireProfile(identity);
    await enforceRateLimit(request, "dm-delete", identity.email, 30, 60_000);
    const payload = await readJson<DirectPayload>(request, 4_096);
    const messageId = cleanText(payload.messageId, { max: 80 });
    const db = getDb();
    const [message] = await db
      .select()
      .from(directMessages)
      .where(eq(directMessages.id, messageId))
      .limit(1);
    if (!message || message.authorProfileId !== profile.id) {
      throw new ApiError(403, "Bu özel mesajı silemezsin.");
    }
    await db
      .update(directMessages)
      .set({ content: "", deletedAt: new Date().toISOString() })
      .where(eq(directMessages.id, messageId));
    return apiJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
