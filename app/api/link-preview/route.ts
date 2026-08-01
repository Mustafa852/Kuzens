import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { linkPreviews } from "@/db/schema";
import { requireProfile } from "@/lib/community";
import {
  ApiError,
  apiError,
  apiJson,
  enforceRateLimit,
  requireIdentity,
} from "@/lib/security";

const CACHE_MS = 24 * 60 * 60_000;
const HTML_LIMIT = 750_000;
const IMAGE_LIMIT = 2_500_000;

type Preview = {
  provider: string;
  siteName: string;
  title: string;
  description: string;
  imageUrl: string | null;
};

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

function safeRemoteUrl(value: string) {
  if (value.length > 2_048) throw new ApiError(400, "Bağlantı çok uzun.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError(400, "Geçerli bir bağlantı gir.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new ApiError(400, "Yalnızca güvenli web bağlantıları desteklenir.");
  }
  if (url.port && !["80", "443"].includes(url.port)) {
    throw new ApiError(400, "Bu bağlantı noktası desteklenmiyor.");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "::1" ||
    host === "::" ||
    host.startsWith("::ffff:") ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80:") ||
    isPrivateIpv4(host)
  ) {
    throw new ApiError(400, "Yerel ağ bağlantıları önizlenemez.");
  }
  url.hash = "";
  return url;
}

async function readLimited(response: Response, limit: number) {
  const announced = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(announced) && announced > limit) {
    throw new ApiError(413, "Uzak içerik önizleme sınırını aşıyor.");
  }
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new ApiError(413, "Uzak içerik önizleme sınırını aşıyor.");
    }
    chunks.push(value);
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

async function safeFetch(target: URL, accept: string) {
  let current = target;
  for (let hop = 0; hop < 4; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6_000);
    try {
      const response = await fetch(current, {
        headers: {
          accept,
          "user-agent": "Kuzens-LinkPreview/1.0",
        },
        redirect: "manual",
        signal: controller.signal,
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) throw new ApiError(502, "Bağlantı yönlendirmesi okunamadı.");
        current = safeRemoteUrl(new URL(location, current).toString());
        continue;
      }
      return response;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new ApiError(502, "Bağlantı çok fazla yönlendirme içeriyor.");
}

function decodeHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([0-9a-f]+);/gi, (_, number) => String.fromCodePoint(Number.parseInt(number, 16)))
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function metaValue(html: string, names: string[]) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const attributes = new Map<string, string>();
    for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/gi)) {
      attributes.set(match[1].toLowerCase(), match[3]);
    }
    const key = (attributes.get("property") || attributes.get("name") || "").toLowerCase();
    if (names.includes(key) && attributes.get("content")) {
      return decodeHtml(attributes.get("content")!).slice(0, 500);
    }
  }
  return "";
}

function absoluteImage(value: string, base: URL) {
  if (!value) return null;
  try {
    return safeRemoteUrl(new URL(value, base).toString()).toString();
  } catch {
    return null;
  }
}

function providerFor(url: URL) {
  const host = url.hostname.toLowerCase();
  if (host === "youtu.be" || host.endsWith(".youtube.com")) return "youtube";
  if (host.endsWith(".steampowered.com") || host.endsWith(".steamcommunity.com")) return "steam";
  if (host.endsWith(".spotify.com")) return "spotify";
  if (host.endsWith(".twitch.tv")) return "twitch";
  if (host.endsWith(".github.com")) return "github";
  return "web";
}

async function steamPreview(url: URL): Promise<Preview | null> {
  const appId = url.pathname.match(/\/app\/(\d+)/)?.[1];
  if (!appId) return null;
  const endpoint = safeRemoteUrl(
    `https://store.steampowered.com/api/appdetails?appids=${appId}&l=turkish&cc=tr`,
  );
  const response = await safeFetch(endpoint, "application/json");
  if (!response.ok) return null;
  const bytes = await readLimited(response, 600_000);
  const payload = JSON.parse(new TextDecoder().decode(bytes)) as Record<
    string,
    { success?: boolean; data?: { name?: string; short_description?: string; header_image?: string } }
  >;
  const data = payload[appId]?.data;
  if (!data?.name) return null;
  return {
    provider: "steam",
    siteName: "STEAM",
    title: decodeHtml(data.name).slice(0, 180),
    description: decodeHtml(data.short_description || "Steam mağazasında görüntüle.").slice(0, 360),
    imageUrl: absoluteImage(data.header_image || "", url),
  };
}

