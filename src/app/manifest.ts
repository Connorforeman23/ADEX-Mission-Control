import type { MetadataRoute } from "next";
import { IS_PRODUCTION } from "@/lib/env";

/**
 * What makes Mission Control installable as an app.
 *
 * It is the same website either way — installing gives it its own window and
 * icon rather than a browser tab, on Windows, Mac, iPhone and Android. There
 * is nothing to download and nothing to keep updated: the installed app is
 * always whatever the site is.
 *
 * The dev deployment declares itself separately, so a tester can have both
 * installed without one replacing the other or the icons being confused.
 */
export default function manifest(): MetadataRoute.Manifest {
  const dev = !IS_PRODUCTION;
  return {
    name: dev ? "ADEX Mission Control (DEV)" : "ADEX Mission Control",
    short_name: dev ? "ADEX DEV" : "ADEX",
    description: "Advertising Excellence — agency operations",
    id: dev ? "/?app=dev" : "/?app=live",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f4f6fc",
    // The brand blue, used for the title bar and the splash screen.
    theme_color: dev ? "#b45309" : "#2e6bff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops icons to the launcher's shape, so these keep the logo
      // well inside a safe area.
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Tasks", url: "/tasks" },
      { name: "Campaigns", url: "/campaigns" },
      { name: "Organisations", url: "/organisations" },
    ],
  };
}
