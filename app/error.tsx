"use client";

import { useEffect } from "react";

/**
 * A render that threw, in any tool or page under app/.
 *
 * Next.js documents this as the way uncaught exceptions are handled, and its
 * own example logs the error from a `useEffect`. Before this existed a crash
 * had nowhere to go: on 2026-09-16 one reached a customer's screen and the only
 * record of it anywhere was a screenshot.
 *
 * It is worse than a broken page. A tool screen's progress panel is what drives
 * a run, one step per request, so a crash here stops the run, and reloading
 * starts a new one from zero.
 *
 * The docs warn the error instance may not be the original one thrown, because
 * React may have processed it. That is what `digest` is for, and why it is sent.
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Fire and forget. A failure to report must never replace the error the
    // customer is already looking at. ERROR-HANDLING.md rule 1, fourth case.
    void fetch("/api/problem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        where: window.location.pathname,
        kind: "render",
        workspaceId: new URLSearchParams(window.location.search).get("w"),
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="band band--a band--first band--last">
      <div className="band__in">
        <div className="panel">
          {/* Their words, not ours. No stage, no digest, no stack: none of it
              is something an owner can act on, and CLAUDE.md 1.4 says a
              customer never reads our machinery. */}
          <h2 className="t-sub">That did not load.</h2>
          <p className="t-doc">
            Something went wrong at our end, not yours. We have a record of it.
            Try again, and if it keeps happening tell us.
          </p>
          <button className="btn--sm btn--ghost" type="button" onClick={() => retry()}>
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
