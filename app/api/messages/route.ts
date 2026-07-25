import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { messages, profiles } from "@/db/schema";
import { getRequestIdentity } from "@/lib/identity";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";
}

export async function GET(request: Request) {
  const channelId = new URL(request.url).searchParams.get("channel") || "genel";

  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.channelId, channelId))
      .orderBy(asc(messages.createdAt))
      .limit(100);
    return Response.json({ messages: rows });
  } catch {
    return Response.json({ messages: [], mode: "demo" });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { channelId?: string; content?: string };
    const channelId = payload.channelId?.trim() || "";
    const content = payload.content?.trim() || "";

    if (!channelId || !content || content.length > 2000) {
      return Response.json({ error: "Mesaj 1–2000 karakter olmalı." }, { status: 400 });
    }

    const identity = getRequestIdentity(request);
    const db = getDb();
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.email, identity.email))
      .limit(1);
    const message = {
      id: crypto.randomUUID(),
      channelId,
      authorName: profile?.displayName || identity.displayName,
      authorTag: profile ? `@${profile.username}` : identity.tag,
      content,
      createdAt: new Date().toISOString(),
    };

    await db.insert(messages).values(message);
    return Response.json({ message }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
