import { and, asc, eq } from "drizzle-orm";
import { customEmojis } from "@/db/schema";
import { DEFAULT_SERVER_ID, PERMISSIONS, requireMember, requirePermission, writeAudit } from "@/lib/community";
import { getUploads } from "@/lib/storage";
import { ApiError, apiError, apiJson, assertTrustedMutation, cleanText, enforceRateLimit, readJson, requireIdentity } from "@/lib/security";

function decodeEmoji(value: unknown) {
  if (typeof value !== "string") throw new ApiError(400, "Emoji verisi geçersiz.");
  const match = value.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new ApiError(400, "Emoji PNG, JPEG, WebP veya GIF olmalı.");
  const binary = atob(match[2]);
  if (binary.length < 16 || binary.length > 300_000) throw new ApiError(400, "Emoji en fazla 300 KB olabilir.");
  return { bytes: Uint8Array.from(binary, (character) => character.charCodeAt(0)), contentType: match[1] };
}

export async function GET(request: Request) {
  try {
    const identity = await requireIdentity(request);
    const serverId = cleanText(new URL(request.url).searchParams.get("server") || DEFAULT_SERVER_ID, { max: 80 });
    const { db } = await requireMember(identity, serverId);
    const emojis = await db.select().from(customEmojis).where(eq(customEmojis.serverId, serverId)).orderBy(asc(customEmojis.name));
    return apiJson({ emojis: emojis.map((emoji) => ({ id: emoji.id, name: emoji.name, url: `/api/emoji?id=${encodeURIComponent(emoji.id)}`, createdAt: emoji.createdAt })) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    const payload = await readJson<{ serverId?: string; name?: string; dataUrl?: string }>(request, 500_000);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await requirePermission(profile, PERMISSIONS.manageServer, serverId);
    await enforceRateLimit(request, "emoji-upload", identity.email, 10, 60 * 60_000);
    const name = cleanText(payload.name, { min: 2, max: 24 }).toLocaleLowerCase("en-US").replace(/[^a-z0-9_]/g, "");
    if (!/^[a-z0-9_]{2,24}$/.test(name)) throw new ApiError(400, "Emoji adı geçersiz.");
    const count = await db.select({ id: customEmojis.id }).from(customEmojis).where(eq(customEmojis.serverId, serverId));
    if (count.length >= 50) throw new ApiError(400, "Bir topluluğa en fazla 50 özel emoji eklenebilir.");
    const decoded = decodeEmoji(payload.dataUrl);
    const id = crypto.randomUUID();
    const extension = decoded.contentType.split("/")[1].replace("jpeg", "jpg");
    const storageKey = `emojis/${serverId}/${id}.${extension}`;
    await getUploads().put(storageKey, decoded.bytes, { httpMetadata: { contentType: decoded.contentType, cacheControl: "private, max-age=31536000, immutable" }, customMetadata: { serverId, uploaderProfileId: profile.id } });
    const emoji = { id, serverId, name, storageKey, uploaderProfileId: profile.id, createdAt: new Date().toISOString() };
    try {
      await db.insert(customEmojis).values(emoji);
    } catch (error) {
      await getUploads().delete(storageKey).catch(() => undefined);
      throw error;
    }
    await writeAudit(profile.id, "emoji.create", id, name, serverId);
    return apiJson({ emoji: { id, name, url: `/api/emoji?id=${encodeURIComponent(id)}`, createdAt: emoji.createdAt } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    const payload = await readJson<{ serverId?: string; id?: string }>(request, 2_048);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const id = cleanText(payload.id, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    await requirePermission(profile, PERMISSIONS.manageServer, serverId);
    const [emoji] = await db.select().from(customEmojis).where(and(eq(customEmojis.id, id), eq(customEmojis.serverId, serverId))).limit(1);
    if (!emoji) throw new ApiError(404, "Emoji bulunamadı.");
    await db.delete(customEmojis).where(eq(customEmojis.id, id));
    await getUploads().delete(emoji.storageKey).catch(() => undefined);
    await writeAudit(profile.id, "emoji.delete", id, emoji.name, serverId);
    return apiJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