async function youtubePreview(url: URL): Promise<Preview | null> {
  const endpoint = safeRemoteUrl(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(url.toString())}&format=json`,
  );
  const response = await safeFetch(endpoint, "application/json");
  if (!response.ok) return null;
  const bytes = await readLimited(response, 300_000);
  const data = JSON.parse(new TextDecoder().decode(bytes)) as {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
  };
  if (!data.title) return null;
  return {
    provider: "youtube",
    siteName: "YOUTUBE",
    title: decodeHtml(data.title).slice(0, 180),
    description: data.author_name ? `${decodeHtml(data.author_name)} tarafından` : "YouTube videosu",
    imageUrl: absoluteImage(data.thumbnail_url || "", url),
  };
}

async function htmlPreview(url: URL): Promise<Preview> {
  const response = await safeFetch(url, "text/html,application/xhtml+xml");
  if (!response.ok) throw new ApiError(502, "Bağlantı önizlemesi alınamadı.");
  const contentType = response.headers.get("content-type") || "";
  if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
    throw new ApiError(415, "Bu bağlantı önizlenebilir bir web sayfası değil.");
  }
  const html = new TextDecoder().decode(await readLimited(response, HTML_LIMIT));
  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  const provider = providerFor(url);
  return {
    provider,
    siteName:
      metaValue(html, ["og:site_name"]) ||
      (provider === "web" ? url.hostname.replace(/^www\./, "").toUpperCase() : provider.toUpperCase()),
    title:
      metaValue(html, ["og:title", "twitter:title"]) ||
      decodeHtml(titleTag).slice(0, 180) ||
      url.hostname.replace(/^www\./, ""),
    description:
      metaValue(html, ["og:description", "twitter:description", "description"]).slice(0, 360) ||
      `${url.hostname.replace(/^www\./, "")} bağlantısı`,
    imageUrl: absoluteImage(
      metaValue(html, ["og:image:secure_url", "og:image", "twitter:image"]),
      url,
    ),
  };
}

function clientPreview(url: string, preview: Preview) {
  return {
    url,
    ...preview,
    imageUrl: preview.imageUrl
      ? `/api/link-preview?image=${encodeURIComponent(preview.imageUrl)}`
      : null,
  };
}

export async function GET(request: Request) {
  try {
    const identity = requireIdentity(request);
    await requireProfile(identity);
    const requestUrl = new URL(request.url);
    const image = requestUrl.searchParams.get("image");
    const db = getDb();

    if (image) {
      await enforceRateLimit(request, "link-image", identity.email, 360, 15 * 60_000);
      const imageUrl = safeRemoteUrl(image).toString();
      const [known] = await db
        .select({ id: linkPreviews.id })
        .from(linkPreviews)
        .where(eq(linkPreviews.imageUrl, imageUrl))
        .limit(1);
      if (!known) throw new ApiError(403, "Bu önizleme görseline izin verilmiyor.");
      const response = await safeFetch(safeRemoteUrl(imageUrl), "image/avif,image/webp,image/png,image/jpeg,image/gif");
      const contentType = (response.headers.get("content-type") || "").split(";")[0].toLowerCase();
      if (!response.ok || !["image/avif", "image/webp", "image/png", "image/jpeg", "image/gif"].includes(contentType)) {
        throw new ApiError(415, "Önizleme görseli desteklenmiyor.");
      }
      const bytes = await readLimited(response, IMAGE_LIMIT);
      return new Response(bytes, {
        headers: {
          "cache-control": "private, max-age=86400",
          "content-type": contentType,
          "content-security-policy": "default-src 'none'",
          "x-content-type-options": "nosniff",
        },
      });
    }

    await enforceRateLimit(request, "link-preview", identity.email, 240, 15 * 60_000);
    const target = safeRemoteUrl(requestUrl.searchParams.get("url") || "");
    const canonicalUrl = target.toString();
    const [cached] = await db
      .select()
      .from(linkPreviews)
      .where(eq(linkPreviews.url, canonicalUrl))
      .limit(1);
    if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_MS) {
      return apiJson(clientPreview(canonicalUrl, cached));
    }

    const provider = providerFor(target);
    let preview: Preview | null = null;
    try {
      if (provider === "steam") preview = await steamPreview(target);
      if (provider === "youtube") preview = await youtubePreview(target);
      if (!preview) preview = await htmlPreview(target);
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) throw error;
      preview = {
        provider,
        siteName: provider === "web" ? target.hostname.replace(/^www\./, "").toUpperCase() : provider.toUpperCase(),
        title: target.hostname.replace(/^www\./, ""),
        description: "Bağlantıyı yeni sekmede aç.",
        imageUrl: null,
      };
    }
    const id = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalUrl))),
    )
      .slice(0, 16)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const fetchedAt = new Date().toISOString();
    await db
      .insert(linkPreviews)
      .values({ id, url: canonicalUrl, ...preview, fetchedAt })
      .onConflictDoUpdate({
        target: linkPreviews.url,
        set: { ...preview, fetchedAt },
      });
    return apiJson(clientPreview(canonicalUrl, preview));
  } catch (error) {
    return apiError(error);
  }
}
