"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { report } from "../../report";
import { interactionId } from "../../interaction";

/**
 * Consecutive failures to reach our own server before we stop and say so.
 *
 * Three, at four seconds apart, is twelve seconds. Long enough that a dropped
 * connection reconnecting is not reported as a fault, short enough that nobody
 * watches a spinner while nothing is happening.
 */
const GIVE_UP_AFTER = 3;

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
/**
 * What to say for the first twelve seconds, before the run has said anything.
 *
 * It used to be one paragraph about finding five competitors and reading their
 * prices, shown whatever was running. The Content Planner reads the owner's own
 * site and researches nobody, so its first screen told them we were looking at
 * their rivals. Same defect as the engine naming a tool and the page naming a
 * tool: a shared thing that knows one tool's work.
 *
 * After twelve seconds this is replaced by the run's own progress, which was
 * always the tool's own words.
 */
export type Opening = { doing: string; takes: string; note: string };

export default function Running({
  runId,
  startedAt,
  opening,
}: {
  runId: string;
  startedAt: string;
  opening: Opening;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState("Starting");
  const [failed, setFailed] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;

    (async () => {
      /**
       * How many times in a row asking for the next step has failed.
       *
       * A wobbly connection recovers in one or two. A step endpoint that is
       * broken never does, and this loop used to retry it silently for as long
       * as the tab stayed open: nothing recorded, nothing on the screen but
       * "Running", which is exactly what somebody watched for sixteen minutes
       * on 2026-09-16.
       *
       * OWASP lists network connection failures as a thing to log. This is that.
       */
      let refused = 0;
      const workspaceId = new URLSearchParams(window.location.search).get("w");

      // A step at a time, back to back. Each returns when its step is done, so
      // there is no interval to tune and no two requests in flight at once.
      while (alive.current) {
        let answer: Progress;
        try {
          const res = await fetch(`/api/runs/${runId}/step`, {
            method: "POST",
            // So a refusal recorded on the server can be read beside whatever
            // this browser reported from the same visit.
            headers: { "x-interaction": interactionId() ?? "" },
          });
          answer = await res.json();
          refused = 0;
        } catch (e) {
          refused += 1;

          /**
           * Once is weather. Three times in a row is a fault, and it is ours
           * until proven otherwise.
           *
           * Recorded once per run rather than on every retry, so a laptop that
           * sleeps for an hour does not fill the table with one fault.
           */
          if (refused === GIVE_UP_AFTER) {
            report(e, "asking for the next step", workspaceId, "stopped");
            setFailed(
              "We cannot reach our own server, so this has stopped. " +
                "Your run is safe and will carry on. Come back in a few minutes.",
            );
            return;
          }

          // Still plausibly the network. Wait and ask again: the run itself is
          // on the server and is not affected by this browser.
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

  /**
   * Every hook above this line, and nothing below it.
   *
   * These two used to sit after the `if (failed)` return. A normal render ran
   * seven hooks and a failed one returned after five, so the moment a run
   * failed React threw "Rendered fewer hooks than expected" onto the customer's
   * screen. It happened on a real run on 2026-09-17 and took down the loop that
   * drives the run with it.
   *
   * I looked at this file, read the comment above explaining why the clock is
   * where it is, and did not notice it was after a return. The error message
   * names the cause in its own second sentence.
   */
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
          <strong className="t-row">{opening.doing}</strong>
          <span className="t-meta">{opening.takes}</span>
          <p className="working__note t-meta">{opening.note}</p>
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
        <span className="hide">Loading.</span>
      </p>
    </>
  );
}
