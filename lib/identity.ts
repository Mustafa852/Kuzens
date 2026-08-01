import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { authAccounts, authSessions } from "@/db/schema";

export const SESSION_COOKIE_NAME = "__Host-kuzens_session";

export type RequestIdentity = {
  firebaseUid: string;
  email: string;
  displayName: string;
  tag: string;
  loginCodeEnabled: boolean;
};

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key === name) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function getRequestIdentity(
  request: Request,
): Promise<RequestIdentity | null> {
  const rawToken = readCookie(request, SESSION_COOKIE_NAME);
  if (!rawToken || rawToken.length < 40 || rawToken.length > 180) return null;

  const sessionId = await sha256Hex(rawToken);
  const db = getDb();
  const now = Date.now();
  const [row] = await db
    .select({
      firebaseUid: authAccounts.firebaseUid,
      email: authAccounts.email,
      loginCodeEnabled: authAccounts.loginCodeEnabled,
    })
    .from(authSessions)
    .innerJoin(authAccounts, eq(authSessions.firebaseUid, authAccounts.firebaseUid))
    .where(and(eq(authSessions.id, sessionId), gt(authSessions.expiresAt, now)))
    .limit(1);

  if (!row) return null;
  const email = row.email.trim().toLocaleLowerCase("en-US");
  const displayName = email.split("@")[0] || "Kuzen";
  return {
    firebaseUid: row.firebaseUid,
    email,
    displayName,
    tag: `@${displayName.replace(/[^a-z0-9_]/gi, "").toLocaleLowerCase("en-US")}`,
    loginCodeEnabled: row.loginCodeEnabled,
  };
}

