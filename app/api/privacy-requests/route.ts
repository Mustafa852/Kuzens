import { getDb } from "@/db";
import { privacyRequests } from "@/db/schema";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      applicantName?: string;
      email?: string;
      requestType?: string;
      details?: string;
    };
    const applicantName = payload.applicantName?.trim() || "";
    const email = payload.email?.trim().toLocaleLowerCase("en-US") || "";
    const requestType = payload.requestType?.trim() || "";
    const details = payload.details?.trim() || "";

    if (applicantName.length < 2 || applicantName.length > 80) {
      return Response.json({ error: "Ad soyad alanını kontrol et." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Geçerli bir e-posta adresi gir." }, { status: 400 });
    }
    if (!requestType || details.length < 10 || details.length > 3000) {
      return Response.json({ error: "Talebini 10–3000 karakter arasında açıkça yaz." }, { status: 400 });
    }

    const item = {
      id: crypto.randomUUID(),
      applicantName,
      email,
      requestType,
      details,
      status: "received",
      createdAt: new Date().toISOString(),
    };
    await getDb().insert(privacyRequests).values(item);
    return Response.json({ requestId: item.id, receivedAt: item.createdAt }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Başvuru alınamadı." },
      { status: 500 },
    );
  }
}
