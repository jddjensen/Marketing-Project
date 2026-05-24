"use client";

// global-error renders when the root layout itself throws. It replaces the
// layout entirely, so it must define its own <html>/<body>. Keep it minimal:
// no fonts, no providers, no global CSS — anything that throws inside this
// component takes the whole app down with no fallback.

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          margin: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          background: "#0a0a0a",
          color: "#ededed",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
            The app crashed
          </h1>
          <p style={{ marginTop: "0.75rem", color: "#a1a1aa" }}>
            Something went wrong outside of any page. Reload the page to try
            again.
          </p>
          {error.digest ? (
            <p
              style={{
                marginTop: "1rem",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: "0.75rem",
                color: "#a1a1aa",
              }}
            >
              ref: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              marginTop: "1.5rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              borderRadius: "0.5rem",
              border: "none",
              cursor: "pointer",
              background: "#ededed",
              color: "#0a0a0a",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
