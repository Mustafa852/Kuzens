import { and, asc, eq } from "drizzle-orm";
import {
  channels,
  serverGuideProgress,
  serverGuides,
} from "@/db/schema";
import {
  DEFAULT_SERVER_ID,
  PERMISSIONS,
  permissionsFor,
  requireMember,
  requirePermission,
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

const GUIDE_STEPS = ["rules", "favorite", "hello"] as const;
type GuideStep = (typeof GUIDE_STEPS)[number];

type GuidePayload = {
  serverId?: string;
  action?: "progress";
  step?: GuideStep;
  welcomeMessage?: string;
  rulesChannelId?: string | null;
};

function parseSteps(value?: string) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is GuideStep =>
          GUIDE_STEPS.includes(item as GuideStep),
        )
      : [];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const identity = await requireIdentity(request);
    const serverId = cleanText(
      new URL(request.url).searchParams.get("server") || DEFAULT_SERVER_ID,
      { max: 80 },
    );
    const { db, profile } = await requireMember(identity, serverId);
    const [guide, progress, channelRows] = await Promise.all([
      db.select().from(serverGuides).where(eq(serverGuides.serverId, serverId)).limit(1),
      db
        .select()
        .from(serverGuideProgress)
        .where(
          and(
            eq(serverGuideProgress.serverId, serverId),
            eq(serverGuideProgress.profileId, profile.id),
          ),
        )
        .limit(1),
      db
        .select({
          id: channels.id,
          name: channels.name,
          kind: channels.kind,
          position: channels.position,
        })
        .from(channels)
        .where(eq(channels.serverId, serverId))
        .orderBy(asc(channels.position)),
    ]);
    const permissions = await permissionsFor(profile, serverId);
    return apiJson({
      guide: {
        welcomeMessage:
          guide[0]?.welcomeMessage ||
          "Aramıza hoş geldin! Önce kuralları incele, sevdiğin odaları seç ve kendini tanıt.",
        rulesChannelId:
          guide[0]?.rulesChannelId ||
          channelRows.find((channel) => channel.kind === "text")?.id ||
          null,
      },
      completedSteps: parseSteps(progress[0]?.completedSteps),
      completedAt: progress[0]?.completedAt || null,
      channels: channelRows,
      canManage: (permissions & PERMISSIONS.manageServer) !== 0,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    const payload = await readJson<GuidePayload>(request, 2_048);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await enforceRateLimit(request, "guide-progress", identity.email, 20, 60_000);
    if (payload.action !== "progress" || !GUIDE_STEPS.includes(payload.step as GuideStep)) {
      return apiJson({ error: "Rehber adımı geçersiz." }, { status: 400 });
    }
    const [current] = await db
      .select()
      .from(serverGuideProgress)
      .where(
        and(
          eq(serverGuideProgress.serverId, serverId),
          eq(serverGuideProgress.profileId, profile.id),
        ),
      )
      .limit(1);
    const completedSteps = Array.from(
      new Set([...parseSteps(current?.completedSteps), payload.step!]),
    );
    const now = new Date().toISOString();
    const completedAt =
      completedSteps.length === GUIDE_STEPS.length ? current?.completedAt || now : null;
    await db
      .insert(serverGuideProgress)
      .values({
        id: `${serverId}:${profile.id}`,
        serverId,
        profileId: profile.id,
        completedSteps: JSON.stringify(completedSteps),
        completedAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [serverGuideProgress.serverId, serverGuideProgress.profileId],
        set: {
          completedSteps: JSON.stringify(completedSteps),
          completedAt,
          updatedAt: now,
        },
      });
    return apiJson({ completedSteps, completedAt });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    const payload = await readJson<GuidePayload>(request, 8_192);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await requirePermission(profile, PERMISSIONS.manageServer, serverId);
    await enforceRateLimit(request, "guide-settings", identity.email, 10, 60_000);
    const welcomeMessage = cleanText(payload.welcomeMessage, {
      min: 2,
      max: 500,
      multiline: true,
    });
    let rulesChannelId: string | null = null;
    if (payload.rulesChannelId) {
      rulesChannelId = cleanText(payload.rulesChannelId, { max: 80 });
      const [channel] = await db
        .select({ id: channels.id })
        .from(channels)
        .where(
          and(
            eq(channels.id, rulesChannelId),
            eq(channels.serverId, serverId),
            eq(channels.kind, "text"),
          ),
        )
        .limit(1);
      if (!channel) {
        return apiJson({ error: "Kurallar odası geçersiz." }, { status: 400 });
      }
    }
    const updatedAt = new Date().toISOString();
    await db
      .insert(serverGuides)
      .values({
        serverId,
        welcomeMessage,
        rulesChannelId,
        updatedByProfileId: profile.id,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: serverGuides.serverId,
        set: {
          welcomeMessage,
          rulesChannelId,
          updatedByProfileId: profile.id,
          updatedAt,
        },
      });
    await writeAudit(profile.id, "guide.update", serverId, rulesChannelId || undefined, serverId);
    return apiJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
