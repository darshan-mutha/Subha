import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shubā – Plan any celebration in minutes",
    short_name: "Shubā",
    description: "AI celebration planner: budget, timeline, vendors, ideas and auspicious timings.",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F4EC",
    theme_color: "#0E5A63",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
