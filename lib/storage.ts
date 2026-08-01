import { env } from "cloudflare:workers";

type StoredObject = {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
};

type UploadBucket = {
  get(key: string): Promise<StoredObject | null>;
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView,
    options?: {
      httpMetadata?: { contentType?: string; cacheControl?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
  delete(key: string): Promise<void>;
};

export function getUploads() {
  const bucket = (env as unknown as { UPLOADS?: UploadBucket }).UPLOADS;
  if (!bucket) {
    throw new Error(
      "Cloudflare R2 binding `UPLOADS` is unavailable. Set the `r2` field in .openai/hosting.json to `UPLOADS`.",
    );
  }
  return bucket;
}

