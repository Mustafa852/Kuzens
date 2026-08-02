import { and, desc, eq, lte, or } from "drizzle-orm";
import { getDb } from "@/db";
import {
  channelNotificationSettings,
  channels,
  friendships,
  memberRoles,
  messageMentions,
  messages,
  profiles,
  roles,
  scheduledMessages,
  serverMembers,
  servers,
} from "@/db/schema";
import { PERMISSIONS, channelPermissionsFor, permissionsFor } from "@/lib/community";
import { autoModError, checkAutoModeration } from "@/lib/automod";

type Database = ReturnType<typeof getDb>;
type ScheduledRow = typeof scheduledMessages.$inferSelect;

async function blockedProfileIdsFor(db: Database, profileId: string) {
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
    rows.flatMap((row) => {
      if (row.requesterProfileId === profileId) return [row.addresseeProfileId];
      if (row.addresseeProfileId === profileId) return [row.requesterProfileId];
      return [];
    }),
  );
}

async function failScheduledMessage(
  db: Database,
  row: ScheduledRow,
  reason: string,
) {
  await db
    .update(scheduledMessages)
    .set({
      status: "failed",
      failureReason: reason.slice(0, 240),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(scheduledMessages.id, row.id), eq(scheduledMessages.status, "pending")));
  return null;
}

