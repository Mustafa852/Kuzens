import { and, eq } from "drizzle-orm";
import {
  channels,
  messages,
  pollOptions,
  polls,
  pollVotes,
} from "@/db/schema";
import {
  PERMISSIONS,
  permissionsFor,
  requireMember,
} from "@/lib/community";
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
import { autoModError, checkAutoModeration } from "@/lib/automod";
import { getDb } from "@/db";

type PollPayload = {
  action?: "create" | "vote";
  serverId?: string;
  channelId?: string;
  pollId?: string;
  optionId?: string;
  question?: string;
  options?: string[];
  allowMultiple?: boolean;
  durationHours?: number;
};

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = requireIdentity(request);
    const payload = await readJson<PollPayload>(request, 12_000);

    if (payload.action === "vote") {
      await enforceRateLimit(request, "poll-vote", identity.email, 80, 60_000);
      const pollId = cleanText(payload.pollId, { max: 80 });
      const optionId = cleanText(payload.optionId, { max: 80 });
      const [pollWithServer] = await getDb()
        .select({
          poll: polls,
          serverId: channels.serverId,
        })
        .from(polls)
        .innerJoin(channels, eq(polls.channelId, channels.id))
        .where(eq(polls.id, pollId))
        .limit(1);
      if (!pollWithServer) throw new ApiError(404, "Anket bulunamadı.");
      const { db, profile } = await requireMember(identity, pollWithServer.serverId);
      if (
        pollWithServer.poll.closedAt ||
        new Date(pollWithServer.poll.closesAt).getTime() <= Date.now()
      ) {
        throw new ApiError(409, "Bu anket sona erdi.");
      }
      const [option] = await db
        .select()
        .from(pollOptions)
        .where(and(eq(pollOptions.id, optionId), eq(pollOptions.pollId, pollId)))
        .limit(1);
      if (!option) throw new ApiError(400, "Anket seçeneği geçersiz.");
      const [existing] = await db
        .select()
        .from(pollVotes)
        .where(
          and(
            eq(pollVotes.pollId, pollId),
            eq(pollVotes.optionId, optionId),
            eq(pollVotes.profileId, profile.id),
          ),
        )
        .limit(1);
      if (existing) {
        await db.delete(pollVotes).where(eq(pollVotes.id, existing.id));
        return apiJson({ voted: false });
      }
      if (!pollWithServer.poll.allowMultiple) {
        await db
          .delete(pollVotes)
          .where(
            and(
              eq(pollVotes.pollId, pollId),
              eq(pollVotes.profileId, profile.id),
            ),
          );
      }
      await db.insert(pollVotes).values({
        id: `${pollId}:${optionId}:${profile.id}`,
        pollId,
        optionId,
        profileId: profile.id,
        createdAt: new Date().toISOString(),
      });
      return apiJson({ voted: true });
    }

    const serverId = cleanText(payload.serverId, { max: 80 });
    const channelId = cleanText(payload.channelId, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await enforceRateLimit(request, "poll-create", identity.email, 8, 60 * 60_000);
    const [channel] = await db
      .select()
      .from(channels)
      .where(
        and(
          eq(channels.id, channelId),
          eq(channels.serverId, serverId),
          eq(channels.kind, "text"),
        ),
      )
      .limit(1);
    if (!channel) throw new ApiError(404, "Metin odası bulunamadı.");
    const question = cleanText(payload.question, { min: 2, max: 200 });
    if (!Array.isArray(payload.options) || payload.options.length < 2 || payload.options.length > 10) {
      throw new ApiError(400, "Ankette 2 ile 10 arasında seçenek olmalı.");
    }
    const optionLabels = payload.options.map((option) =>
      cleanText(option, { min: 1, max: 80 }),
    );
    if (new Set(optionLabels.map((label) => label.toLocaleLowerCase("tr-TR"))).size !== optionLabels.length) {
      throw new ApiError(400, "Anket seçenekleri birbirinden farklı olmalı.");
    }
    const durationHours = Number(payload.durationHours || 24);
    if (![1, 6, 24, 72, 168].includes(durationHours)) {
      throw new ApiError(400, "Anket süresi geçersiz.");
    }
    const autoModReason = await checkAutoModeration({
      db,
      profile,
      serverId,
      channelId,
      content: `${question}\n${optionLabels.join("\n")}`,
    });
    if (autoModReason) throw new ApiError(422, autoModError(autoModReason));
    const permissions = await permissionsFor(profile, serverId);
    if (
      /@(everyone|here)\b/i.test(question) &&
      (permissions & (PERMISSIONS.manageServer | PERMISSIONS.manageMessages)) === 0
    ) {
      throw new ApiError(403, "Toplu etiketli anket oluşturma yetkin yok.");
    }
    const now = new Date();
    const pollId = crypto.randomUUID();
    const messageId = crypto.randomUUID();
    const message = {
      id: messageId,
      channelId,
      authorProfileId: profile.id,
      authorName: profile.displayName,
      authorTag: `@${profile.username}`,
      content: `📊 ${question}`,
      replyToId: null,
      pinned: false,
      editedAt: null,
      deletedAt: null,
      createdAt: now.toISOString(),
    };
    await db.insert(messages).values(message);
    await db.insert(polls).values({
      id: pollId,
      messageId,
      channelId,
      creatorProfileId: profile.id,
      question,
      allowMultiple: Boolean(payload.allowMultiple),
      closesAt: new Date(now.getTime() + durationHours * 60 * 60_000).toISOString(),
      closedAt: null,
      createdAt: now.toISOString(),
    });
    await db.insert(pollOptions).values(
      optionLabels.map((label, position) => ({
        id: crypto.randomUUID(),
        pollId,
        label,
        position,
      })),
    );
    return apiJson({ message }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = requireIdentity(request);
    const payload = await readJson<PollPayload>(request, 2_048);
    const pollId = cleanText(payload.pollId, { max: 80 });
    const db = getDb();
    const [pollWithServer] = await db
      .select({ poll: polls, serverId: channels.serverId })
      .from(polls)
      .innerJoin(channels, eq(polls.channelId, channels.id))
      .where(eq(polls.id, pollId))
      .limit(1);
    if (!pollWithServer) throw new ApiError(404, "Anket bulunamadı.");
    const { profile } = await requireMember(identity, pollWithServer.serverId);
    await enforceRateLimit(request, "poll-close", identity.email, 20, 60_000);
    const permissions = await permissionsFor(profile, pollWithServer.serverId);
    if (
      pollWithServer.poll.creatorProfileId !== profile.id &&
      (permissions & PERMISSIONS.manageMessages) === 0
    ) {
      throw new ApiError(403, "Bu anketi sonlandırma yetkin yok.");
    }
    await db
      .update(polls)
      .set({ closedAt: new Date().toISOString() })
      .where(eq(polls.id, pollId));
    return apiJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
