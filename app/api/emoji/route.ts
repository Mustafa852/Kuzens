import { eq } from "drizzle-orm";
import { customEmojis } from "@/db/schema";
import { requireMember } from "@/lib/community";
import { getUploads } from "@/lib/storage";
import { ApiError, apiError, cleanText, requireIdentity } from "@/lib/security";

export async function GET(request: Request) {
  try {
    const identity = await requireIdentity(request);
    const id = cleanText(new URL(request.url).searchParams.get("id"), { max: 80 });
    const { getDb } = await import("@/db");
    const db = getDb();
    const [emoji] = await db.select().from(customEmojis).where(eq(customEmojis.id, id)).limit(1);
    if (!emoji) throw new ApiError(404, "Emoji bulunamadı.");
    await requireMember(identity, emoji.serverId);
    const object = await getUploads().get(emoji.storageKey);
    if (!object) throw new ApiError(404, "Emoji bulunamadı.");
    return new Response(object.body as BodyInit, { headers: { "content-type": object.httpMetadata?.contentType || "image/webp", "cache-control": "private, max-age=86400", "content-security-policy": "default-src 'none'", "x-content-type-options": "nosniff" } });
  } catch (error) {
    return apiError(error);
  }
}
