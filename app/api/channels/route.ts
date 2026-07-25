import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { channels } from "@/db/schema";

const defaultChannels = [
  { id: "genel", serverId: "kuzens", name: "genel", kind: "text" as const, position: 0 },
  { id: "oyun-gecesi", serverId: "kuzens", name: "oyun-gecesi", kind: "text" as const, position: 1 },
  { id: "paylasimlar", serverId: "kuzens", name: "paylaşımlar", kind: "text" as const, position: 2 },
  { id: "muhabbet", serverId: "kuzens", name: "Muhabbet", kind: "voice" as const, position: 3 },
  { id: "gece-ekibi", serverId: "kuzens", name: "Gece Ekibi", kind: "voice" as const, position: 4 },
];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";
}

export async function GET() {
  try {
    const db = getDb();
    const rows = await db.select().from(channels).orderBy(asc(channels.position));
    return Response.json({ channels: rows.length ? rows : defaultChannels });
  } catch {
    return Response.json({ channels: defaultChannels, mode: "demo" });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      name?: string;
      kind?: "text" | "voice";
      serverId?: string;
    };
    const name = payload.name?.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, "-") ?? "";
    const kind = payload.kind === "voice" ? "voice" : "text";
    const serverId = payload.serverId?.trim() || "kuzens";

    if (!name || name.length > 32) {
      return Response.json({ error: "Oda adı 1–32 karakter olmalı." }, { status: 400 });
    }

    const db = getDb();
    const existing = await db.select().from(channels).where(eq(channels.serverId, serverId));
    const channel = {
      id: `${name}-${crypto.randomUUID().slice(0, 6)}`,
      serverId,
      name,
      kind,
      position: existing.length,
      createdAt: new Date().toISOString(),
    };
    await db.insert(channels).values(channel);
    return Response.json({ channel }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
