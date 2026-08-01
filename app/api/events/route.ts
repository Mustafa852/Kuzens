import { and, asc, eq, inArray } from "drizzle-orm";
import {
  channels,
  communityEvents,
  eventRsvps,
  profiles,
} from "@/db/schema";
import {
  DEFAULT_SERVER_ID,
  PERMISSIONS,
  permissionsFor,
  requireMember,
  writeAudit,
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

type EventPayload = {
  action?: "create" | "rsvp";
  id?: string;
  serverId?: string;
  channelId?: string | null;
  title?: string;
  description?: string;
  location?: string;
  startsAt?: string;
  endsAt?: string;
  recurrence?: "none" | "weekly" | "monthly";
  response?: "going" | "interested" | "declined";
  reminderMinutes?: number;
};

function parseDate(value: unknown, label: string) {
  const date = new Date(typeof value === "string" ? value : "");
  if (Number.isNaN(date.getTime())) throw new ApiError(400, `${label} geçersiz.`);
  return date;
}

function addOccurrence(date: Date, recurrence: "weekly" | "monthly") {
  const next = new Date(date);
  if (recurrence === "weekly") next.setUTCDate(next.getUTCDate() + 7);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

function occurrencesFor(event: typeof communityEvents.$inferSelect) {
  const starts = new Date(event.startsAt);
  const ends = new Date(event.endsAt);
  const duration = Math.max(0, ends.getTime() - starts.getTime());
  const windowStart = Date.now() - 14 * 24 * 60 * 60 * 1_000;
  const windowEnd = Date.now() + 180 * 24 * 60 * 60 * 1_000;
  const occurrences: Array<{ occurrenceId: string; startsAt: string; endsAt: string }> = [];
  let cursor = starts;
  let guard = 0;
  while (cursor.getTime() <= windowEnd && guard < 64) {
    if (cursor.getTime() >= windowStart) {
      occurrences.push({
        occurrenceId: `${event.id}:${cursor.toISOString()}`,
        startsAt: cursor.toISOString(),
        endsAt: new Date(cursor.getTime() + duration).toISOString(),
      });
    }
    if (event.recurrence === "none") break;
    cursor = addOccurrence(cursor, event.recurrence);
    guard += 1;
  }
  return occurrences;
}

export async function GET(request: Request) {
  try {
    const identity = requireIdentity(request);
    const serverId = cleanText(
      new URL(request.url).searchParams.get("server") || DEFAULT_SERVER_ID,
      { max: 80 },
    );
    const { db, profile } = await requireMember(identity, serverId);
    const rows = await db
      .select()
      .from(communityEvents)
      .where(eq(communityEvents.serverId, serverId))
      .orderBy(asc(communityEvents.startsAt))
      .limit(250);
    const eventIds = rows.map((event) => event.id);
    const [rsvpRows, creatorRows] = await Promise.all([
      eventIds.length
        ? db.select().from(eventRsvps).where(inArray(eventRsvps.eventId, eventIds))
        : Promise.resolve([]),
      rows.length
        ? db
            .select({
              id: profiles.id,
              name: profiles.displayName,
              username: profiles.username,
            })
            .from(profiles)
            .where(inArray(profiles.id, rows.map((event) => event.creatorProfileId)))
        : Promise.resolve([]),
    ]);
    const creators = new Map(creatorRows.map((creator) => [creator.id, creator]));
    const events = rows.map((event) => {
      const eventResponses = rsvpRows.filter((response) => response.eventId === event.id);
      return {
        ...event,
        creator: creators.get(event.creatorProfileId) || null,
        counts: {
          going: eventResponses.filter((item) => item.response === "going").length,
          interested: eventResponses.filter((item) => item.response === "interested").length,
        },
        myRsvp: eventResponses.find((item) => item.profileId === profile.id) || null,
        occurrences: occurrencesFor(event),
      };
    });
    const permissions = await permissionsFor(profile, serverId);
    return apiJson({
      events,
      canManage:
        (permissions & (PERMISSIONS.manageServer | PERMISSIONS.manageChannels)) !== 0,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = requireIdentity(request);
    const payload = await readJson<EventPayload>(request, 12_000);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await enforceRateLimit(request, "events-write", identity.email, 20, 60_000);

    if (payload.action === "rsvp") {
      const id = cleanText(payload.id, { max: 80 });
      const [event] = await db
        .select()
        .from(communityEvents)
        .where(
          and(
            eq(communityEvents.id, id),
            eq(communityEvents.serverId, serverId),
          ),
        )
        .limit(1);
      if (!event || event.cancelledAt) {
        return apiJson({ error: "Etkinlik bulunamadı." }, { status: 404 });
      }
      const response = payload.response;
      if (!response || !["going", "interested", "declined"].includes(response)) {
        return apiJson({ error: "Geçerli bir katılım yanıtı seç." }, { status: 400 });
      }
      const reminderMinutes = Number(payload.reminderMinutes ?? 30);
      if (![0, 10, 30, 60, 1440].includes(reminderMinutes)) {
        return apiJson({ error: "Geçersiz hatırlatma süresi." }, { status: 400 });
      }
      const updatedAt = new Date().toISOString();
      await db
        .insert(eventRsvps)
        .values({
          id: `${id}:${profile.id}`,
          eventId: id,
          profileId: profile.id,
          response,
          reminderMinutes,
          updatedAt,
        })
        .onConflictDoUpdate({
          target: [eventRsvps.eventId, eventRsvps.profileId],
          set: { response, reminderMinutes, updatedAt },
        });
      return apiJson({ ok: true });
    }

    const permissions = await permissionsFor(profile, serverId);
    if ((permissions & (PERMISSIONS.manageServer | PERMISSIONS.manageChannels)) === 0) {
      throw new ApiError(403, "Etkinlik oluşturma yetkin yok.");
    }
    const title = cleanText(payload.title, { min: 2, max: 80 });
    const description = cleanText(payload.description || "", {
      min: 0,
      max: 1_000,
      multiline: true,
    });
    const location = cleanText(payload.location || "", { min: 0, max: 200 });
    const startsAt = parseDate(payload.startsAt, "Başlangıç zamanı");
    const endsAt = parseDate(payload.endsAt, "Bitiş zamanı");
    if (startsAt.getTime() < Date.now() - 5 * 60_000) {
      throw new ApiError(400, "Etkinlik başlangıcı geçmişte olamaz.");
    }
    if (endsAt <= startsAt) throw new ApiError(400, "Bitiş, başlangıçtan sonra olmalı.");
    if (endsAt.getTime() - startsAt.getTime() > 7 * 24 * 60 * 60 * 1_000) {
      throw new ApiError(400, "Bir etkinlik en fazla 7 gün sürebilir.");
    }
    if (startsAt.getTime() > Date.now() + 2 * 365 * 24 * 60 * 60 * 1_000) {
      throw new ApiError(400, "Etkinlik en fazla 2 yıl sonrasına planlanabilir.");
    }
    const recurrence =
      payload.recurrence && ["none", "weekly", "monthly"].includes(payload.recurrence)
        ? payload.recurrence
        : "none";
    let channelId: string | null = null;
    if (payload.channelId) {
      channelId = cleanText(payload.channelId, { max: 80 });
      const [channel] = await db
        .select({ id: channels.id })
        .from(channels)
        .where(and(eq(channels.id, channelId), eq(channels.serverId, serverId)))
        .limit(1);
      if (!channel) throw new ApiError(400, "Seçilen oda bu topluluğa ait değil.");
    }
    const now = new Date().toISOString();
    const event = {
      id: crypto.randomUUID(),
      serverId,
      creatorProfileId: profile.id,
      channelId,
      title,
      description,
      location,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      recurrence,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(communityEvents).values(event);
    await writeAudit(profile.id, "event.create", event.id, title, serverId);
    return apiJson({ event }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = requireIdentity(request);
    const payload = await readJson<EventPayload>(request, 4_096);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await enforceRateLimit(request, "events-delete", identity.email, 10, 60_000);
    const id = cleanText(payload.id, { max: 80 });
    const [event] = await db
      .select()
      .from(communityEvents)
      .where(and(eq(communityEvents.id, id), eq(communityEvents.serverId, serverId)))
      .limit(1);
    if (!event) return apiJson({ error: "Etkinlik bulunamadı." }, { status: 404 });
    const permissions = await permissionsFor(profile, serverId);
    if (
      event.creatorProfileId !== profile.id &&
      (permissions & (PERMISSIONS.manageServer | PERMISSIONS.manageChannels)) === 0
    ) {
      throw new ApiError(403, "Bu etkinliği iptal etme yetkin yok.");
    }
    const cancelledAt = new Date().toISOString();
    await db
      .update(communityEvents)
      .set({ cancelledAt, updatedAt: cancelledAt })
      .where(eq(communityEvents.id, id));
    await writeAudit(profile.id, "event.cancel", id, event.title, serverId);
    return apiJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
