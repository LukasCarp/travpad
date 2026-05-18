import type { MetadataRoute } from "next";

// Web app manifest — lets TravPad be installed / added to the home screen
// and launched standalone (useful for offline use).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TravPad",
    short_name: "TravPad",
    description: "A wiki-style travel map — pin and share places.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4eb",
    theme_color: "#f7f4eb",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
