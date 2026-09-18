"use client";

import { useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { makePost } from "./make-actions";
import {
  CONVERTS,
  INTENTS,
  START,
  THOUGHT_MAX,
  next,
  readyToAsk,
  showsIntents,
  showsPhotoBox,
} from "@/tools/content-social-planner/paths";
import { QUALITY, SENT_AS, TAKES, drawAt } from "@/tools/content-social-planner/photo";

/**
 * Three ways to ask for a post.
 *
 * Raj, 2026-09-17: the three moments a small business operator actually reaches
 * for this are a blank screen with no ideas, a thing that has just happened,
 * and a photo already on their phone. The month plan below stays and prompts
 * the first of those; this is the asking.
 *
 * Starting from a photo was on the selector and disabled until 2026-09-18.
 * It is built now, and it is built without a bucket: the photo is downscaled
 * here, in their browser, carried inside the one call that writes the post, and
 * never stored. Nothing about it reaches a database except that there was one.
 *
 * `services` comes off their own site. A list we typed would contain work they
 * do not sell, and a post about work they do not sell is worse than no post.
 */
export default function Make({
  workspaceId,
  services,
}: {
  workspaceId: string;
  services: string[];
}) {
  // Every hook together at the top. A hook below a closure that uses it works
  // and reads as a mistake, and a hook below a return crashed a live run.
  const router = useRouter();
  const [state, act] = useReducer(next, START);
  const [busy, setBusy] = useState(false);

  const { path, intent, thought, photo, service, error } = state;
  const ready = readyToAsk(state);

  /**
   * Downscaled here, on their machine, before anything is sent.
   *
   * The same reasoning as the resizer four sections down: a photo that never
   * leaves the browser at full size is a photo we cannot mishandle. What goes
   * out is a JPEG no wider than LONG_EDGE, which is what the writer needs to
   * tell a balayage from a blunt fringe and no more than that.
   */
  const choose = async (file: File | undefined) => {
    if (!file) return;
    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await img.decode();

      const { width, height } = drawAt(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(img.src);

      act({ did: "pick-photo", photo: canvas.toDataURL(SENT_AS, QUALITY) });
    } catch (e) {
      /* Their file, not our server. Kept rather than swallowed: CLAUDE.md 1.4c. */
      console.error(`[make] could not read that photo: ${String(e)}`);
      act({ did: "refused", error: "We could not read that photo. Try another one." });
    }
  };

  const ask = async () => {
    setBusy(true);
    try {
      const { error: refused } = await makePost(
        workspaceId,
        path,
        path === "category" ? intent : null,
        path === "thought" ? thought : null,
        path === "asset" ? photo : null,
        path === "asset" ? service : null,
      );
      if (refused) {
        act({ did: "refused", error: refused });
        return;
      }
      act({ did: "written" });
      // Reload so the new post is drawn by the same code that draws every
      // other one. One path, not two.
      router.refresh();
    } catch (e) {
      /* The network, or our own server. Theirs to try again, ours to keep the
         reason. No error is discarded: CLAUDE.md 1.4c. */
      console.error(`[make] asking for a post failed: ${String(e)}`);
      act({ did: "refused", error: "We could not reach our own server. Try again in a moment." });
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
          onClick={() => act({ did: "pick-path", path: "category" })}
        >
          No ideas
        </button>
        <button
          className="tab"
          role="tab"
          aria-selected={path === "thought"}
          disabled={busy}
          onClick={() => act({ did: "pick-path", path: "thought" })}
        >
          Something happened
        </button>
        <button
          className="tab"
          role="tab"
          aria-selected={path === "asset"}
          disabled={busy}
          onClick={() => act({ did: "pick-path", path: "asset" })}
        >
          From a photo
        </button>
      </div>

      {showsIntents(state) ? (
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
                onClick={() => act({ did: "pick-intent", intent: i.id })}
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
      ) : showsPhotoBox(state) ? (
        <div className="make">
          <label className="t-meta" htmlFor="photo">
            A photo of the work. It stays on your machine.
          </label>
          <input
            id="photo"
            className="field"
            type="file"
            accept={TAKES.join(",")}
            disabled={busy}
            onChange={(e) => choose(e.target.files?.[0])}
          />

          {/* Shown back so they know which one they picked, drawn from the same
              downscaled copy that goes to the writer rather than a second read
              of the file. What they see is what it sees. */}
          {/* A plain img, not next/image. There is nothing to optimise: this
              is a data url held in memory on their own machine, and next/image
              would try to fetch and cache something that has no url. */}
          {photo ? <img className="make__shot" src={photo} alt="The photo you chose" /> : null}

          <p className="t-micro">
            Your photo never leaves your computer. It is made smaller here, used
            to write the post, and not kept.
          </p>

          <label className="t-meta" htmlFor="service">
            Which of your services is this?
          </label>
          {services.length ? (
            <div className="controls">
              {services.map((name) => (
                <button
                  key={name}
                  className="toggle"
                  type="button"
                  aria-pressed={service === name}
                  disabled={busy}
                  onClick={() => act({ did: "pick-service", service: name })}
                >
                  {name}
                </button>
              ))}
            </div>
          ) : (
            <p className="t-micro">
              We could not find a list of your services on your site, so there is
              nothing to price this against yet.
            </p>
          )}
          <p className="t-micro">
            The photo says what it looks like. This is how we get the price and
            the booking line right, off your own page.
          </p>
        </div>
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
            onChange={(e) => act({ did: "type", thought: e.target.value })}
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
