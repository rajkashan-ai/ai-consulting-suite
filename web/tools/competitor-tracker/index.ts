import type { Db, Step, ToolRun } from "../contract.ts";
import type { Business, ToolContext } from "../types.ts";
import { advance as advanceStage, type RunState } from "./stages.ts";
import { buildBody, hollow } from "./document.ts";
import { EMPTY, learn as fold, type Playbook } from "./playbook.ts";
import { playbookKey } from "./where.ts";
import { enoughToUse, rowsFor, type Kept } from "./remember.ts";

/** The hostname, or "" for anything that will not parse. Never throws. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // A url we were handed that is not one. Expected, and dropping the entry is
    // the right answer. ERROR-HANDLING.md rule 1, fourth case.
    return "";
  }
}

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
    if (state.playbook !== undefined) return state;

    /**
     * Who we already know they are up against.
     *
     * Loaded before the first step, so a run that has a set never enters
     * discovery at all. This is the whole saving: 8 minutes 41 seconds and
     * 35,000 tokens on the St Albans run, to answer a question whose answer
     * was the same as last time.
     */
    const { data: rows } = (await db
      .from("competitors")
      .select("name, url, why, source, found_at")
      .eq("workspace_id", business.id)
      .is("rejected_at", null)) as { data: Record<string, unknown>[] | null };

    const kept: Kept[] = (rows ?? []).map((r) => ({
      name: r.name as string,
      url: (r.url ?? null) as string | null,
      why: (r.why ?? null) as string | null,
      source: (r.source ?? "asked") as string,
      foundAt: (r.found_at ?? new Date().toISOString()) as string,
    }));

    /**
     * Last week's comparison, so this week's can say what moved.
     *
     * Loaded here rather than at the end, because the grid this run builds
     * overwrites nothing: the two have to exist side by side for a moment to
     * be compared at all.
     */
    const { data: last } = (await db
      .from("documents")
      .select("body, created_at")
      .eq("workspace_id", business.id)
      .maybeSingle()) as { data: Record<string, unknown> | null };

    const body = (last?.body ?? null) as { grid?: unknown } | null;

    state = {
      ...state,
      kept,
      lastGrid: (body?.grid ?? undefined) as never,
      lastOn: (last?.created_at ?? null) as string | null,
    };

    // An unmatched business is filed under its own words, never under the bare
    // `other`, which every unmatched business in the country would share. No
    // words at all means no playbook: better to learn nothing than to learn
    // into a row that mixes trades.
    const key = playbookKey(business);
    if (!key) return { ...state, playbook: null };

    const { data: found } = (await db
      .from("playbooks")
      .select("*")
      .eq("trade", key)
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
            nothingIn: (found.nothing_in ?? []) as Playbook["nothingIn"],
            towns: (found.towns ?? []) as Playbook["towns"],
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
    /**
     * Remember who they turned out to be, whichever route found them.
     *
     * Written on the way past like everything else here: a run that found the
     * five and then failed to write a decent card still found the five, and
     * throwing that away means the next run pays to find them again. That is
     * the mistake this whole change exists to stop making.
     */
    const discovered = state.namedThenChecked ?? [];
    if (discovered.length && business.id) {
      await db.from("competitors").upsert(rowsFor(business.id, discovered, "asked"), {
        onConflict: "workspace_id,name",
        ignoreDuplicates: true,
      });
    }

    const key = playbookKey(business);
    if (!key) return;

    /**
     * Did this run actually look?
     *
     * "We found nothing" is a claim about the trade, and only a run that
     * searched has earned the right to make it. On 2026-09-16 the API credit
     * ran out, six runs died in under two seconds having fetched no page and
     * spent no token, and one of them filed "nothing in Shrewsbury" against a
     * barber playbook holding two platforms that name 185 barbers. Three of
     * those would have stopped the trade permanently.
     *
     * Search results coming back is the evidence. Everything downstream of it
     * is a real result, empty or not; everything before it is a run that fell
     * over, which is a fact about us and not about the trade.
     */
    const looked = !!state.seen?.length;
    if (!looked) return;

    // A run that looked and found nothing is worth writing down, and so is a
    // known host we searched for on purpose and got nothing from. Both used to
    // be dropped, so a trade could come back empty forever and a platform that
    // had stopped listing it was searched on every run.
    const foundNothing = !state.learned?.length && !state.listed?.length;
    const blank = state.blankHosts ?? [];
    if (!state.learned?.length && !foundNothing && !blank.length) return;

    const before: Playbook = state.playbook ?? { trade: key, ...EMPTY };
    const after = fold(before, {
      platforms: state.learned ?? [],
      blank,
      foundNothing,
      publishes: [],
      deadEnds: (state.listingPages ?? [])
        .filter((p) => !p.ok)
        // Guarded, because this runs on the way past every step: a single
        // unparseable url here would fail a run that had otherwise finished.
        .map((p) => ({ host: hostOf(p.url), why: p.note }))
        .filter((d) => d.host),
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
      nothing_in: after.nothingIn,
      towns: after.towns,
      rechecked_at: new Date().toISOString(),
    });
  },
};

/** Re-exported so nothing outside this folder has to know the file layout. */
export type { RunState };
