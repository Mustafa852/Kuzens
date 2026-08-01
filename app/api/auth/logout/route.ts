import { destroySession } from "@/lib/auth-session";
import { getRequestIdentity } from "@/lib/identity";
import {
  apiError,
  apiJson,
  assertTrustedMutation,
  enforceRateLimit,
} from "@/lib/security";

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await getRequestIdentity(request);
    await enforceRateLimit(
      request,
      "auth-logout",
      identity?.email || "anonymous",
      20,
      15 * 60_000,
    );
    return apiJson(
      { authenticated: false },
      { headers: { "set-cookie": await destroySession(request) } },
    );
  } catch (error) {
    return apiError(error);
  }
}
