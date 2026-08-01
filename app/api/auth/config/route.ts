import { env } from "cloudflare:workers";
import { apiJson } from "@/lib/security";

export async function GET() {
  const config = {
    apiKey: env.FIREBASE_API_KEY?.trim() || "",
    authDomain: env.FIREBASE_AUTH_DOMAIN?.trim() || "",
    projectId: env.FIREBASE_PROJECT_ID?.trim() || "",
    appId: env.FIREBASE_APP_ID?.trim() || "",
  };
  return apiJson({
    configured: Object.values(config).every(Boolean),
    config,
  });
}

