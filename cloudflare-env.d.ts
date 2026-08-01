declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    UPLOADS: R2Bucket;
    FIREBASE_API_KEY: string;
    FIREBASE_AUTH_DOMAIN: string;
    FIREBASE_PROJECT_ID: string;
    FIREBASE_APP_ID: string;
    KUZENS_AUTH_SECRET: string;
    KUZENS_EMAIL_FROM: string;
    KUZENS_EMAIL_REPLY_TO: string;
    RESEND_API_KEY: string;
  }
}
