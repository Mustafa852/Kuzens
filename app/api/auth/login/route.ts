import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { authAccounts } from "@/db/schema";
import { createAuthChallenge, createSessionCookie, verifyAuthChallenge } from "@/lib/auth-session";
import { sendLoginCode } from "@/lib/email";
import { verifyFirebaseIdToken } from "@/lib/firebase-token";
import {
  ApiError,
  apiError,
  apiJson,
  assertTrustedMutation,
  enforceRateLimit,
  readJson,
} from "@/lib/security";

async function firebaseIdentity(request: Request) {
  try {
    return await verifyFirebaseIdToken(request);
  } catch {
    throw new ApiError(401, "E-posta veya şifre doğrulanamadı.");
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const firebase = await firebaseIdentity(request);
    const payload = await readJson<{
      action?: "complete" | "verify";
      challengeId?: string;
      code?: string;
    }>(request, 4_096);
    const db = getDb();
    const [account] = await db
      .select()
      .from(authAccounts)
      .where(eq(authAccounts.firebaseUid, firebase.firebaseUid))
      .limit(1);
    if (!account?.emailVerifiedAt) {
      throw new ApiError(403, "Hesabın henüz doğrulanmamış. Kayıt ekranından yeni kod iste.");
    }

    if (payload.action === "complete") {
      await enforceRateLimit(request, "auth-login", firebase.email, 12, 15 * 60_000);
      if (account.loginCodeEnabled) {
        const challenge = await createAuthChallenge(
          firebase.firebaseUid,
          firebase.email,
          "login",
        );
        await sendLoginCode(firebase.email, challenge.code, "login");
        return apiJson({
          codeRequired: true,
          challengeId: challenge.id,
          expiresAt: challenge.expiresAt,
          maskedEmail: firebase.email.replace(/^(.{2}).*(@.*)$/, "$1••••$2"),
        });
      }

      const now = new Date().toISOString();
      await db
        .update(authAccounts)
        .set({ lastLoginAt: now, updatedAt: now })
        .where(eq(authAccounts.firebaseUid, firebase.firebaseUid));
      return apiJson(
        { authenticated: true },
        { headers: { "set-cookie": await createSessionCookie(firebase.firebaseUid) } },
      );
    }

    if (payload.action === "verify") {
      await enforceRateLimit(request, "auth-login-verify", firebase.email, 10, 15 * 60_000);
      const challengeId = typeof payload.challengeId === "string" ? payload.challengeId : "";
      const code = typeof payload.code === "string" ? payload.code.trim() : "";
      if (!/^[0-9]{6}$/.test(code) || challengeId.length > 100) {
        throw new ApiError(400, "Doğrulama kodu 6 haneli olmalı.");
      }
      const valid = await verifyAuthChallenge(
        challengeId,
        firebase.firebaseUid,
        "login",
        code,
      );
      if (!valid) throw new ApiError(400, "Kod yanlış, süresi dolmuş veya kullanım sınırına ulaşmış.");

      const now = new Date().toISOString();
      await db
        .update(authAccounts)
        .set({ lastLoginAt: now, updatedAt: now })
        .where(eq(authAccounts.firebaseUid, firebase.firebaseUid));
      return apiJson(
        { authenticated: true },
        { headers: { "set-cookie": await createSessionCookie(firebase.firebaseUid) } },
      );
    }

    throw new ApiError(400, "Giriş işlemi geçersiz.");
  } catch (error) {
    return apiError(error);
  }
}

