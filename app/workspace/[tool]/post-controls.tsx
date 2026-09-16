"use client";

import { markPosted } from "./planner-actions";

/**
 * What the owner does to one post: tell us it went out, and where.
 *
 * "Edit" and "Size a photo" were here and are gone, Raj 2026-09-16. Both were
 * on the mockup and neither earned its place: the resizer sits four inches
 * below with its own heading, so a button to scroll to it was furniture, and
 * editing in the app is not how anyone posts. They write in the app the social
 * network gives them. What we need back from them is the link.
 *
 * That leaves one control, which is the one that feeds everything else: the
 * link gives us the caption as published, and the difference between what we
 * wrote and what they posted is the most useful thing this tool can learn.
 */

export type PostState = { editedWords?: string | null; postedAt?: string | null; postedUrl?: string | null };

export default function PostControls({
  workspaceId,
  postDate,
  channel,
  state,
}: {
  workspaceId: string;
  postDate: string;
  channel: string;
  state: PostState;
}) {
  if (state.postedAt) {
    return (
      <div className="card__foot">
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
      </div>
    );
  }

  return (
    <form action={markPosted} className="card__foot">
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
      <button className="btn--ghost btn--sm" type="submit">
        Posted
      </button>
    </form>
  );
}
