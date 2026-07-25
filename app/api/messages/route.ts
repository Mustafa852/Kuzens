import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { messages } from "@/db/schema";

function getIdentity(request: Request) {
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get("oai-authenticated-user-full-name-encoding");
  const email = request.headers.get("oai-authenticated-user-email");
  let name = "Savaş";

  if (encodedName && encoding === "percent-encoded-utf-8") {
    try {
      name = decodeURIComponent(encodedName);
    } catch {
      name = email?.split("@")[0] || name;
    }
  } else if (email) {
    name = email.split("@")[0];
  }

  return {
    name,
    tag: email ? `@${email.split("@")[0]}` : "@savas",
  };
}

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

    const identity = getIdentity(request);
    const message = {
      id: crypto.randomUUID(),
      channelId,
      authorName: identity.name,
      authorTag: identity.tag,
      content,
      createdAt: new Date().toISOString(),
    };

    const db = getDb();
    await db.insert(messages).values(message);
    return Response.json({ message }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
