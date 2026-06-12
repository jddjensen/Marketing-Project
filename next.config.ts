import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const isProd = process.env.NODE_ENV === "production";

// Derive the Supabase origin so CSP doesn't need to wildcard the whole
// supabase.co space. Falls back to wildcard hosts if the env var isn't set
// (e.g. lint/typecheck builds). The browser client and signed-URL uploads
// both hit this origin, so connect-src + img-src + media-src must allow it.
function supabaseOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

const supabaseHost = supabaseOrigin();
const supabaseConnect = supabaseHost
  ? [supabaseHost, supabaseHost.replace(/^https:\/\//, "wss://")]
  : ["https://*.supabase.co", "wss://*.supabase.co"];

// Sentry browser SDK posts to its ingest endpoint. We list both the global
// and the US region; if the project is on a different region the matching
// wildcard host below picks it up.
const sentryConnect = [
  "https://*.ingest.sentry.io",
  "https://*.ingest.us.sentry.io",
  "https://*.ingest.de.sentry.io",
];

// CSP notes:
// - 'unsafe-inline' on script-src is required for the appearance bootstrap
//   script in src/app/layout.tsx and for Next.js's hydration inline scripts.
//   We pair it with strict source allow-lists for everything else.
// - In dev, Next/Turbopack uses eval and websockets to the dev server, so we
//   relax script-src + connect-src there only.
// - frame-ancestors 'none' is the modern equivalent of X-Frame-Options DENY.
// - object-src 'none' blocks legacy plugin embeds.
const cspDirectives: Array<[string, string[]]> = [
  ["default-src", ["'self'"]],
  [
    "script-src",
    ["'self'", "'unsafe-inline'", ...(isProd ? [] : ["'unsafe-eval'"])],
  ],
  ["style-src", ["'self'", "'unsafe-inline'"]],
  // Uploaded creative thumbnails / Supabase signed URLs / inline data URIs
  // (QR codes) all flow through <img>. blob: covers preview generators.
  // Scheme-agnostic http(s) filter so local Supabase (http://127.0.0.1:54321)
  // renders in dev — an https-only filter silently dropped it, blocking every
  // signed-URL image locally. Production origins are https and unaffected.
  [
    "img-src",
    [
      "'self'",
      "data:",
      "blob:",
      ...supabaseConnect.filter((s) => /^https?:\/\//.test(s)),
    ],
  ],
  [
    "media-src",
    [
      "'self'",
      "blob:",
      ...supabaseConnect.filter((s) => /^https?:\/\//.test(s)),
    ],
  ],
  ["font-src", ["'self'", "data:"]],
  [
    "connect-src",
    [
      "'self'",
      ...supabaseConnect,
      ...sentryConnect,
      ...(isProd ? [] : ["ws:", "wss:"]),
    ],
  ],
  ["worker-src", ["'self'", "blob:"]],
  ["frame-ancestors", ["'none'"]],
  ["form-action", ["'self'"]],
  ["base-uri", ["'self'"]],
  ["object-src", ["'none'"]],
  ...(isProd ? [["upgrade-insecure-requests", []] as [string, string[]]] : []),
];

const csp = cspDirectives
  .map(([directive, sources]) =>
    sources.length === 0 ? directive : `${directive} ${sources.join(" ")}`
  )
  .join("; ");

const baseSecurityHeaders = [
  // Force HTTPS for a year on this host and any subdomains.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Content-Security-Policy", value: csp },
  // Prevent the browser from sniffing a response's content-type — defense in
  // depth even though the upload route now magic-byte-sniffs before storing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Disallow framing the app to mitigate clickjacking on internal flows.
  // Modern browsers use frame-ancestors from CSP; X-Frame-Options is the
  // belt-and-suspenders for older clients.
  { key: "X-Frame-Options", value: "DENY" },
  // Don't leak full URLs (with UTM/query params) to third-party origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Lock down powerful APIs that this app doesn't use.
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()",
  },
  // Isolate this app from being grouped with other origins for side-channel
  // attacks (Spectre family). Same-origin scoping is fine because we don't
  // embed third-party documents.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
  // Don't advertise the framework version in response headers.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: baseSecurityHeaders,
      },
    ];
  },
};

// Sentry's wrapper is a no-op for error capture when SENTRY_DSN isn't set.
// Source map upload only runs when SENTRY_AUTH_TOKEN is provided, so local
// dev / unconfigured deploys stay quiet.
export default withSentryConfig(nextConfig, {
  silent: !process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Keep tunneling off until you intentionally enable it (avoids ad-block
  // false positives by routing /monitoring through your own origin).
  tunnelRoute: undefined,
});
