import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { authAccounts } from "@/db/schema";
import { getRequestIdentity } from "@/lib/identity";
import {
  apiError,
  apiJson,
  assertTrustedMutation,
  enforceRateLimit,
  readJson,
  requireIdentity,
} from "@/lib/security";

export async function GET(request: Request) {
  try {
    const identity = await getRequestIdentity(request);
    return apiJson({
      authenticated: Boolean(identity),
      identity: identity
        ? {
            email: identity.email,
            loginCodeEnabled: identity.loginCodeEnabled,
          }
        : null,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await requireIdentity(request);
    await enforceRateLimit(request, "auth-settings", identity.email, 12, 60 * 60_000);
    const payload = await readJson<{ loginCodeEnabled?: boolean }>(request, 2_048);
    const loginCodeEnabled = payload.loginCodeEnabled === true;
    await getDb()
      .update(authAccounts)
      .set({ loginCodeEnabled, updatedAt: new Date().toISOString() })
      .where(eq(authAccounts.firebaseUid, identity.firebaseUid));
    return apiJson({ loginCodeEnabled });
  } catch (error) {
    return apiError(error);
  }
}
