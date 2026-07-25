import { eq } from "drizzle-orm";
import { channels, serverAutoModerationSettings } from "@/db/schema";
import {
  DEFAULT_SERVER_ID,
  PERMISSIONS,
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
import {
  defaultAutoModSettings,
  readAutoModSettings,
} from "@/lib/automod";

type AutoModPayload = {
  serverId?: string;
  enabled?: boolean;
  blockedTerms?: string;
  blockInviteLinks?: boolean;
  blockDuplicateMessages?: boolean;
  maxMentions?: number;
  exemptChannelIds?: string[];
};

export async function GET(request: Request) {
  try {
    const identity = requireIdentity(request);
    const serverId = cleanText(
      new URL(request.url).searchParams.get("server") || DEFAULT_SERVER_ID,
      { max: 80 },
    );
    const { db, profile } = await requireMember(identity, serverId);
    await requirePermission(profile, PERMISSIONS.manageServer, serverId);
    const settings = await readAutoModSettings(db, serverId);
    return apiJson({ settings: settings || defaultAutoModSettings });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = requireIdentity(request);
    const payload = await readJson<AutoModPayload>(request, 16_000);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await requirePermission(profile, PERMISSIONS.manageServer, serverId);
    await enforceRateLimit(request, "automod-settings", identity.email, 10, 60_000);
    const blockedTerms = cleanText(payload.blockedTerms || "", {
      min: 0,
      max: 2_000,
      multiline: true,
    });
    const terms = blockedTerms
      .split(/[\n,]/)
      .map((term) => term.trim())
      .filter(Boolean);
    if (terms.length > 100) {
      return apiJson({ error: "En fazla 100 özel ifade eklenebilir." }, { status: 400 });
    }
    const maxMentions = Math.round(Number(payload.maxMentions ?? 8));
    if (!Number.isFinite(maxMentions) || maxMentions < 1 || maxMentions > 50) {
      return apiJson({ error: "Etiket sınırı 1 ile 50 arasında olmalı." }, { status: 400 });
    }
    const allowedChannelIds = new Set(
      (
        await db
          .select({ id: channels.id })
          .from(channels)
          .where(eq(channels.serverId, serverId))
      ).map((channel) => channel.id),
    );
    const exemptChannelIds = Array.from(
      new Set(
        (payload.exemptChannelIds || [])
          .filter((id): id is string => typeof id === "string")
          .filter((id) => allowedChannelIds.has(id)),
      ),
    ).slice(0, 50);
    const now = new Date().toISOString();
    const row = {
      serverId,
      enabled: payload.enabled !== false,
      blockedTerms,
      blockInviteLinks: payload.blockInviteLinks !== false,
      blockDuplicateMessages: payload.blockDuplicateMessages !== false,
      maxMentions,
      exemptChannelIds: JSON.stringify(exemptChannelIds),
      updatedByProfileId: profile.id,
      updatedAt: now,
    };
    await db
      .insert(serverAutoModerationSettings)
      .values(row)
      .onConflictDoUpdate({
        target: serverAutoModerationSettings.serverId,
        set: {
          enabled: row.enabled,
          blockedTerms: row.blockedTerms,
          blockInviteLinks: row.blockInviteLinks,
          blockDuplicateMessages: row.blockDuplicateMessages,
          maxMentions: row.maxMentions,
          exemptChannelIds: row.exemptChannelIds,
          updatedByProfileId: row.updatedByProfileId,
          updatedAt: row.updatedAt,
        },
      });
    await writeAudit(
      profile.id,
      "automod.update",
      serverId,
      `${terms.length} ifade · ${maxMentions} etiket sınırı`,
      serverId,
    );
    return apiJson({
      settings: {
        enabled: row.enabled,
        blockedTerms: row.blockedTerms,
        blockInviteLinks: row.blockInviteLinks,
        blockDuplicateMessages: row.blockDuplicateMessages,
        maxMentions: row.maxMentions,
        exemptChannelIds,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
