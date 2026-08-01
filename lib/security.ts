import { eq, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { rateLimits } from "@/db/schema";
import type { RequestIdentity } from "@/lib/identity";
import { getRequestIdentity } from "@/lib/identity";

export class ApiError extends Error {
  status: number;
  headers?: HeadersInit;

  constructor(status: number, message: string, headers?: HeadersInit) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

export async function requireIdentity(request: Request): Promise<RequestIdentity> {
  const identity = await getRequestIdentity(request);
  if (!identity) {
    throw new ApiError(401, "Bu işlem için Kuzens hesabına giriş yapmalısın.");
  }
  return identity;
}

export function assertTrustedMutation(request: Request) {
  if (request.headers.get("x-kuzens-request") !== "1") {
    throw new ApiError(403, "İstek doğrulanamadı.");
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site" || fetchSite === "same-site") {
    throw new ApiError(403, "Siteler arası istek engellendi.");
  }

  const origin = request.headers.get("origin");
  if (origin) {
    const requestOrigin = new URL(request.url).origin;
    const forwardedHost =
      request.headers.get("x-forwarded-host") || request.headers.get("host");
    const forwardedProto =
      request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.slice(0, -1);
    const allowedOrigins = new Set([requestOrigin]);
    if (forwardedHost) allowedOrigins.add(`${forwardedProto}://${forwardedHost}`);
    if (!allowedOrigins.has(origin)) {
      throw new ApiError(403, "İstek kaynağı doğrulanamadı.");
    }
  }
}

export async function readJson<T>(request: Request, maxBytes = 16_384): Promise<T> {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim();
  if (contentType !== "application/json") {
    throw new ApiError(415, "Yalnızca JSON istekleri kabul edilir.");
  }

  const announcedLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(announcedLength) && announcedLength > maxBytes) {
    throw new ApiError(413, "İstek gövdesi çok büyük.");
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    throw new ApiError(413, "İstek gövdesi çok büyük.");
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new ApiError(400, "Geçersiz JSON.");
  }
}

export function cleanText(
  value: unknown,
  { min = 1, max, multiline = false }: { min?: number; max: number; multiline?: boolean },
) {
  if (typeof value !== "string") {
    throw new ApiError(400, "Metin alanı geçersiz.");
  }
  const controlPattern = multiline
    ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g
    : /[\u0000-\u001f\u007f]/g;
  const cleaned = value.normalize("NFC").replace(controlPattern, "").trim();
  if (cleaned.length < min || cleaned.length > max) {
    throw new ApiError(400, `Metin ${min}–${max} karakter olmalı.`);
  }
  return cleaned;
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const result = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(result))
    .slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function enforceRateLimit(
  request: Request,
  scope: string,
  identity: string,
  limit: number,
  windowMs: number,
) {
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const clientAddress =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const fingerprint = await digest(`${identity}|${clientAddress}`);
  const id = `${scope}:${fingerprint}:${bucket}`;
  const db = getDb();
  const updatedAt = new Date(now).toISOString();

  if (crypto.getRandomValues(new Uint8Array(1))[0] === 0) {
    await db.delete(rateLimits).where(lt(rateLimits.expiresAt, now));
  }
  await db
    .insert(rateLimits)
    .values({ id, count: 1, expiresAt: (bucket + 1) * windowMs, updatedAt })
    .onConflictDoUpdate({
      target: rateLimits.id,
      set: {
        count: sql`${rateLimits.count} + 1`,
        updatedAt,
      },
    });

  const [row] = await db.select().from(rateLimits).where(eq(rateLimits.id, id)).limit(1);
  if (row && row.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((row.expiresAt - now) / 1000));
    throw new ApiError(429, "Çok hızlı işlem yapıyorsun. Biraz bekleyip tekrar dene.", {
      "retry-after": String(retryAfter),
    });
  }
}

export function apiJson(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("vary", "Sec-Fetch-Site, Origin");
  headers.set("x-content-type-options", "nosniff");
  return Response.json(data, { ...init, headers });
}

export function apiError(error: unknown) {
  if (error instanceof ApiError) {
    return apiJson({ error: error.message }, { status: error.status, headers: error.headers });
  }
  console.error("Kuzens API error", error);
  return apiJson({ error: "İşlem güvenli biçimde tamamlanamadı." }, { status: 500 });
}
