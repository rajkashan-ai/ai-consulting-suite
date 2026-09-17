"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { makePost } from "./make-actions";
import {
  CONVERTS,
  INTENTS,
  THOUGHT_MAX,
  THOUGHT_MIN,
  type Intent,
  type Path,
} from "@/tools/content-social-planner/paths";

/**
 * Three ways to ask for a post.
 *
 * Raj, 2026-09-17: the three moments a small business operator actually reaches
 * for this are a blank screen with no ideas, a thing that has just happened,
 * and a photo already on their phone. The month plan below stays and prompts
 * the first of those; this is the asking.
 *
 * Starting from a photo is on the selector and disabled. Nothing in this
 * product uploads a file, and a button that looks ready and is not is worse
 * than one that says so.
 */
export default function Make({ workspaceId }: { workspaceId: string }) {
  // Every hook together at the top. A hook below a closure that uses it works
  // and reads as a mistake, and a hook below a return crashed a live run.
  const router = useRouter();
  const [path, setPath] = useState<Path>("category");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [thought, setThought] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready =
    path === "category" ? intent !== null : thought.trim().length >= THOUGHT_MIN;

  const ask = async () => {
    setBusy(true);
    setError(null);
    try {
      const { error: refused } = await makePost(
        workspaceId,
        path,
        path === "category" ? intent : null,
        path === "thought" ? thought : null,
      );
      if (refused) {
        setError(refused);
        return;
      }
      setThought("");
      setIntent(null);
      // Reload so the new post is drawn by the same code that draws every
      // other one. One path, not two.
      router.refresh();
    } catch (e) {
      /* The network, or our own server. Theirs to try again, ours to keep the
         reason. No error is discarded: CLAUDE.md 1.4c. */
      console.error(`[make] asking for a post failed: ${String(e)}`);
      setError("We could not reach our own server. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h2 className="t-sub">Make a post</h2>
      <p className="t-doc u-measure">
        For when something has just happened, or when you have half an hour and
        no idea what to say.
      </p>

      <div className="tabs" role="tablist" aria-label="How to start">
        <button
          className="tab"
          role="tab"
          aria-selected={path === "category"}
          disabled={busy}
          onClick={() => { setPath("category"); setError(null); }}
        >
          No ideas
        </button>
        <button
          className="tab"
          role="tab"
          aria-selected={path === "thought"}
          disabled={busy}
          onClick={() => { setPath("thought"); setError(null); }}
        >
          Something happened
        </button>
        {/* Offered and honest about not being ready. See NOT_BUILT. */}
        <button className="tab" role="tab" aria-selected={false} disabled>
          From a photo <span className="tag tag--na">Not yet</span>
        </button>
      </div>

      {path === "category" ? (
        <>
          <p className="t-meta u-measure">
            Pick what the post is for. Five of these build trust and ask for
            nothing; three ask for the business. Most weeks lean on the first
            five.
          </p>
          <div className="intents">
            {INTENTS.map((i) => (
              <button
                key={i.id}
                className="intent"
                aria-pressed={intent === i.id}
                disabled={busy}
                onClick={() => { setIntent(i.id); setError(null); }}
              >
                <span className="intent__kind">
                  {CONVERTS.has(i.id) ? "Asks for the business" : "Builds trust"}
                </span>
                <span className="intent__name">{i.label}</span>
                <span className="intent__asks">{i.asks}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="make">
          <label className="t-meta" htmlFor="thought">
            What happened? A half sentence is plenty.
          </label>
          <textarea
            id="thought"
            className="field field--area"
            rows={3}
            maxLength={THOUGHT_MAX}
            value={thought}
            disabled={busy}
            placeholder="Bride in at 6am, had her in the chair before the shop opened"
            onChange={(e) => { setThought(e.target.value); setError(null); }}
          />
          <p className="t-micro">
            Your words, not ours. We give it a shape and keep what you said true.
          </p>
        </div>
      )}

      {error ? <p className="t-doc">{error}</p> : null}

      <div className="make__row">
        <button className="btn" onClick={ask} disabled={busy || !ready}>
          {busy ? "Writing" : "Write it"}
        </button>
        <span className="t-meta">
          {busy ? "About twenty seconds." : "One post, ready to paste."}
        </span>
      </div>
    </div>
  );
}
