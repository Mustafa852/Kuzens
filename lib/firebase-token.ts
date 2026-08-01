import { env } from "cloudflare:workers";
import { decodeProtectedHeader, importX509, jwtVerify, type JWTPayload } from "jose";

const CERTIFICATES_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

type FirebaseClaims = JWTPayload & {
  email?: string;
  email_verified?: boolean;
  auth_time?: number;
};

let certificateCache:
  | { expiresAt: number; certificates: Record<string, string> }
  | undefined;

function projectId() {
  const value = env.FIREBASE_PROJECT_ID?.trim();
  if (!value) throw new Error("Firebase proje ayarı eksik.");
  return value;
}

async function getCertificates() {
  if (certificateCache && certificateCache.expiresAt > Date.now() + 30_000) {
    return certificateCache.certificates;
  }

  const response = await fetch(CERTIFICATES_URL, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error("Firebase imza anahtarları alınamadı.");
  const certificates = (await response.json()) as Record<string, string>;
  const cacheControl = response.headers.get("cache-control") || "";
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/)?.[1] || "3600");
  certificateCache = {
    certificates,
    expiresAt: Date.now() + Math.max(300, maxAge) * 1000,
  };
  return certificates;
}

export async function verifyFirebaseIdToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!token || token.length > 8_192) throw new Error("Firebase oturumu bulunamadı.");

  const header = decodeProtectedHeader(token);
  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Firebase oturumu geçersiz.");
  }
  const certificates = await getCertificates();
  const certificate = certificates[header.kid];
  if (!certificate) {
    certificateCache = undefined;
    throw new Error("Firebase oturumu doğrulanamadı.");
  }

  const expectedProjectId = projectId();
  const key = await importX509(certificate, "RS256");
  const { payload } = await jwtVerify<FirebaseClaims>(token, key, {
    algorithms: ["RS256"],
    audience: expectedProjectId,
    issuer: `https://securetoken.google.com/${expectedProjectId}`,
  });

  const now = Math.floor(Date.now() / 1000);
  if (
    !payload.sub ||
    payload.sub.length > 128 ||
    !payload.email ||
    typeof payload.auth_time !== "number" ||
    payload.auth_time > now + 60 ||
    (typeof payload.iat === "number" && payload.iat > now + 60)
  ) {
    throw new Error("Firebase oturumu geçersiz.");
  }

  return {
    firebaseUid: payload.sub,
    email: payload.email.trim().toLocaleLowerCase("en-US"),
  };
}

