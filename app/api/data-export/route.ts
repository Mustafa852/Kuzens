import { eq, or } from "drizzle-orm";
import {
  directConversationMembers,
  directMessages,
  friendships,
  memberRoles,
  messageBookmarks,
  messages,
  serverMembers,
} from "@/db/schema";
import { requireProfile } from "@/lib/community";
import { apiError, requireIdentity } from "@/lib/security";

export async function GET(request: Request) {
  try {
    const identity = requireIdentity(request);
    const profile = await requireProfile(identity);
    const { getDb } = await import("@/db");
    const db = getDb();
    const memberships = await db.select().from(serverMembers).where(eq(serverMembers.profileId, profile.id));
    const conversationMemberships = await db.select().from(directConversationMembers).where(eq(directConversationMembers.profileId, profile.id));
    const conversationIds = new Set(conversationMemberships.map((item) => item.conversationId));
    const [ownMessages, dmRows, roles, friends, bookmarks] = await Promise.all([
      db.select().from(messages).where(eq(messages.authorProfileId, profile.id)),
      db.select().from(directMessages).where(eq(directMessages.authorProfileId, profile.id)),
      db.select().from(memberRoles).where(eq(memberRoles.memberTag, `@${profile.username}`)),
      db.select().from(friendships).where(or(eq(friendships.requesterProfileId, profile.id), eq(friendships.addresseeProfileId, profile.id))),
      db.select().from(messageBookmarks).where(eq(messageBookmarks.profileId, profile.id)),
    ]);
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: {
        id: profile.id,
        email: profile.email,
        displayName: profile.displayName,
        username: profile.username,
        bio: profile.bio,
        customStatus: profile.customStatus,
        presenceStatus: profile.presenceStatus,
        createdAt: profile.createdAt,
        acceptedAt: profile.acceptedAt,
        legalVersions: {
          terms: profile.termsVersion,
          privacyNotice: profile.noticeVersion,
          community: profile.communityVersion,
        },
      },
      memberships,
      roles,
      friendships: friends,
      messages: ownMessages,
      directMessages: dmRows.filter((item) => conversationIds.has(item.conversationId)),
      bookmarks,
    };
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="kuzens-verilerim-${new Date().toISOString().slice(0, 10)}.json"`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
