import type { Step, ToolRun } from "../contract.ts";
import type { Business, ToolContext } from "../types.ts";
import { advance as advanceStage, type Before, type RunState } from "./stages.ts";
import { buildBody, hollow, type DocumentBody } from "./document.ts";

/**
 * The Content & Social Planner, as the engine sees it.
 *
 * Everything the engine would otherwise have to know about this tool lives
 * here: its stages and its document. The engine looks this up by the slug on
 * the run row and calls it, and knows nothing else.
 *
 * `prepare` reads the last plan before the first step.
 *
 * Raj, 2026-09-16: we keep a record of what we have already suggested, surely.
 * We do, and nothing read it. Every plan is stored with all thirty days on it:
 * the angles, the dates, the channels and the full text. So the no-repeat rule
 * ran inside one month and reset on the thirty first day, which means month two
 * could legitimately open with the same price post as month one.
 *
 * This is the half of "make next month different" that needs no connected
 * account and no metrics. Knowing what worked still does. Knowing what we
 * already said never did.
 *
 * No `learn` yet. What this tool learns is the gap between what we wrote and
 * what they actually posted, which lives in `content_post_state` and is read
 * from there, so there is nothing to fold on the way past. */

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

  /**
   * What we already suggested this business, so we do not suggest it again.
   *
   * Loaded once and carried in the run's own state, so a run that stops halfway
   * and resumes an hour later uses what it started with rather than something
   * that changed underneath it.
   */
  async prepare(state, business, db) {
    if (state.before !== undefined) return state;

    const { data } = (await db
      .from("documents")
      .select("body")
      .eq("workspace_id", business.id)
      .maybeSingle()) as { data: { body?: unknown } | null };

    return { ...state, before: lastPlan(data?.body) };
  },
};

/**
 * The bits of a stored plan the next one needs, or null on the first run.
 *
 * Deliberately narrow. Carrying the whole document forward would mean the
 * writer sees last month's every word and starts echoing it, which is the
 * opposite of the point. What stops a repeat is knowing the angle and the
 * opening line, so that is all that crosses.
 */
export function lastPlan(body: unknown): Before | null {
  const plan = body as { posts?: { angle?: string; words?: string }[] } | null | undefined;
  if (!plan?.posts?.length) return null;

  const angles = [...new Set(plan.posts.map((p) => p.angle).filter(Boolean))] as string[];
  const openings = plan.posts
    .filter((p) => p.words)
    .map((p) => (p.words as string).split(/(?<=[.!?])\s/)[0].trim())
    .filter(Boolean);

  return angles.length || openings.length ? { angles, openings } : null;
}

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
