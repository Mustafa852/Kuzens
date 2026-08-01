import { eq } from "drizzle-orm";
import { channels, messageAttachments, messages } from "@/db/schema";
import { PERMISSIONS, requireChannelPermission, requireMember } from "@/lib/community";
import { getUploads } from "@/lib/storage";
import { ApiError, apiError, cleanText, requireIdentity } from "@/lib/security";

export async function GET(request: Request) {
  try {
    const identity = await requireIdentity(request);
    const id = cleanText(new URL(request.url).searchParams.get("attachment"), { max: 80 });
    const { getDb } = await import("@/db");
    const db = getDb();
    const [attachment] = await db.select().from(messageAttachments).where(eq(messageAttachments.id, id)).limit(1);
    if (!attachment) throw new ApiError(404, "Dosya bulunamadı.");
    const [message] = await db.select().from(messages).where(eq(messages.id, attachment.messageId)).limit(1);
    if (!message || message.deletedAt) throw new ApiError(404, "Dosya bulunamadı.");
    const [channel] = await db.select().from(channels).where(eq(channels.id, message.channelId)).limit(1);
    if (!channel) throw new ApiError(404, "Oda bulunamadı.");
    const { profile } = await requireMember(identity, channel.serverId);
    await requireChannelPermission(profile, PERMISSIONS.viewChannels, channel.serverId, channel.id);
    const object = await getUploads().get(attachment.storageKey);
    if (!object) throw new ApiError(404, "Dosya bulunamadı.");
    const inline = attachment.contentType.startsWith("image/") || attachment.contentType.startsWith("audio/") || attachment.contentType.startsWith("video/") || attachment.contentType === "application/pdf";
    return new Response(object.body as BodyInit, {
      headers: {
        "cache-control": "private, max-age=86400",
        "content-type": attachment.contentType,
        "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
        "content-security-policy": "default-src 'none'; media-src 'self'; img-src 'self' data:",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
