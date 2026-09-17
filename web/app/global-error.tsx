"use client";

import { useEffect } from "react";

/**
 * The root layout itself threw, so `app/error.tsx` cannot render.
 *
 * Next.js requires this file to define its own html and body tags, because it
 * replaces the root layout rather than sitting inside it. That also means the
 * stylesheet the rest of the app relies on may not be there, so the few styles
 * this needs are inline. It is the one place in the suite where that is right.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    void fetch("/api/problem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        where: window.location.pathname,
        kind: "render",
        severity: "stopped",
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="en-GB">
      <body style={{ margin: 0, padding: "48px 24px", background: "#f9f7f4", color: "#1b2635" }}>
        <main style={{ maxWidth: "36rem", margin: "0 auto" }}>
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>That did not load.</h1>
          <p style={{ lineHeight: 1.6 }}>
            Something went wrong at our end, not yours. We have a record of it.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: "1rem", padding: "0.5rem 1rem", borderRadius: "999px",
              border: "1px solid #d9d4cc", background: "#fff", cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
