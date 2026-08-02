import { and, asc, desc, eq, gt, inArray, lte, or } from "drizzle-orm";
import {
  channelNotificationSettings,
  channels,
  friendships,
  memberRoles,
  messageAttachments,
  messageMentions,
  messageReactions,
  messages,
  messageThreads,
  pollOptions,
  polls,
  pollVotes,
  threadMessages,
  profiles,
  roles,
  serverMembers,
} from "@/db/schema";
import {
  DEFAULT_SERVER_ID,
  PERMISSIONS,
  permissionsFor,
  requireChannelPermission,
  requireMember,
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
import { autoModError, checkAutoModeration } from "@/lib/automod";
import { avatarUrlFor } from "@/lib/profile-view";
import { getUploads } from "@/lib/storage";
import { publishDueScheduledMessages } from "@/lib/scheduled-messages";

type MessagePayload = {
  id?: string;
  serverId?: string;
  channelId?: string;
  content?: string;
  replyToId?: string | null;
  action?: "pin";
  pinned?: boolean;
};

async function decorateMessages(
  db: Awaited<ReturnType<typeof requireMember>>["db"],
  rows: Array<typeof messages.$inferSelect>,
  profileId: string,
) {
  if (!rows.length) return [];
  const ids = rows.map((message) => message.id);
  const [reactionRows, mentionRows, attachmentRows, blockedRows] = await Promise.all([
    db.select().from(messageReactions).where(inArray(messageReactions.messageId, ids)),
    db
      .select({ messageId: messageMentions.messageId })
      .from(messageMentions)
      .where(
        and(
          inArray(messageMentions.messageId, ids),
          eq(messageMentions.profileId, profileId),
        ),
      ),
    db
      .select()
      .from(messageAttachments)
      .where(inArray(messageAttachments.messageId, ids)),
    db
      .select({
        requesterProfileId: friendships.requesterProfileId,
        addresseeProfileId: friendships.addresseeProfileId,
      })
      .from(friendships)
      .where(
        and(
          eq(friendships.status, "blocked"),
          or(
            eq(friendships.requesterProfileId, profileId),
            eq(friendships.addresseeProfileId, profileId),
          ),
        ),
      ),
  ]);
  const mentioned = new Set(mentionRows.map((item) => item.messageId));
  const authorIds = Array.from(
    new Set(rows.flatMap((message) => message.authorProfileId ? [message.authorProfileId] : [])),
  );
  const authorRows = authorIds.length
    ? await db
        .select({ id: profiles.id, avatarKey: profiles.avatarKey })
        .from(profiles)
        .where(inArray(profiles.id, authorIds))
    : [];
  const authorAvatarById = new Map(
    authorRows.map((author) => [author.id, avatarUrlFor(author.id, author.avatarKey)]),
  );
  const blockedProfileIds = new Set(
    blockedRows.map((item) =>
      item.requesterProfileId === profileId
        ? item.addresseeProfileId
        : item.requesterProfileId,
    ),
  );
  const pollRows = await db
    .select()
    .from(polls)
    .where(inArray(polls.messageId, ids));
  const pollIds = pollRows.map((poll) => poll.id);
  const [optionRows, voteRows] = pollIds.length
    ? await Promise.all([
        db.select().from(pollOptions).where(inArray(pollOptions.pollId, pollIds)),
        db.select().from(pollVotes).where(inArray(pollVotes.pollId, pollIds)),
      ])
    : [[], []];
  const threadRows = await db
    .select()
    .from(messageThreads)
    .where(inArray(messageThreads.parentMessageId, ids));
  const threadIds = threadRows.map((thread) => thread.id);
  const threadReplyRows = threadIds.length
    ? await db
        .select({
          threadId: threadMessages.threadId,
          createdAt: threadMessages.createdAt,
          deletedAt: threadMessages.deletedAt,
        })
        .from(threadMessages)
        .where(inArray(threadMessages.threadId, threadIds))
    : [];
  return rows.map((message) => {
    const grouped = new Map<string, { emoji: string; count: number; reactedByMe: boolean }>();
    for (const reaction of reactionRows) {
      if (reaction.messageId !== message.id) continue;
      const current = grouped.get(reaction.emoji) || {
        emoji: reaction.emoji,
        count: 0,
        reactedByMe: false,
      };
      current.count += 1;
      if (reaction.profileId === profileId) current.reactedByMe = true;
      grouped.set(reaction.emoji, current);
    }
    const poll = pollRows.find((item) => item.messageId === message.id);
    const pollOptionRows = poll
      ? optionRows
          .filter((option) => option.pollId === poll.id)
          .sort((a, b) => a.position - b.position)
      : [];
    const pollVoteRows = poll
      ? voteRows.filter((vote) => vote.pollId === poll.id)
      : [];
    const thread = threadRows.find((item) => item.parentMessageId === message.id);
    const replies = thread
      ? threadReplyRows.filter(
          (reply) => reply.threadId === thread.id && !reply.deletedAt,
        )
      : [];
    return {
      ...message,
      authorAvatarUrl: message.authorProfileId
        ? authorAvatarById.get(message.authorProfileId) || null
        : null,
      reactions: Array.from(grouped.values()),
      mentionedMe: mentioned.has(message.id),
      blockedAuthor: Boolean(
        message.authorProfileId && blockedProfileIds.has(message.authorProfileId),
      ),
      attachments: attachmentRows
        .filter((attachment) => attachment.messageId === message.id)
        .map((attachment) => ({
          id: attachment.id,
          messageId: attachment.messageId,
          fileName: attachment.fileName,
          contentType: attachment.contentType,
          size: attachment.size,
          width: attachment.width,
          height: attachment.height,
          createdAt: attachment.createdAt,
          url: `/api/media?attachment=${encodeURIComponent(attachment.id)}`,
        })),
      poll: poll
        ? {
            id: poll.id,
            question: poll.question,
            allowMultiple: poll.allowMultiple,
            closesAt: poll.closesAt,
            closedAt:
              poll.closedAt ||
              (poll.closesAt <= new Date().toISOString() ? poll.closesAt : null),
            totalVotes: new Set(pollVoteRows.map((vote) => vote.profileId)).size,
            options: pollOptionRows.map((option) => ({
              id: option.id,
              label: option.label,
              count: pollVoteRows.filter((vote) => vote.optionId === option.id).length,
              votedByMe: pollVoteRows.some(
                (vote) =>
                  vote.optionId === option.id && vote.profileId === profileId,
              ),
            })),
          }
        : null,
      thread: thread
        ? {
            id: thread.id,
            title: thread.title,
            replyCount: replies.length,
            locked: thread.locked,
            archived: thread.archived,
            updatedAt:
              replies.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
                ?.createdAt || thread.updatedAt,
          }
        : null,
    };
  });
}

async function requireTextChannel(
  db: Awaited<ReturnType<typeof requireMember>>["db"],
  channelId: string,
  serverId: string,
) {
  const [channel] = await db
    .select()
    .from(channels)
    .where(
      and(
        eq(channels.id, channelId),
        eq(channels.serverId, serverId),
        inArray(channels.kind, ["text", "voice", "forum", "announcement"]),
      ),
    )
    .limit(1);
  if (!channel) return null;
  return channel;
}

async function blockedProfileIdsFor(
  db: Awaited<ReturnType<typeof requireMember>>["db"],
  profileId: string,
) {
  const rows = await db
    .select({
      requesterProfileId: friendships.requesterProfileId,
      addresseeProfileId: friendships.addresseeProfileId,
    })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "blocked"),
        or(
          eq(friendships.requesterProfileId, profileId),
          eq(friendships.addresseeProfileId, profileId),
        ),
      ),
    );
  return new Set(
    rows.map((item) =>
      item.requesterProfileId === profileId
        ? item.addresseeProfileId
        : item.requesterProfileId,
    ),
  );
}

