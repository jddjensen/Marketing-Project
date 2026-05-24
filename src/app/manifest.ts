import type { MetadataRoute } from "next";

/**
 * Web app manifest — installable PWA basics. The app is an internal tool
 * (root layout sets robots: noindex), but the manifest still pays off when
 * someone adds it to their Home Screen or pins it on Windows.
 *
 * theme_color is intentionally kept neutral; the in-app theme picker
 * overrides UI colors per-user but can't influence the OS shell once the
 * app is installed, so we ship a sensible default.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Marketing Platform",
    short_name: "Marketing",
    description:
      "Plan campaigns, organize creative across every channel, and track performance.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    orientation: "portrait-primary",
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
