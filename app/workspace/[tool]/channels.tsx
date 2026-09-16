import { CHANNEL } from "../../../../Agents/Content & Social Planner/src/types";
import { saveChannels } from "./planner-actions";

/**
 * Where do you post? Shown with what we read off their site already ticked.
 *
 * Named options, never a text box, for the reason in UI/CLAUDE.md 6a: a list is
 * actionable and a free answer is not. Telling someone to start a channel is a
 * claim about their market with nothing behind it, so nothing here is suggested
 * that their own site did not mention, except as an unticked option they can
 * choose for themselves.
 */
export default function Channels({
  workspaceId,
  detected,
  confirmed,
}: {
  workspaceId: string;
  /** What their own pages mention. A suggestion, not an answer. */
  detected: string[];
  /** What they told us, or null if nobody has asked yet. */
  confirmed: string[] | null;
}) {
  const ticked = confirmed ?? detected;

  return (
    <form action={saveChannels}>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <h2 className="t-section">Where do you post?</h2>
      <p className="t-doc-sm">
        {confirmed
          ? "Change this and we write the month again for the new ones."
          : detected.length
            ? "These are the ones your own site mentions. Tell us if we have it wrong."
            : "Your site does not mention any, so we cannot guess. Tell us and we will write the month."}
      </p>

      <div className="controls">
        {(Object.keys(CHANNEL) as (keyof typeof CHANNEL)[]).map((c) => (
          <label className="toggle" key={c} aria-pressed={ticked.includes(c)}>
            <input type="checkbox" name="channel" value={c} defaultChecked={ticked.includes(c)} />
            {CHANNEL[c].label}
          </label>
        ))}
      </div>

      <div className="card__foot">
        <button className="btn" type="submit">
          {confirmed ? "Save" : "That is right"}
        </button>
      </div>
    </form>
  );
}