export async function GET(request: Request) {
  try {
    const identity = await requireIdentity(request);
    await enforceRateLimit(request, "message-sync", identity.email, 180, 60_000);
    const url = new URL(request.url);
    const serverId = cleanText(url.searchParams.get("server") || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    const channelId = cleanText(url.searchParams.get("channel") || "genel", { max: 80 });
    const channel = await requireTextChannel(db, channelId, serverId);
    if (!channel) {
      return apiJson({ error: "Metin odası bulunamadı." }, { status: 404 });
    }
    await requireChannelPermission(
      profile,
      PERMISSIONS.viewChannels,
      serverId,
      channelId,
    );
    await publishDueScheduledMessages(db, { channelId, limit: 20 });
    const syncBoundary = new Date().toISOString();
    const [membership] = await db
      .select({ joinedAt: serverMembers.joinedAt })
      .from(serverMembers)
      .where(and(eq(serverMembers.serverId, serverId), eq(serverMembers.profileId, profile.id)))
      .limit(1);
    const historyBoundary = channel.historyMode === "since_join"
      ? membership?.joinedAt || new Date().toISOString()
      : null;

    const after = url.searchParams.get("after");
    if (after) {
      const afterDate = new Date(after);
      if (Number.isNaN(afterDate.getTime())) {
        return apiJson({ error: "Geçersiz eşitleme zamanı." }, { status: 400 });
      }
      const requestedWait = Number(url.searchParams.get("wait") || 0);
      const waitMs = Number.isFinite(requestedWait)
        ? Math.min(15_000, Math.max(0, Math.trunc(requestedWait)))
        : 0;
      const waitUntil = Date.now() + waitMs;
      const afterBoundary =
        historyBoundary && historyBoundary > afterDate.toISOString()
          ? historyBoundary
          : afterDate.toISOString();
      let boundary = syncBoundary;
      let rows: Array<typeof messages.$inferSelect> = [];
      do {
        boundary = new Date().toISOString();
        rows = await db
          .select()
          .from(messages)
          .where(
            and(
              eq(messages.channelId, channelId),
              gt(messages.createdAt, afterBoundary),
              lte(messages.createdAt, boundary),
            ),
          )
          .orderBy(asc(messages.createdAt))
          .limit(100);
        if (rows.length || Date.now() >= waitUntil || request.signal.aborted) break;
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(450, Math.max(25, waitUntil - Date.now()))),
        );
      } while (Date.now() < waitUntil);
      return apiJson({
        messages: await decorateMessages(db, rows, profile.id),
        syncedAt: boundary,
      });
    }

    const latest = await db
      .select()
      .from(messages)
      .where(historyBoundary ? and(eq(messages.channelId, channelId), gt(messages.createdAt, historyBoundary)) : eq(messages.channelId, channelId))
      .orderBy(desc(messages.createdAt))
      .limit(100);
    return apiJson({
      messages: await decorateMessages(db, latest.reverse(), profile.id),
      syncedAt: syncBoundary,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    const payload = await readJson<MessagePayload>(request, 8_192);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await enforceRateLimit(request, "message-send", identity.email, 15, 10_000);
    const channelId = cleanText(payload.channelId, { max: 80 });
    const [membership] = await db
      .select({ timeoutUntil: serverMembers.timeoutUntil })
      .from(serverMembers)
      .where(and(eq(serverMembers.serverId, serverId), eq(serverMembers.profileId, profile.id)))
      .limit(1);
    if (membership?.timeoutUntil && membership.timeoutUntil > new Date().toISOString()) {
      return apiJson({ error: "Timeout süren bitene kadar mesaj gönderemezsin." }, { status: 403 });
    }
    const content = cleanText(payload.content, { max: 2_000, multiline: true });
    const channel = await requireTextChannel(db, channelId, serverId);
    if (!channel) {
      return apiJson({ error: "Metin odası bulunamadı." }, { status: 404 });
    }
    await requireChannelPermission(
      profile,
      PERMISSIONS.sendMessages,
      serverId,
      channelId,
    );
    const permissions = await permissionsFor(profile, serverId);
    if (
      (content.includes("@everyone") || content.includes("@here")) &&
      (permissions & (PERMISSIONS.manageServer | PERMISSIONS.manageMessages)) === 0
    ) {
      return apiJson({ error: "@everyone ve @here yalnızca yetkili roller tarafından kullanılabilir." }, { status: 403 });
    }
    const autoModReason = await checkAutoModeration({
      db,
      profile,
      serverId,
      channelId,
      content,
    });
    if (autoModReason) {
      return apiJson({ error: autoModError(autoModReason) }, { status: 422 });
    }
    if (channel.slowModeSeconds > 0 && (permissions & PERMISSIONS.manageMessages) === 0) {
      const [lastMessage] = await db
        .select({ createdAt: messages.createdAt })
        .from(messages)
        .where(
          and(
            eq(messages.channelId, channelId),
            eq(messages.authorProfileId, profile.id),
          ),
        )
        .orderBy(desc(messages.createdAt))
        .limit(1);
      const waitMs = lastMessage
        ? channel.slowModeSeconds * 1_000 -
          (Date.now() - new Date(lastMessage.createdAt).getTime())
        : 0;
      if (waitMs > 0) {
        return apiJson(
          { error: `Yavaş mod açık. ${Math.ceil(waitMs / 1_000)} saniye beklemelisin.` },
          { status: 429 },
        );
      }
    }

    let replyToId: string | null = null;
    let replyTargetProfileId: string | null = null;
    if (payload.replyToId) {
      replyToId = cleanText(payload.replyToId, { max: 80 });
      const [reply] = await db
        .select({ id: messages.id, authorProfileId: messages.authorProfileId })
        .from(messages)
        .where(and(eq(messages.id, replyToId), eq(messages.channelId, channelId)))
        .limit(1);
      if (!reply) return apiJson({ error: "Yanıtlanan mesaj bulunamadı." }, { status: 400 });
      replyTargetProfileId = reply.authorProfileId || null;
    }

    const message = {
      id: crypto.randomUUID(),
      channelId,
      authorProfileId: profile.id,
      authorName: profile.displayName,
      authorTag: `@${profile.username}`,
      content,
      replyToId,
      pinned: false,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
    };
    await db.insert(messages).values(message);
    const membershipRows = await db
      .select({ profileId: serverMembers.profileId })
      .from(serverMembers)
      .where(eq(serverMembers.serverId, serverId));
    const allNotificationRows = await db
      .select({ profileId: channelNotificationSettings.profileId })
      .from(channelNotificationSettings)
      .where(
        and(
          eq(channelNotificationSettings.channelId, channelId),
          eq(channelNotificationSettings.level, "all"),
        ),
      );
    const allNotificationIds = new Set(
      allNotificationRows.map((item) => item.profileId),
    );
    const memberIds = new Set(membershipRows.map((item) => item.profileId));
    const profileRows = await db.select().from(profiles);
    const [roleRows, assignmentRows] = await Promise.all([
      db.select().from(roles).where(eq(roles.serverId, serverId)),
      db.select().from(memberRoles).where(eq(memberRoles.serverId, serverId)),
    ]);
    const blockedProfileIds = await blockedProfileIdsFor(db, profile.id);
    const mentionedUsernames = new Set(
      Array.from(content.matchAll(/@([a-z0-9_]{3,24})\b/gi)).map((match) =>
        match[1].toLocaleLowerCase("en-US"),
      ),
    );
    const massMention = content.includes("@everyone") || content.includes("@here");
    const mentionedRoleIds = new Set(
      roleRows
        .filter((role) => {
          const token = role.name
            .toLocaleLowerCase("tr-TR")
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9ğüşöçı_-]/g, "");
          return token && content.toLocaleLowerCase("tr-TR").includes(`@${token}`);
        })
        .map((role) => role.id),
    );
    const roleMentionedTags = new Set(
      assignmentRows
        .filter((assignment) => mentionedRoleIds.has(assignment.roleId))
        .map((assignment) => assignment.memberTag.toLocaleLowerCase("en-US")),
    );
    const targets = profileRows.filter(
      (item) =>
        item.id !== profile.id &&
        !blockedProfileIds.has(item.id) &&
        memberIds.has(item.id) &&
        (
          massMention ||
          mentionedUsernames.has(item.username) ||
          roleMentionedTags.has(`@${item.username}`.toLocaleLowerCase("en-US")) ||
          item.id === replyTargetProfileId ||
          allNotificationIds.has(item.id)
        ),
    );
    if (targets.length) {
      await db
        .insert(messageMentions)
        .values(
          targets.slice(0, 100).map((target) => ({
            id: `${message.id}:${target.id}`,
            messageId: message.id,
            profileId: target.id,
            kind: massMention
              ? "everyone" as const
              : target.id === replyTargetProfileId
                ? "reply" as const
                : roleMentionedTags.has(`@${target.username}`.toLocaleLowerCase("en-US"))
                  ? "role" as const
                  : "mention" as const,
            readAt: null,
            createdAt: message.createdAt,
          })),
        )
        .onConflictDoNothing();
    }
    return apiJson(
      {
        message: {
          ...message,
          authorAvatarUrl: avatarUrlFor(profile.id, profile.avatarKey),
          reactions: [],
          mentionedMe: false,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    const payload = await readJson<MessagePayload>(request, 8_192);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await enforceRateLimit(request, "message-edit", identity.email, 20, 60_000);
    const id = cleanText(payload.id, { max: 80 });
    const [message] = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
    if (!message || message.deletedAt) {
      return apiJson({ error: "Mesaj bulunamadı." }, { status: 404 });
    }
    const [messageChannel] = await db
      .select({ serverId: channels.serverId })
      .from(channels)
      .where(eq(channels.id, message.channelId))
      .limit(1);
    if (messageChannel?.serverId !== serverId) {
      return apiJson({ error: "Mesaj bu topluluğa ait değil." }, { status: 403 });
    }
    const permissions = await permissionsFor(profile, serverId);
    if (payload.action === "pin") {
      if ((permissions & PERMISSIONS.manageMessages) === 0) {
        return apiJson({ error: "Mesaj sabitleme yetkin yok." }, { status: 403 });
      }
      const pinned = payload.pinned !== false;
      await db.update(messages).set({ pinned }).where(eq(messages.id, id));
      await writeAudit(
        profile.id,
        pinned ? "message.pin" : "message.unpin",
        id,
        undefined,
        serverId,
      );
      return apiJson({ message: { ...message, pinned } });
    }
    const content = cleanText(payload.content, { max: 2_000, multiline: true });
    if (
      (content.includes("@everyone") || content.includes("@here")) &&
      (permissions & (PERMISSIONS.manageServer | PERMISSIONS.manageMessages)) === 0
    ) {
      return apiJson({ error: "@everyone ve @here yalnızca yetkili roller tarafından kullanılabilir." }, { status: 403 });
    }
    const ownsMessage =
      message.authorProfileId === profile.id || message.authorTag === `@${profile.username}`;
    if (!ownsMessage && (permissions & PERMISSIONS.manageMessages) === 0) {
      return apiJson({ error: "Bu mesajı düzenleyemezsin." }, { status: 403 });
    }
    const autoModReason = await checkAutoModeration({
      db,
      profile,
      serverId,
      channelId: message.channelId,
      content,
      editing: true,
    });
    if (autoModReason) {
      return apiJson({ error: autoModError(autoModReason) }, { status: 422 });
    }
    const editedAt = new Date().toISOString();
    await db.update(messages).set({ content, editedAt }).where(eq(messages.id, id));
    await db.delete(messageMentions).where(eq(messageMentions.messageId, id));
    const [membershipRows, profileRows, replyRows, blockedProfileIds] = await Promise.all([
      db
        .select({ profileId: serverMembers.profileId })
        .from(serverMembers)
        .where(eq(serverMembers.serverId, serverId)),
      db.select().from(profiles),
      message.replyToId
        ? db
            .select({ authorProfileId: messages.authorProfileId })
            .from(messages)
            .where(eq(messages.id, message.replyToId))
            .limit(1)
        : Promise.resolve([]),
      blockedProfileIdsFor(db, profile.id),
    ]);
    const memberIds = new Set(membershipRows.map((item) => item.profileId));
    const usernames = new Set(
      Array.from(content.matchAll(/@([a-z0-9_]{3,24})\b/gi)).map((match) =>
        match[1].toLocaleLowerCase("en-US"),
      ),
    );
    const massMention = content.includes("@everyone") || content.includes("@here");
    const replyProfileId = replyRows[0]?.authorProfileId || null;
    const targets = profileRows.filter(
      (item) =>
        item.id !== profile.id &&
        !blockedProfileIds.has(item.id) &&
        memberIds.has(item.id) &&
        (massMention || usernames.has(item.username) || item.id === replyProfileId),
    );
    if (targets.length) {
      await db
        .insert(messageMentions)
        .values(
          targets.slice(0, 100).map((target) => ({
            id: `${id}:${target.id}`,
            messageId: id,
            profileId: target.id,
            readAt: null,
            createdAt: editedAt,
          })),
        )
        .onConflictDoNothing();
    }
    await writeAudit(profile.id, "message.edit", id, undefined, serverId);
    const [decorated] = await decorateMessages(
      db,
      [{ ...message, content, editedAt }],
      profile.id,
    );
    return apiJson({ message: decorated });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    const payload = await readJson<MessagePayload>(request, 2_048);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await enforceRateLimit(request, "message-delete", identity.email, 20, 60_000);
    const id = cleanText(payload.id, { max: 80 });
    const [message] = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
    if (!message || message.deletedAt) {
      return apiJson({ error: "Mesaj bulunamadı." }, { status: 404 });
    }
    const [messageChannel] = await db
      .select({ serverId: channels.serverId })
      .from(channels)
      .where(eq(channels.id, message.channelId))
      .limit(1);
    if (messageChannel?.serverId !== serverId) {
      return apiJson({ error: "Mesaj bu topluluğa ait değil." }, { status: 403 });
    }
    const permissions = await permissionsFor(profile, serverId);
    const ownsMessage =
      message.authorProfileId === profile.id || message.authorTag === `@${profile.username}`;
    if (!ownsMessage && (permissions & PERMISSIONS.manageMessages) === 0) {
      return apiJson({ error: "Bu mesajı silemezsin." }, { status: 403 });
    }
    const deletedAt = new Date().toISOString();
    const attachmentRows = await db
      .select()
      .from(messageAttachments)
      .where(eq(messageAttachments.messageId, id));
    await db
      .update(messages)
      .set({ content: "Mesaj silindi.", deletedAt, editedAt: null })
      .where(eq(messages.id, id));
    await Promise.all([
      db.delete(messageMentions).where(eq(messageMentions.messageId, id)),
      db.delete(messageReactions).where(eq(messageReactions.messageId, id)),
      db.delete(messageAttachments).where(eq(messageAttachments.messageId, id)),
    ]);
    await Promise.all(attachmentRows.map((attachment) => getUploads().delete(attachment.storageKey).catch(() => undefined)));
    await writeAudit(profile.id, "message.delete", id, undefined, serverId);
    return apiJson({ ok: true, deletedAt });
  } catch (error) {
    return apiError(error);
  }
}
