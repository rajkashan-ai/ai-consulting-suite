import type { Step, ToolRun } from "../contract.ts";
import type { Business, ToolContext } from "../types.ts";
import { advance as advanceStage, type RunState } from "./stages.ts";
import { buildBody, hollow, type DocumentBody } from "./document.ts";

/**
 * The Content & Social Planner, as the engine sees it.
 *
 * Everything the engine would otherwise have to know about this tool lives
 * here: its stages and its document. The engine looks this up by the slug on
 * the run row and calls it, and knows nothing else.
 *
 * No `prepare` and no `learn` yet. The tool does keep something between runs,
 * the voice note, and it belongs on the business profile rather than in a
 * per-tool store, because the other five tools read it too. Writing it there
 * needs a column that does not exist, so it is a migration and a second pass,
 * and an empty hook now would be a hook nobody calls.
 */

export const contentSocialPlanner: ToolRun<RunState> = {
  slug: "content-social-planner",

  advance(stage, state, business, ctx): Promise<Step<RunState>> {
    return advanceStage(stage as never, state, business as Business, ctx as ToolContext) as Promise<
      Step<RunState>
    >;
  },

  buildBody,
  hollow: (body) => hollow(body as DocumentBody | null),

  title: (now) => `Your posts, ${now.toLocaleDateString("en-GB")}`,
};

/**
 * Where a run of this tool starts.
 *
 * Named here rather than left to the `runs.stage` column default, which is
 * 'searching' — the Competitor Tracker's first stage, written into the schema
 * before there was a second tool. Changing that default would change the
 * Tracker's behaviour, so this tool says what it wants and the default is left
 * alone.
 */
export const FIRST_STAGE = "reading";

export type { RunState, DocumentBody };
