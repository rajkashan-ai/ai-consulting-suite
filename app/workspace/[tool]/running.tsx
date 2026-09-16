"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Progress = {
  stage: string;
  progress: string;
  documentId: string | null;
  reason: string | null;
};

/**
 * Watches a run and keeps it moving.
 *
 * Two jobs at once, and they are the same call. Asking "how is it going" also
 * advances it by one step, so an open page makes the run fast. Close the page
 * and the scheduled tick takes over at its own pace, which is what makes
 * walking away safe.
 *
 * It never shows a percentage. We do not know what fraction of the work is
 * left, and a made-up percentage is a lie that people sit and watch.
 */
export default function Running({
  runId,
  startedAt,
}: {
  runId: string;
  startedAt: string;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState("Starting");
  const [failed, setFailed] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;

    (async () => {
      // A step at a time, back to back. Each returns when its step is done, so
      // there is no interval to tune and no two requests in flight at once.
      while (alive.current) {
        let answer: Progress;
        try {
          const res = await fetch(`/api/runs/${runId}/step`, { method: "POST" });
          answer = await res.json();
        } catch {
          // Lost the network. Wait and ask again rather than giving up: the run
          // itself is on the server and is not affected by this browser.
          await new Promise((r) => setTimeout(r, 4000));
          continue;
        }

        if (!alive.current) return;

        if (answer.stage === "done") {
          // Reload from the server so the finished thing is rendered by the
          // same code that renders it on every later visit. One path, not two.
          router.refresh();
          return;
        }
        if (answer.stage === "failed") {
          setFailed(answer.reason ?? answer.progress ?? "It did not work.");
          return;
        }

        setProgress(answer.progress || "Working");
        // A breath between steps. Without it a leased run spins as fast as the
        // network allows, asking a question whose answer cannot have changed.
        await new Promise((r) => setTimeout(r, 1500));
      }
    })();

    return () => {
      alive.current = false;
    };
  }, [runId, router]);

  if (failed) {
    return (
      <div className="panel">
        <h2 className="t-sub">It stopped.</h2>
        <p className="t-doc">{failed}</p>
        <p className="t-meta">
          Nothing was saved. Your business details are on Your business if
          something there needs correcting.
        </p>
      </div>
    );
  }

  /**
   * The clock is read on the client only, and never during the first render.
   *
   * Reading Date.now() while rendering means the server writes one second into
   * the HTML and the client writes the next one a moment later, and React
   * refuses the mismatch: "Running for 1 min 57 sec" against "1 min 58 sec".
   * It is the textbook hydration fault and I walked straight into it.
   *
   * Null until mounted, which also gives the first screen the right default:
   * a run nobody has timed yet is a run that has just started.
   */
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const since = now === null ? 0 : Math.round((now - new Date(startedAt).getTime()) / 1000);

  /**
   * Two different questions, asked at two different moments.
   *
   * At the start the reader is deciding whether to wait, and wants to know how
   * long and whether it is worth it. Once it is running they have stopped
   * caring about that and want to know it is still alive.
   *
   * What was here said "About a minute to go" for the first ninety seconds of
   * a run that takes about three, then "Nearly there" for the rest. Both were
   * hardcoded and neither was true. UI/CLAUDE.md section 7 rule 7: a status
   * claim about our own work is the easiest false statement in the product to
   * write, because nobody can check it. Nothing below is a prediction.
   */
  const elapsed =
    since < 60
      ? `Running for ${since} seconds`
      : `Running for ${Math.floor(since / 60)} min ${since % 60} sec`;

  return (
    <>
      {since < 12 ? (
        <div className="working">
          <span className="working__dot" aria-hidden="true" />
          <strong className="t-row">Looking for who you are up against</strong>
          <span className="t-meta">Usually about three minutes</span>
          <p className="working__note t-meta">
            We find up to five competitors and read what each of them publishes
            about prices, booking, reviews and opening. Every figure comes off a
            page we have read, so none of it is guesswork. Close this if you
            like and come back: it keeps going without you.
          </p>
        </div>
      ) : (
        <div className="working">
          <span className="working__dot" aria-hidden="true" />
          <strong className="t-row">{progress}</strong>
          {now !== null && <span className="t-meta">{elapsed}</span>}
          <p className="working__note t-meta">
            You can close this. It keeps going and it will be here when you come
            back. We read one page at a time with a pause between, so we are
            never a burden on a small business&rsquo;s website.
          </p>
        </div>
      )}

      {/* Bars at the real shape of what is coming. Not a spinner: a spinner
          says something is happening, this says what is going to be there. */}
      <div aria-hidden="true">
        <span className="sk sk--title" />
        <span className="sk sk--wide" />
        <span className="sk sk--mid" />
        <span className="sk sk--row sk--wide" />
        <span className="sk sk--row sk--wide" />
        <span className="sk sk--row sk--wide" />
        <span className="sk sk--row sk--wide" />
        <span className="sk sk--short" />
      </div>
      <p className="t-meta">
        <span className="hide">Loading the battlecard.</span>
      </p>
    </>
  );
}
