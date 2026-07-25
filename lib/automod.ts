import { and, desc, eq } from "drizzle-orm";
import {
  messages,
  profiles,
  serverAutoModerationSettings,
} from "@/db/schema";
import { getDb } from "@/db";
import { PERMISSIONS, permissionsFor, writeAudit } from "@/lib/community";

type Database = ReturnType<typeof getDb>;

export type AutoModSettings = {
  enabled: boolean;
  blockedTerms: string;
  blockInviteLinks: boolean;
  blockDuplicateMessages: boolean;
  maxMentions: number;
  exemptChannelIds: string[];
};

export const defaultAutoModSettings: AutoModSettings = {
  enabled: true,
  blockedTerms: "",
  blockInviteLinks: true,
  blockDuplicateMessages: true,
  maxMentions: 8,
  exemptChannelIds: [],
};

export async function readAutoModSettings(db: Database, serverId: string) {
  const [row] = await db
    .select()
    .from(serverAutoModerationSettings)
    .where(eq(serverAutoModerationSettings.serverId, serverId))
    .limit(1);
  if (!row) return defaultAutoModSettings;
  let exemptChannelIds: string[] = [];
  try {
    const parsed = JSON.parse(row.exemptChannelIds);
    if (Array.isArray(parsed)) {
      exemptChannelIds = parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    exemptChannelIds = [];
  }
  return {
    enabled: row.enabled,
    blockedTerms: row.blockedTerms,
    blockInviteLinks: row.blockInviteLinks,
    blockDuplicateMessages: row.blockDuplicateMessages,
    maxMentions: row.maxMentions,
    exemptChannelIds,
  } satisfies AutoModSettings;
}

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ")
    .trim();
}

export async function checkAutoModeration({
  db,
  profile,
  serverId,
  channelId,
  content,
  editing = false,
}: {
  db: Database;
  profile: typeof profiles.$inferSelect;
  serverId: string;
  channelId: string;
  content: string;
  editing?: boolean;
}) {
  const permissions = await permissionsFor(profile, serverId);
  if ((permissions & (PERMISSIONS.manageServer | PERMISSIONS.manageMessages)) !== 0) {
    return null;
  }
  const settings = await readAutoModSettings(db, serverId);
  if (!settings.enabled || settings.exemptChannelIds.includes(channelId)) return null;

  const normalized = normalize(content);
  const mentionCount = Array.from(
    content.matchAll(/@(?:everyone|here|[a-z0-9_]{3,24})\b/gi),
  ).length;
  let reason: string | null = null;
  if (settings.maxMentions > 0 && mentionCount > settings.maxMentions) {
    reason = `mention-limit:${settings.maxMentions}`;
  } else if (
    settings.blockInviteLinks &&
    /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/[\w-]+/i.test(
      content,
    )
  ) {
    reason = "external-invite";
  } else {
    const terms = settings.blockedTerms
      .split(/[\n,]/)
      .map(normalize)
      .filter((term) => term.length >= 2)
      .slice(0, 100);
    if (terms.some((term) => normalized.includes(term))) reason = "custom-keyword";
  }

  if (!reason && settings.blockDuplicateMessages && !editing && normalized.length >= 2) {
    const recent = await db
      .select({ content: messages.content, createdAt: messages.createdAt })
      .from(messages)
      .where(
        and(
          eq(messages.channelId, channelId),
          eq(messages.authorProfileId, profile.id),
        ),
      )
      .orderBy(desc(messages.createdAt))
      .limit(3);
    const cutoff = Date.now() - 30_000;
    const duplicates = recent.filter(
      (message) =>
        new Date(message.createdAt).getTime() >= cutoff &&
        normalize(message.content) === normalized,
    ).length;
    if (duplicates >= 2) reason = "duplicate-spam";
  }

  if (reason) {
    await writeAudit(profile.id, "automod.block", channelId, reason, serverId);
  }
  return reason;
}

export function autoModError(reason: string) {
  if (reason.startsWith("mention-limit")) {
    return "Mesaj çok fazla etiket içeriyor. Daha az kullanıcı etiketleyerek tekrar dene.";
  }
  if (reason === "external-invite") {
    return "Bu toplulukta dış sunucu davet bağlantıları engelleniyor.";
  }
  if (reason === "custom-keyword") {
    return "Mesaj, topluluğun AutoMod kuralına takıldı.";
  }
  return "Aynı mesajı kısa sürede tekrar göndermeyi bırakıp biraz bekle.";
}
