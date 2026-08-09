import type { MetadataRoute } from "next";

/**
 * Web app manifest.
 *
 * `display: "standalone"` plus a 192px and a 512px icon are what make Chrome
 * offer "Install app" on Windows; the maskable variant is what stops Android
 * cropping the mark badly.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pioneers-EGY — Integrated Engineering Services",
    short_name: "Pioneers-EGY",
    description:
      "Record inspection jobs on site and manage the certificate register for Pioneers-EGY.",
    id: "/dashboard",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#7a1f23",
    categories: ["business", "productivity", "utilities"],
    lang: "en",
    dir: "ltr",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "New inspection job",
        short_name: "New job",
        url: "/dashboard/jobs/new",
      },
      {
        name: "Certification",
        short_name: "Certificates",
        url: "/dashboard/certificates",
      },
    ],
  };
}
