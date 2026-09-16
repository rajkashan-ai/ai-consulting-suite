"use client";

import { changeCadence, toggleCritique } from "./planner-actions";
import { CADENCES, CADENCE_LABEL, CRITIQUES } from "../../../../Agents/Content & Social Planner/src/types";
import type { Cadence } from "../../../../Agents/Content & Social Planner/src/types";

/**
 * The two controls that act on the whole plan rather than one post.
 *
 * Both were on the mockup and neither survived the rebuild.
 */

export function CadenceChoice({ workspaceId, current }: { workspaceId: string; current: Cadence }) {
  return (
    <div className="controls">
      {(CADENCES as readonly Cadence[]).map((c) => (
        <form action={changeCadence} key={c}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="cadence" value={c} />
          {/* Their choice always wins, so this writes the month again rather
              than relabelling it: the mix, the angles and the dates all come
              off the cadence, and a plan with the old shape under a new name
              would be a lie on the screen. */}
          <button className="toggle" type="submit" aria-pressed={c === current}>
            {CADENCE_LABEL[c]}
          </button>
        </form>
      ))}
    </div>
  );
}

export function VoiceCorrections({
  workspaceId,
  chosen,
}: {
  workspaceId: string;
  chosen: string[];
}) {
  return (
    <>
      <div className="controls">
        {Object.values(CRITIQUES).map((label) => (
          <form action={toggleCritique} key={label}>
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="critique" value={label} />
            <button className="toggle" type="submit" aria-pressed={chosen.includes(label)}>
              {label}
            </button>
          </form>
        ))}
      </div>
      <p className="t-meta">
        Anything showing as chosen is a correction we are holding. It is remembered next month, and
        the other tools read it too. Press it again to drop it.
      </p>
    </>
  );
}
