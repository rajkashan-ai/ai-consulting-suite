"use client";

import { useState } from "react";
import { markPosted, saveEdit } from "./planner-actions";

/**
 * What the owner can do to one post.
 *
 * Three things, and each writes something. The mockup had all three and the
 * first build of this screen had none of them: the screen was rebuilt as a
 * document and every control was left behind, which is how nineteen buttons
 * became zero without anything failing.
 */

export type PostState = { editedWords?: string | null; postedAt?: string | null; postedUrl?: string | null };

export default function PostControls({
  workspaceId,
  postDate,
  channel,
  words,
  state,
}: {
  workspaceId: string;
  postDate: string;
  channel: string;
  words: string;
  state: PostState;
}) {
  const [editing, setEditing] = useState(false);

  if (state.postedAt) {
    return (
      <p className="t-meta">
        <span className="tag tag--did">Posted</span>{" "}
        {state.postedUrl ? (
          <a className="linkish" href={state.postedUrl} target="_blank" rel="noopener noreferrer">
            see it
          </a>
        ) : (
          "You told us this one went out."
        )}
      </p>
    );
  }

  return (
    <div className="card__foot">
      {editing ? (
        /* Their words go in a form of their own, so pressing Posted while
           halfway through an edit cannot submit the edit by accident. */
        <form action={saveEdit} className="fb__grid">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="postDate" value={postDate} />
          <input type="hidden" name="channel" value={channel} />
          <textarea className="field field--text" name="words" defaultValue={state.editedWords ?? words} rows={8} />
          <button className="btn" type="submit">
            Keep my words
          </button>
          <button className="btn--ghost" type="button" onClick={() => setEditing(false)}>
            Leave it
          </button>
        </form>
      ) : (
        <>
          <button className="btn--ghost btn--sm" type="button" onClick={() => setEditing(true)}>
            Edit
          </button>

          {/* Jumps to the resizer rather than opening a second one. */}
          <a className="btn--ghost btn--sm" href="#resize-a-photo">
            Size a photo
          </a>

          <form action={markPosted} className="fb__send">
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="postDate" value={postDate} />
            <input type="hidden" name="channel" value={channel} />
            <input
              className="field"
              type="url"
              name="url"
              placeholder="https://..."
              aria-label="The link to this post once it is up"
            />
            <button className="btn btn--sm" type="submit">
              Posted
            </button>
          </form>
        </>
      )}
    </div>
  );
}
