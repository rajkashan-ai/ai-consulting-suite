"use client";

import { useState } from "react";
import { deletePost } from "./send-actions";

/**
 * Throw one post away.
 *
 * Two presses, not a dialog. The first turns the word into a question and the
 * second does it, which costs nothing to change your mind about and does not
 * put a box over the screen. A single press would be one stray tap away from
 * losing a post they liked, and a confirm box for something this small reads as
 * more serious than it is.
 *
 * Nothing here is undoable, so the second press says exactly what it does.
 */
export default function DeletePost({ id }: { id: string }) {
  // Every hook together at the top, above anything that reads them.
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const go = async () => {
    if (!asking) {
      setAsking(true);
      return;
    }
    setBusy(true);
    setFailed(null);
    try {
      const { error } = await deletePost(id);
      // On success the row is gone and the page redraws without this button,
      // so there is nothing to put back.
      if (error) {
        setFailed(error);
        setAsking(false);
      }
    } catch (e) {
      /* Kept rather than swallowed: CLAUDE.md 1.4c. */
      console.error(`[made] deleting a post failed: ${String(e)}`);
      setFailed("We could not reach our own server. Try again in a moment.");
      setAsking(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="t-micro">
      <button className="linkish" type="button" onClick={go} disabled={busy}>
        {busy ? "Throwing away" : asking ? "Throw it away?" : "Throw away"}
      </button>
      {asking && !busy ? (
        <>
          {" "}
          <button className="linkish" type="button" onClick={() => setAsking(false)}>
            Keep it
          </button>
        </>
      ) : null}
      {failed ? <> {failed}</> : null}
    </span>
  );
}
