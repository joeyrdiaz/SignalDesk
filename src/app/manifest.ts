import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SignalDesk",
    short_name: "SignalDesk",
    description:
      "Intelligence aggregator + full-text reader for Markets, Equity, Data Science, and AI/ML.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#050608",
    theme_color: "#050608",
    categories: ["news", "finance", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
