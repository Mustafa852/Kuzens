import { and, desc, eq } from "drizzle-orm";
import { channels, contentReports, messages, profiles } from "@/db/schema";
import {
  DEFAULT_SERVER_ID,
  PERMISSIONS,
  requireMember,
  requirePermission,
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

export async function GET(request: Request) {
  try {
    const identity = requireIdentity(request);
    const serverId = cleanText(new URL(request.url).searchParams.get("server") || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await requirePermission(profile, PERMISSIONS.manageMessages, serverId);
    const reports = await db
      .select()
      .from(contentReports)
      .where(eq(contentReports.serverId, serverId))
      .orderBy(desc(contentReports.createdAt))
      .limit(100);
    return apiJson({ reports });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = requireIdentity(request);
    const payload = await readJson<{
      serverId?: string;
      targetType?: "message" | "profile";
      targetId?: string;
      reason?: string;
      details?: string;
    }>(request, 8_192);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await enforceRateLimit(request, "content-report", identity.email, 5, 60 * 60_000);
    const targetType: "message" | "profile" = payload.targetType === "profile" ? "profile" : "message";
    const targetId = cleanText(payload.targetId, { max: 80 });
    const reason = cleanText(payload.reason, { min: 3, max: 80 });
    const details = cleanText(payload.details || "", { min: 0, max: 1_000, multiline: true });
    if (targetType === "message") {
      const [message] = await db.select().from(messages).where(eq(messages.id, targetId)).limit(1);
      const [channel] = message
        ? await db.select().from(channels).where(eq(channels.id, message.channelId)).limit(1)
        : [];
      if (!message || channel?.serverId !== serverId) throw new ApiError(404, "Mesaj bulunamadı.");
    } else {
      const [target] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, targetId)).limit(1);
      if (!target) throw new ApiError(404, "Kullanıcı bulunamadı.");
      if (target.id === profile.id) throw new ApiError(400, "Kendi profilini bildiremezsin.");
    }
    const now = new Date().toISOString();
    const report = {
      id: crypto.randomUUID(),
      serverId,
      reporterProfileId: profile.id,
      targetType,
      targetId,
      reason,
      details,
      status: "open" as const,
      reviewedByProfileId: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(contentReports).values(report);
    return apiJson({ report }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = requireIdentity(request);
    const payload = await readJson<{ serverId?: string; id?: string; status?: "reviewed" | "closed" }>(request, 2_048);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const id = cleanText(payload.id, { max: 80 });
    const status = payload.status === "closed" ? "closed" : "reviewed";
    const { db, profile } = await requireMember(identity, serverId);
    await requirePermission(profile, PERMISSIONS.manageMessages, serverId);
    const [existing] = await db.select().from(contentReports).where(and(eq(contentReports.id, id), eq(contentReports.serverId, serverId))).limit(1);
    if (!existing) throw new ApiError(404, "Bildirim bulunamadı.");
    await db.update(contentReports).set({ status, reviewedByProfileId: profile.id, updatedAt: new Date().toISOString() }).where(eq(contentReports.id, id));
    await writeAudit(profile.id, "report.review", id, status, serverId);
    return apiJson({ ok: true, status });
  } catch (error) {
    return apiError(error);
  }
}
