import type { Db, Step, ToolRun } from "../contract.ts";
import type { Business, ToolContext } from "../types.ts";
import { advance as advanceStage, type RunState } from "./stages.ts";
import { buildBody, hollow } from "./document.ts";
import { EMPTY, learn as fold, type Playbook } from "./playbook.ts";

/**
 * The Competitor Tracker, as the engine sees it.
 *
 * Everything the engine used to know about this tool by name now lives here:
 * its stages, its document, and the per-trade playbook it loads before a run
 * and folds into afterwards. The engine looks this up by the slug on the run
 * row and calls it, so building the next tool means writing one of these and
 * adding one line to the registry.
 */

export const competitorTracker: ToolRun<RunState> = {
  slug: "competitor-tracker",

  advance(stage, state, business, ctx): Promise<Step<RunState>> {
    return advanceStage(stage as never, state, business, ctx as ToolContext) as Promise<
      Step<RunState>
    >;
  },

  buildBody,
  hollow: (body) => hollow(body as never),

  title: (now) => `Competitor Tracker, ${now.toLocaleDateString("en-GB")}`,

  /**
   * What we already know about researching this trade.
   *
   * Loaded once, at the start, and carried in the run's own state after that.
   * A run that stops halfway and resumes an hour later uses what it started
   * with rather than something that changed underneath it, so a run is
   * consistent with itself.
   */
  async prepare(state, business, db) {
    if (state.playbook !== undefined || !business.trade) return state;

    const { data: found } = (await db
      .from("playbooks")
      .select("*")
      .eq("trade", business.trade)
      .maybeSingle()) as { data: Record<string, unknown> | null };

    return {
      ...state,
      playbook: found
        ? {
            trade: found.trade as string,
            platforms: (found.platforms ?? []) as Playbook["platforms"],
            publishes: (found.publishes ?? []) as Playbook["publishes"],
            deadEnds: (found.dead_ends ?? []) as Playbook["deadEnds"],
            evidence: (found.evidence ?? []) as Playbook["evidence"],
            timesUsed: (found.times_used ?? 0) as number,
            builtFrom: (found.built_from ?? null) as Playbook["builtFrom"],
          }
        : null,
    };
  },

  /**
   * Fold what this run learned back into the trade's playbook.
   *
   * Done on the way past, not only on success. A run that found the right
   * listing and then failed to write a decent battlecard still learned where
   * the listing was, and throwing that away means the next business in this
   * trade pays to find it again.
   */
  async learn(state, business, db) {
    if (!state.learned?.length || !business.trade) return;

    const before: Playbook = state.playbook ?? { trade: business.trade, ...EMPTY };
    const after = fold(before, {
      platforms: state.learned,
      publishes: [],
      deadEnds: (state.listingPages ?? [])
        .filter((p) => !p.ok)
        .map((p) => ({ host: new URL(p.url).hostname.replace(/^www\./, ""), why: p.note })),
      evidence: (state.listingPages ?? [])
        .filter((p) => p.ok)
        .map((p) => ({ url: p.url, on: p.fetchedOn, what: "listed this trade in a town" })),
      town: business.town ?? "",
    });

    await db.from("playbooks").upsert({
      trade: after.trade,
      platforms: after.platforms,
      publishes: after.publishes,
      dead_ends: after.deadEnds,
      evidence: after.evidence,
      times_used: after.timesUsed,
      built_from: after.builtFrom,
      rechecked_at: new Date().toISOString(),
    });
  },
};

/** Re-exported so nothing outside this folder has to know the file layout. */
export type { RunState };
