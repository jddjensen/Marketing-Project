import type { NextConfig } from "next";

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

export default nextConfig;
