import { getDb } from "@/db";
import { privacyRequests } from "@/db/schema";
import {
  apiError,
  apiJson,
  assertTrustedMutation,
  cleanText,
  enforceRateLimit,
  readJson,
} from "@/lib/security";

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const payload = await readJson<{
      applicantName?: string;
      email?: string;
      requestType?: string;
      details?: string;
    }>(request, 8_192);
    const applicantName = cleanText(payload.applicantName, { min: 2, max: 80 });
    const email =
      typeof payload.email === "string"
        ? payload.email.trim().toLocaleLowerCase("en-US")
        : "";
    const requestType = cleanText(payload.requestType, { max: 80 });
    const details = cleanText(payload.details, { min: 10, max: 3_000, multiline: true });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
      return apiJson({ error: "Geçerli bir e-posta adresi gir." }, { status: 400 });
    }
    await enforceRateLimit(request, "privacy-request", "public-form", 5, 60 * 60_000);

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
    return apiJson({ requestId: item.id, receivedAt: item.createdAt }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
