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

const LEGAL_VERSION = "2026-07-25.v1";

async function firebaseIdentity(request: Request) {
  try {
    return await verifyFirebaseIdToken(request);
  } catch {
    throw new ApiError(401, "E-posta oturumu doğrulanamadı. Lütfen yeniden giriş yap.");
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const firebase = await firebaseIdentity(request);
    const payload = await readJson<{
      action?: "start" | "verify";
      challengeId?: string;
      code?: string;
      birthConfirmed?: boolean;
      termsAccepted?: boolean;
      noticeRead?: boolean;
      communityAccepted?: boolean;
    }>(request, 8_192);
    const db = getDb();

    if (payload.action === "start") {
      await enforceRateLimit(request, "auth-register", firebase.email, 5, 15 * 60_000);
      if (
        payload.birthConfirmed !== true ||
        payload.termsAccepted !== true ||
        payload.noticeRead !== true ||
        payload.communityAccepted !== true
      ) {
        throw new ApiError(400, "Kayıt için zorunlu onayları tamamlamalısın.");
      }

      const now = new Date().toISOString();
      const [existing] = await db
        .select()
        .from(authAccounts)
        .where(eq(authAccounts.firebaseUid, firebase.firebaseUid))
        .limit(1);
      if (existing?.emailVerifiedAt) {
        throw new ApiError(409, "Bu hesap zaten doğrulanmış. Giriş yapabilirsin.");
      }
      await db
        .insert(authAccounts)
        .values({
          firebaseUid: firebase.firebaseUid,
          email: firebase.email,
          birthConfirmed: true,
          termsVersion: LEGAL_VERSION,
          noticeVersion: LEGAL_VERSION,
          communityVersion: LEGAL_VERSION,
          acceptedAt: now,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: authAccounts.firebaseUid,
          set: {
            email: firebase.email,
            birthConfirmed: true,
            termsVersion: LEGAL_VERSION,
            noticeVersion: LEGAL_VERSION,
            communityVersion: LEGAL_VERSION,
            acceptedAt: now,
            updatedAt: now,
          },
        });

      const challenge = await createAuthChallenge(
        firebase.firebaseUid,
        firebase.email,
        "registration",
      );
      await sendLoginCode(firebase.email, challenge.code, "registration");
      return apiJson({
        codeRequired: true,
        challengeId: challenge.id,
        expiresAt: challenge.expiresAt,
        maskedEmail: firebase.email.replace(/^(.{2}).*(@.*)$/, "$1••••$2"),
      });
    }

    if (payload.action === "verify") {
      await enforceRateLimit(request, "auth-register-verify", firebase.email, 10, 15 * 60_000);
      const challengeId = typeof payload.challengeId === "string" ? payload.challengeId : "";
      const code = typeof payload.code === "string" ? payload.code.trim() : "";
      if (!/^[0-9]{6}$/.test(code) || challengeId.length > 100) {
        throw new ApiError(400, "Doğrulama kodu 6 haneli olmalı.");
      }
      const valid = await verifyAuthChallenge(
        challengeId,
        firebase.firebaseUid,
        "registration",
        code,
      );
      if (!valid) throw new ApiError(400, "Kod yanlış, süresi dolmuş veya kullanım sınırına ulaşmış.");

      const now = new Date().toISOString();
      await db
        .update(authAccounts)
        .set({ emailVerifiedAt: now, lastLoginAt: now, updatedAt: now })
        .where(eq(authAccounts.firebaseUid, firebase.firebaseUid));
      return apiJson(
        { authenticated: true },
        { headers: { "set-cookie": await createSessionCookie(firebase.firebaseUid) } },
      );
    }

    throw new ApiError(400, "Kayıt işlemi geçersiz.");
  } catch (error) {
    const duplicate = error instanceof Error && /unique|constraint/i.test(error.message);
    if (duplicate) {
      return apiJson({ error: "Bu e-posta başka bir Kuzens hesabına bağlı." }, { status: 409 });
    }
    return apiError(error);
  }
}

