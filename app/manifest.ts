import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kuzens",
    short_name: "Kuzens",
    description: "Arkadaşlarınla konuş, paylaş ve birlikte kal.",
    start_url: "/",
    display: "standalone",
    background_color: "#090a0f",
    theme_color: "#8b73ff",
    orientation: "any",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
