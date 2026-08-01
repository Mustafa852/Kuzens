import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kuzens",
    short_name: "Kuzens",
    description: "Arkadaşlarınla konuş, paylaş ve birlikte kal.",
    lang: "tr",
    dir: "ltr",
    categories: ["social", "communication"],
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#090a0f",
    theme_color: "#8b73ff",
    orientation: "any",
    prefer_related_applications: false,
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    shortcuts: [
      { name: "Kuzens'i aç", short_name: "Aç", url: "/" },
    ],
  };
}
