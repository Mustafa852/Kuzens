import { and, eq } from "drizzle-orm";
import { channels, messageAttachments, messages } from "@/db/schema";
import {
  DEFAULT_SERVER_ID,
  PERMISSIONS,
  permissionsFor,
  requireChannelPermission,
  requireMember,
} from "@/lib/community";
import { getUploads } from "@/lib/storage";
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

const ACCEPTED_TYPES = new Set([
  "image/webp",
  "image/png",
  "image/jpeg",
  "image/gif",
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/wav",
  "video/webm",
  "application/pdf",
  "text/plain",
]);
const MAX_FILE_BYTES = 4_000_000;

function decodeFile(value: unknown, declaredType: string) {
  if (typeof value !== "string") throw new ApiError(400, "Dosya verisi geçersiz.");
  const match = value.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match || match[1] !== declaredType || !ACCEPTED_TYPES.has(match[1])) {
    throw new ApiError(400, "Bu dosya türü desteklenmiyor.");
  }
  const binary = atob(match[2]);
  if (binary.length < 1 || binary.length > MAX_FILE_BYTES) {
    throw new ApiError(400, "Dosya en fazla 4 MB olabilir.");
  }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = requireIdentity(request);
    const payload = await readJson<{
      serverId?: string;
      channelId?: string;
      messageId?: string;
      fileName?: string;
      contentType?: string;
      dataUrl?: string;
      width?: number;
      height?: number;
    }>(request, 5_600_000);
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const channelId = cleanText(payload.channelId, { max: 80 });
    const messageId = cleanText(payload.messageId, { max: 80 });
    const fileName = cleanText(payload.fileName, { max: 100 }).replace(/[\\/]/g, "_");
    const contentType = cleanText(payload.contentType, { max: 80 }).toLocaleLowerCase("en-US");
    const { db, profile } = await requireMember(identity, serverId);
    await requireChannelPermission(profile, PERMISSIONS.sendMessages, serverId, channelId);
    await enforceRateLimit(request, "attachment-upload", identity.email, 12, 60_000);
    const [[message], [channel]] = await Promise.all([
      db.select().from(messages).where(and(eq(messages.id, messageId), eq(messages.channelId, channelId))).limit(1),
      db.select().from(channels).where(and(eq(channels.id, channelId), eq(channels.serverId, serverId))).limit(1),
    ]);
    if (!message || !channel || message.deletedAt || message.authorProfileId !== profile.id) {
      throw new ApiError(403, "Dosya yalnızca kendi yeni mesajına eklenebilir.");
    }
    if (Date.now() - new Date(message.createdAt).getTime() > 5 * 60_000) {
      throw new ApiError(400, "Dosya ekleme süresi doldu.");
    }
    const existing = await db
      .select({ id: messageAttachments.id })
      .from(messageAttachments)
      .where(eq(messageAttachments.messageId, messageId));
    if (existing.length >= 4) throw new ApiError(400, "Bir mesaja en fazla 4 dosya eklenebilir.");
    const bytes = decodeFile(payload.dataUrl, contentType);
    const id = crypto.randomUUID();
    const extension = fileName.includes(".") ? fileName.split(".").pop()!.slice(0, 8) : "bin";
    const storageKey = `attachments/${serverId}/${profile.id}/${id}.${extension}`;
    await getUploads().put(storageKey, bytes, {
      httpMetadata: { contentType, cacheControl: "private, max-age=86400" },
      customMetadata: { uploaderProfileId: profile.id, messageId, channelId },
    });
    const attachment = {
      id,
      messageId,
      uploaderProfileId: profile.id,
      storageKey,
      fileName,
      contentType,
      size: bytes.byteLength,
      width: Number.isInteger(payload.width) ? Math.max(1, Math.min(8_000, Number(payload.width))) : null,
      height: Number.isInteger(payload.height) ? Math.max(1, Math.min(8_000, Number(payload.height))) : null,
      createdAt: new Date().toISOString(),
    };
    await db.insert(messageAttachments).values(attachment);
    return apiJson({ attachment: { ...attachment, storageKey: undefined, url: `/api/media?attachment=${id}` } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = requireIdentity(request);
    const payload = await readJson<{ id?: string; serverId?: string }>(request, 2_048);
    const id = cleanText(payload.id, { max: 80 });
    const serverId = cleanText(payload.serverId || DEFAULT_SERVER_ID, { max: 80 });
    const { db, profile } = await requireMember(identity, serverId);
    const [attachment] = await db.select().from(messageAttachments).where(eq(messageAttachments.id, id)).limit(1);
    if (!attachment) throw new ApiError(404, "Dosya bulunamadı.");
    const [message] = await db.select().from(messages).where(eq(messages.id, attachment.messageId)).limit(1);
    const permissions = await permissionsFor(profile, serverId);
    if (attachment.uploaderProfileId !== profile.id && (permissions & PERMISSIONS.manageMessages) === 0) {
      throw new ApiError(403, "Bu dosyayı silemezsin.");
    }
    if (!message) throw new ApiError(404, "Mesaj bulunamadı.");
    const [channel] = await db.select().from(channels).where(eq(channels.id, message.channelId)).limit(1);
    if (channel?.serverId !== serverId) throw new ApiError(403, "Dosya bu topluluğa ait değil.");
    await getUploads().delete(attachment.storageKey);
    await db.delete(messageAttachments).where(eq(messageAttachments.id, id));
    return apiJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
