import { eq, or } from "drizzle-orm";
import {
  authAccounts,
  authChallenges,
  authSessions,
  auraCodes,
  auraMemberships,
  auraRedemptions,
  channelNotificationSettings,
  channelMemberPermissionOverwrites,
  channelReads,
  directConversationMembers,
  directConversationReads,
  directConversationSettings,
  directConversations,
  directMessageRequests,
  directMessages,
  eventRsvps,
  friendships,
  memberRoles,
  messageBookmarks,
  messageAttachments,
  messageMentions,
  messageReactions,
  messages,
  pollVotes,
  profiles,
  serverAuraMemberships,
  serverGuideProgress,
  serverMembers,
  servers,
  threadMessages,
} from "@/db/schema";
import { requireProfile } from "@/lib/community";
import { getDb } from "@/db";
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
import { getUploads } from "@/lib/storage";

export async function DELETE(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    const profile = await requireProfile(identity);
    await enforceRateLimit(
      request,
      "account-delete",
      identity.email,
      2,
      24 * 60 * 60_000,
    );
    const payload = await readJson<{
      username?: string;
      confirmation?: string;
    }>(request, 2_048);
    const username = cleanText(payload.username, { min: 3, max: 24 })
      .toLocaleLowerCase("en-US")
      .replace(/^@/, "");
    const confirmation = cleanText(payload.confirmation, {
      min: 1,
      max: 32,
    });
    if (
      username !== profile.username ||
      confirmation !== "HESABIMI SİL"
    ) {
      throw new ApiError(
        400,
        "Hesabı silmek için kullanıcı adını ve HESABIMI SİL ifadesini doğru yaz.",
      );
    }

    const db = getDb();
    const ownedServers = await db
      .select({ id: servers.id, name: servers.name })
      .from(servers)
      .where(eq(servers.ownerProfileId, profile.id));
    if (ownedServers.length) {
      throw new ApiError(
        409,
        `Önce sahibi olduğun toplulukları silmelisin: ${ownedServers
          .slice(0, 3)
          .map((server) => server.name)
          .join(", ")}`,
      );
    }

    const conversationMemberships = await db
      .select({ conversationId: directConversationMembers.conversationId })
      .from(directConversationMembers)
      .where(eq(directConversationMembers.profileId, profile.id));
    const conversationIds = Array.from(
      new Set(conversationMemberships.map((item) => item.conversationId)),
    );
    const uploadedAttachments = await db
      .select()
      .from(messageAttachments)
      .where(eq(messageAttachments.uploaderProfileId, profile.id));

    await db
      .delete(friendships)
      .where(
        or(
          eq(friendships.requesterProfileId, profile.id),
          eq(friendships.addresseeProfileId, profile.id),
        ),
      );
    await db
      .delete(messageBookmarks)
      .where(eq(messageBookmarks.profileId, profile.id));
    await db
      .delete(messageMentions)
      .where(eq(messageMentions.profileId, profile.id));
    await db
      .delete(messageReactions)
      .where(eq(messageReactions.profileId, profile.id));
    await db.delete(pollVotes).where(eq(pollVotes.profileId, profile.id));
    await db.delete(eventRsvps).where(eq(eventRsvps.profileId, profile.id));
    await db
      .delete(serverGuideProgress)
      .where(eq(serverGuideProgress.profileId, profile.id));
    await db
      .delete(channelNotificationSettings)
      .where(eq(channelNotificationSettings.profileId, profile.id));
    await db.delete(channelReads).where(eq(channelReads.profileId, profile.id));
    await db.delete(channelMemberPermissionOverwrites).where(eq(channelMemberPermissionOverwrites.profileId, profile.id));
    await db
      .delete(auraRedemptions)
      .where(eq(auraRedemptions.profileId, profile.id));
    await db
      .delete(auraMemberships)
      .where(eq(auraMemberships.profileId, profile.id));
    await db
      .update(auraCodes)
      .set({ active: false })
      .where(eq(auraCodes.createdByProfileId, profile.id));
    await db
      .delete(serverAuraMemberships)
      .where(eq(serverAuraMemberships.grantedByProfileId, profile.id));
    await db
      .delete(threadMessages)
      .where(eq(threadMessages.authorProfileId, profile.id));
    await db
      .update(messages)
      .set({
        authorProfileId: null,
        authorName: "Silinen hesap",
        authorTag: "@silinen",
      })
      .where(eq(messages.authorProfileId, profile.id));

    if (conversationIds.length) {
      await db
        .delete(directMessages)
        .where(eq(directMessages.authorProfileId, profile.id));
      await db
        .delete(directConversationReads)
        .where(eq(directConversationReads.profileId, profile.id));
      await db
        .delete(directConversationSettings)
        .where(eq(directConversationSettings.profileId, profile.id));
      await db
        .delete(directMessageRequests)
        .where(
          or(
            eq(directMessageRequests.requesterProfileId, profile.id),
            eq(directMessageRequests.recipientProfileId, profile.id),
          ),
        );
      await db
        .delete(directConversationMembers)
        .where(eq(directConversationMembers.profileId, profile.id));
      for (const conversationId of conversationIds) {
        const remaining = await db
          .select({ id: directConversationMembers.id })
          .from(directConversationMembers)
          .where(eq(directConversationMembers.conversationId, conversationId))
          .limit(1);
        if (!remaining.length) {
          await db
            .delete(directMessages)
            .where(eq(directMessages.conversationId, conversationId));
          await db
            .delete(directConversationReads)
            .where(eq(directConversationReads.conversationId, conversationId));
          await db
            .delete(directMessageRequests)
            .where(eq(directMessageRequests.conversationId, conversationId));
          await db
            .delete(directConversations)
            .where(eq(directConversations.id, conversationId));
        }
      }
    }

    await db
      .delete(memberRoles)
      .where(eq(memberRoles.memberTag, `@${profile.username}`));
    await db
      .delete(serverMembers)
      .where(eq(serverMembers.profileId, profile.id));
    await db.delete(profiles).where(eq(profiles.id, profile.id));
    for (const attachment of uploadedAttachments) {
      await getUploads().delete(attachment.storageKey).catch(() => undefined);
    }
    await db.delete(messageAttachments).where(eq(messageAttachments.uploaderProfileId, profile.id));
    if (profile.avatarKey) {
      try {
        await getUploads().delete(profile.avatarKey);
      } catch {
        // Account deletion must complete even if a stale object is already unavailable.
      }
    }
    if (profile.bannerKey) {
      await getUploads().delete(profile.bannerKey).catch(() => undefined);
    }

    await db
      .delete(authChallenges)
      .where(eq(authChallenges.firebaseUid, identity.firebaseUid));
    await db
      .delete(authSessions)
      .where(eq(authSessions.firebaseUid, identity.firebaseUid));
    await db
      .delete(authAccounts)
      .where(eq(authAccounts.firebaseUid, identity.firebaseUid));

    return apiJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
