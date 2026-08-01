import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { requireProfile } from "@/lib/community";
import {
  apiError,
  apiJson,
  cleanText,
  requireIdentity,
} from "@/lib/security";
import { getUploads } from "@/lib/storage";

export async function GET(request: Request) {
  try {
    const identity = requireIdentity(request);
    await requireProfile(identity);
    const profileId = cleanText(
      new URL(request.url).searchParams.get("profile"),
      { max: 80 },
    );
    const db = getDb();
    const [profile] = await db
      .select({ avatarKey: profiles.avatarKey })
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1);
    if (!profile?.avatarKey) {
      return apiJson({ error: "Profil fotoğrafı bulunamadı." }, { status: 404 });
    }
    const object = await getUploads().get(profile.avatarKey);
    if (!object) {
      return apiJson({ error: "Profil fotoğrafı bulunamadı." }, { status: 404 });
    }
    return new Response(object.body as BodyInit, {
      headers: {
        "cache-control": "private, max-age=86400, immutable",
        "content-type": object.httpMetadata?.contentType || "image/webp",
        "content-security-policy": "default-src 'none'",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
