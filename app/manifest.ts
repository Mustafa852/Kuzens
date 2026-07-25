import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kuzens",
    short_name: "Kuzens",
    description: "Arkadaşlarınla konuş, paylaş ve birlikte kal.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0b12",
    theme_color: "#15121b",
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
