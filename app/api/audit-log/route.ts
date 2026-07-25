import { desc, eq } from "drizzle-orm";
import { auditLogs, profiles } from "@/db/schema";
import {
  DEFAULT_SERVER_ID,
  permissionsFor,
  requireMember,
} from "@/lib/community";
import {
  ApiError,
  apiError,
  apiJson,
  cleanText,
  requireIdentity,
} from "@/lib/security";

export async function GET(request: Request) {
  try {
    const identity = requireIdentity(request);
    const serverId = cleanText(
      new URL(request.url).searchParams.get("server") || DEFAULT_SERVER_ID,
      { max: 80 },
    );
    const { db, profile } = await requireMember(identity, serverId);
    const permissions = await permissionsFor(profile, serverId);
    const moderationPermissions = 1 | 2 | 4 | 8 | 16 | 32;
    if ((permissions & moderationPermissions) === 0) {
      throw new ApiError(403, "Denetim kaydını görüntüleme yetkin yok.");
    }
    const entries = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        targetId: auditLogs.targetId,
        detail: auditLogs.detail,
        createdAt: auditLogs.createdAt,
        actorProfileId: auditLogs.actorProfileId,
        actorName: profiles.displayName,
        actorUsername: profiles.username,
      })
      .from(auditLogs)
      .innerJoin(profiles, eq(auditLogs.actorProfileId, profiles.id))
      .where(eq(auditLogs.serverId, serverId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);
    return apiJson({ entries });
  } catch (error) {
    return apiError(error);
  }
}