export async function publishScheduledMessage(db: Database, row: ScheduledRow) {
  if (row.status !== "pending") return row.sentMessageId;
  const scheduledMessageId = `scheduled-${row.id}`;
  const [existingDelivery] = await db
    .select({ id: messages.id, createdAt: messages.createdAt })
    .from(messages)
    .where(eq(messages.id, scheduledMessageId))
    .limit(1);
  if (existingDelivery) {
    await db
      .update(scheduledMessages)
      .set({
        status: "sent",
        sentMessageId: existingDelivery.id,
        failureReason: null,
        updatedAt: existingDelivery.createdAt,
      })
      .where(eq(scheduledMessages.id, row.id));
    return existingDelivery.id;
  }
  const [profile, server, channel, membership] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.id, row.authorProfileId)).limit(1),
    db.select().from(servers).where(eq(servers.id, row.serverId)).limit(1),
    db
      .select()
      .from(channels)
      .where(and(eq(channels.id, row.channelId), eq(channels.serverId, row.serverId)))
      .limit(1),
    db
      .select()
      .from(serverMembers)
      .where(
        and(
          eq(serverMembers.serverId, row.serverId),
          eq(serverMembers.profileId, row.authorProfileId),
        ),
      )
      .limit(1),
  ]);
  const author = profile[0];
  const targetServer = server[0];
  const targetChannel = channel[0];
  const member = membership[0];
  if (!author || !targetServer || !targetChannel) {
    return failScheduledMessage(db, row, "Hesap, topluluk veya oda artık bulunamıyor.");
  }
  if (targetServer.ownerProfileId !== author.id && !member) {
    return failScheduledMessage(db, row, "Gönderen artık bu topluluğun üyesi değil.");
  }
  if (member?.timeoutUntil && member.timeoutUntil > new Date().toISOString()) {
    return failScheduledMessage(db, row, "Gönderenin zaman aşımı devam ediyor.");
  }
  const channelPermissions = await channelPermissionsFor(author, row.serverId, row.channelId);
  if ((channelPermissions & PERMISSIONS.sendMessages) === 0) {
    return failScheduledMessage(db, row, "Bu odada mesaj gönderme yetkisi kaldırılmış.");
  }
  const basePermissions = await permissionsFor(author, row.serverId);
  const massMention = row.content.includes("@everyone") || row.content.includes("@here");
  if (
    massMention &&
    (basePermissions & (PERMISSIONS.manageServer | PERMISSIONS.manageMessages)) === 0
  ) {
    return failScheduledMessage(db, row, "Toplu etiket yetkisi kaldırılmış.");
  }
  if (targetChannel.slowModeSeconds > 0 && (basePermissions & PERMISSIONS.manageMessages) === 0) {
    const [lastMessage] = await db
      .select({ id: messages.id, createdAt: messages.createdAt })
      .from(messages)
      .where(
        and(
          eq(messages.channelId, row.channelId),
          eq(messages.authorProfileId, author.id),
        ),
      )
      .orderBy(desc(messages.createdAt))
      .limit(1);
    if (lastMessage?.id === scheduledMessageId) {
      await db
        .update(scheduledMessages)
        .set({ status: "sent", sentMessageId: scheduledMessageId, updatedAt: lastMessage.createdAt })
        .where(eq(scheduledMessages.id, row.id));
      return scheduledMessageId;
    }
    if (lastMessage && Date.now() - new Date(lastMessage.createdAt).getTime() < targetChannel.slowModeSeconds * 1_000) {
      return failScheduledMessage(db, row, "Odanın yavaş modu nedeniyle gönderilemedi.");
    }
  }
  const autoModReason = await checkAutoModeration({
    db,
    profile: author,
    serverId: row.serverId,
    channelId: row.channelId,
    content: row.content,
  });
  if (autoModReason) return failScheduledMessage(db, row, autoModError(autoModReason));
  let replyToId: string | null = null;
  let replyTargetProfileId: string | null = null;
  if (row.replyToId) {
    const [reply] = await db
      .select({ id: messages.id, authorProfileId: messages.authorProfileId })
      .from(messages)
      .where(and(eq(messages.id, row.replyToId), eq(messages.channelId, row.channelId)))
      .limit(1);
    if (reply) {
      replyToId = reply.id;
      replyTargetProfileId = reply.authorProfileId;
    }
  }
  const createdAt = new Date().toISOString();
  const message = {
    // A deterministic id makes concurrent pollers idempotent: only one message can exist.
    id: scheduledMessageId,
    channelId: row.channelId,
    authorProfileId: author.id,
    authorName: author.displayName,
    authorTag: `@${author.username}`,
    content: row.content,
    replyToId,
    forwardedFromId: null,
    pinned: false,
    editedAt: null,
    deletedAt: null,
    createdAt,
  };
  await db.insert(messages).values(message).onConflictDoNothing();

  const [membershipRows, profileRows, allNotificationRows, roleRows, assignmentRows, blockedIds] =
    await Promise.all([
      db
        .select({ profileId: serverMembers.profileId })
        .from(serverMembers)
        .where(eq(serverMembers.serverId, row.serverId)),
      db.select().from(profiles),
      db
        .select({ profileId: channelNotificationSettings.profileId })
        .from(channelNotificationSettings)
        .where(
          and(
            eq(channelNotificationSettings.channelId, row.channelId),
            eq(channelNotificationSettings.level, "all"),
          ),
        ),
      db.select().from(roles).where(eq(roles.serverId, row.serverId)),
      db.select().from(memberRoles).where(eq(memberRoles.serverId, row.serverId)),
      blockedProfileIdsFor(db, author.id),
    ]);
  const memberIds = new Set(membershipRows.map((item) => item.profileId));
  memberIds.add(targetServer.ownerProfileId || "");
  const allNotificationIds = new Set(allNotificationRows.map((item) => item.profileId));
  const mentionedUsernames = new Set(
    Array.from(row.content.matchAll(/@([a-z0-9_]{3,24})\b/gi)).map((match) =>
      match[1].toLocaleLowerCase("en-US"),
    ),
  );
  const mentionedRoleIds = new Set(
    roleRows
      .filter((role) => {
        const token = role.name
          .toLocaleLowerCase("tr-TR")
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9ğüşıöç_-]/g, "");
        return token && row.content.toLocaleLowerCase("tr-TR").includes(`@${token}`);
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
      item.id !== author.id &&
      !blockedIds.has(item.id) &&
      memberIds.has(item.id) &&
      (massMention ||
        mentionedUsernames.has(item.username) ||
        roleMentionedTags.has(`@${item.username}`.toLocaleLowerCase("en-US")) ||
        item.id === replyTargetProfileId ||
        allNotificationIds.has(item.id)),
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
            ? ("everyone" as const)
            : target.id === replyTargetProfileId
              ? ("reply" as const)
              : roleMentionedTags.has(`@${target.username}`.toLocaleLowerCase("en-US"))
                ? ("role" as const)
                : ("mention" as const),
          readAt: null,
          createdAt,
        })),
      )
      .onConflictDoNothing();
  }
  await db
    .update(scheduledMessages)
    .set({
      status: "sent",
      sentMessageId: message.id,
      failureReason: null,
      updatedAt: createdAt,
    })
    .where(and(eq(scheduledMessages.id, row.id), eq(scheduledMessages.status, "pending")));
  return message.id;
}

export async function publishDueScheduledMessages(
  db: Database,
  options: { channelId?: string; authorProfileId?: string; limit?: number } = {},
) {
  const filters = [
    eq(scheduledMessages.status, "pending"),
    lte(scheduledMessages.sendAt, new Date().toISOString()),
  ];
  if (options.channelId) filters.push(eq(scheduledMessages.channelId, options.channelId));
  if (options.authorProfileId) {
    filters.push(eq(scheduledMessages.authorProfileId, options.authorProfileId));
  }
  const rows = await db
    .select()
    .from(scheduledMessages)
    .where(and(...filters))
    .orderBy(scheduledMessages.sendAt)
    .limit(Math.min(50, Math.max(1, options.limit || 20)));
  for (const row of rows) await publishScheduledMessage(db, row);
  return rows.length;
}
