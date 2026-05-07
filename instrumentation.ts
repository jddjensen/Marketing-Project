// Next.js auto-loads this file at startup for both server and edge runtimes.
// Sentry only initializes when SENTRY_DSN is present, so local dev and
// previews stay quiet until you point them at a real Sentry project.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn,
      tracesSampleRate: 0,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      enabled: process.env.NODE_ENV === "production",
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn,
      tracesSampleRate: 0,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      enabled: process.env.NODE_ENV === "production",
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
