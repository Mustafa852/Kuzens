import { and, eq, lt, ne } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { authChallenges, authSessions } from "@/db/schema";
import { SESSION_COOKIE_NAME, sha256Hex } from "@/lib/identity";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CHALLENGE_TTL_MS = 10 * 60 * 1000;

function randomBase64Url(byteLength: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function codePepper() {
  const value = env.KUZENS_AUTH_SECRET?.trim();
  if (!value || value.length < 32) {
    throw new Error("Kuzens giriş güvenlik anahtarı yapılandırılmamış.");
  }
  return value;
}

async function codeDigest(challengeId: string, code: string) {
  return sha256Hex(`${challengeId}:${code}:${codePepper()}`);
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function createAuthChallenge(
  firebaseUid: string,
  email: string,
  purpose: "registration" | "login",
) {
  const db = getDb();
  const now = Date.now();
  const id = crypto.randomUUID();
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");

  await db.delete(authChallenges).where(lt(authChallenges.expiresAt, now));
  await db
    .update(authChallenges)
    .set({ consumedAt: new Date(now).toISOString() })
    .where(
      and(
        eq(authChallenges.firebaseUid, firebaseUid),
        eq(authChallenges.purpose, purpose),
        ne(authChallenges.id, id),
      ),
    );
  await db.insert(authChallenges).values({
    id,
    firebaseUid,
    email,
    purpose,
    codeDigest: await codeDigest(id, code),
    expiresAt: now + CHALLENGE_TTL_MS,
    attempts: 0,
    maxAttempts: 5,
    createdAt: new Date(now).toISOString(),
  });

  return { id, code, expiresAt: now + CHALLENGE_TTL_MS };
}

export async function verifyAuthChallenge(
  challengeId: string,
  firebaseUid: string,
  purpose: "registration" | "login",
  code: string,
) {
  const db = getDb();
  const [challenge] = await db
    .select()
    .from(authChallenges)
    .where(eq(authChallenges.id, challengeId))
    .limit(1);
  if (
    !challenge ||
    challenge.firebaseUid !== firebaseUid ||
    challenge.purpose !== purpose ||
    challenge.consumedAt ||
    challenge.expiresAt <= Date.now() ||
    challenge.attempts >= challenge.maxAttempts
  ) {
    return false;
  }

  const nextAttempts = challenge.attempts + 1;
  const valid = timingSafeEqual(
    challenge.codeDigest,
    await codeDigest(challenge.id, code),
  );
  await db
    .update(authChallenges)
    .set({
      attempts: nextAttempts,
      consumedAt: valid ? new Date().toISOString() : null,
    })
    .where(eq(authChallenges.id, challenge.id));
  return valid;
}

export async function createSessionCookie(firebaseUid: string) {
  const rawToken = randomBase64Url(48);
  const now = Date.now();
  const db = getDb();
  await db.delete(authSessions).where(lt(authSessions.expiresAt, now));
  await db.insert(authSessions).values({
    id: await sha256Hex(rawToken),
    firebaseUid,
    expiresAt: now + SESSION_TTL_MS,
    createdAt: new Date(now).toISOString(),
    lastSeenAt: new Date(now).toISOString(),
  });
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(rawToken)}; Path=/; Max-Age=${Math.floor(
    SESSION_TTL_MS / 1000,
  )}; HttpOnly; Secure; SameSite=Lax`;
}

export async function destroySession(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const rawToken = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);
  if (rawToken) {
    await getDb()
      .delete(authSessions)
      .where(eq(authSessions.id, await sha256Hex(decodeURIComponent(rawToken))));
  }
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

