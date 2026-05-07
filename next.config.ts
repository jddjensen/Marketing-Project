import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const securityHeaders = [
  // Prevent the browser from sniffing a response's content-type — defense in
  // depth even though the upload route now magic-byte-sniffs before storing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Disallow framing the app to mitigate clickjacking on internal flows.
  { key: "X-Frame-Options", value: "DENY" },
  // Don't leak full URLs (with UTM/query params) to third-party origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Lock down powerful APIs that this app doesn't use.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
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
