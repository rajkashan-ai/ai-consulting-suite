import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPage } from "@/lib/research/fetch";
import { advance, type RunState, type Stage } from "@/tools/competitor-tracker/stages";
import { EMPTY, learn, type Playbook } from "@/tools/competitor-tracker/playbook";
import type { Business, ToolContext } from "@/tools/types";

/**
 * Advances one run by one step, and stops.
 *
 * Whoever calls this does not matter: the open page pokes it so it is quick
 * while somebody watches, and a scheduled tick advances it when nobody is.
 * Neither knows about the other, which is why the lease in the database exists.
 *
 * It uses the admin client on purpose. A run advanced by a scheduled tick has
 * no signed-in person behind it, so there is no session for Row Level Security
 * to check. Every row it touches is reached through the run's own id, which the
 * caller already had to know.
 */

const SMALL = "claude-sonnet-5";
const BIG = "claude-opus-5";

export type Progress = {
  stage: Stage;
  progress: string;
  documentId: string | null;
  reason: string | null;
};

export async function step(runId: string): Promise<Progress | null> {
  const db = createAdminClient();

  // Claim it. Returns nothing if it is finished, or if another tick has it.
  const { data: claimed } = await db.rpc("claim_run", { run: runId });
  const run = Array.isArray(claimed) ? claimed[0] : claimed;
  if (!run) return null;

  const { data: workspace } = await db
    .from("workspaces")
    .select("id, website, name, trade, town, address, headline_price, services, one_liner, reach, found_via, known_competitor")
    .eq("id", run.workspace_id)
    .single();

  if (!workspace) return fail(db, runId, "That business is gone.");

  const business: Business = {
    id: workspace.id,
    website: workspace.website ?? "",
    name: workspace.name,
    trade: workspace.trade,
    town: workspace.town,
    address: workspace.address,
    headlinePrice: workspace.headline_price,
    services: workspace.services ?? [],
    oneLiner: workspace.one_liner,
    reach: workspace.reach,
    foundVia: workspace.found_via ?? [],
    knownCompetitor: workspace.known_competitor,
  };

  const state = (run.state ?? {}) as RunState;

  /**
   * What we already know about researching this trade.
   *
   * Loaded once, at the start, and carried in the run's own state after that. A
   * run that stops halfway and resumes an hour later uses what it started with
   * rather than something that changed underneath it, so a run is consistent
   * with itself.
   */
  if (state.playbook === undefined && business.trade) {
    const { data: found } = await db
      .from("playbooks")
      .select("*")
      .eq("trade", business.trade)
      .maybeSingle();

    state.playbook = found
      ? {
          trade: found.trade,
          platforms: found.platforms ?? [],
          publishes: found.publishes ?? [],
          deadEnds: found.dead_ends ?? [],
          evidence: found.evidence ?? [],
          timesUsed: found.times_used ?? 0,
          builtFrom: found.built_from ?? null,
        }
      : null;
  }

  const spent = { input: 0, output: 0 };
  let pages = 0;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const ctx: ToolContext = {
    read: async (url) => {
      pages += 1;
      const got = await fetchPage(url);
      return {
        ok: got.ok,
        url: got.url,
        text: got.text,
        title: got.title,
        fetchedAt: got.fetchedAt,
        note: got.note,
      };
    },

    /**
     * Search, and read the results straight out of the response.
     *
     * Each search arrives as a pair of blocks: a server_tool_use carrying the
     * query, then a web_search_tool_result carrying real urls and titles. The
     * first version asked the model to retype them into a form and it answered
     * in prose, so nothing was ever collected and every run died at the first
     * step with "nothing came back".
     *
     * Reading them directly is also the only honest way to do it. A model asked
     * to repeat twenty urls will eventually repair one, and a repaired url is
     * an invented source on a page whose whole argument is that it invents
     * nothing.
     */
    search: async (terms, toolConfig) => {
      const response = await anthropic.messages.stream({
        model: SMALL,
        max_tokens: 8000,
        system:
          "Run every search below, one at a time, using the search tool. Do not " +
          "summarise or judge what comes back. A one line acknowledgement is all " +
          "the answer needs to be.",
        tools: [toolConfig as never],
        messages: [
          {
            role: "user",
            content: "Search for each of these:\n\n" + terms.map((t) => `- ${t}`).join("\n"),
          },
        ],
      }).finalMessage();

      spent.input += response.usage.input_tokens;
      spent.output += response.usage.output_tokens;

      type SearchBlock = {
        type: string;
        input?: { query?: string };
        /** An array of results, or an error object when the search failed. */
        content?: { type?: string; url: string; title: string }[] | unknown;
      };

      const found: { term: string; results: { url: string; title: string }[] }[] = [];
      let query = terms[0] ?? "";

      for (const block of response.content as unknown as SearchBlock[]) {
        if (block.type === "server_tool_use") {
          query = String((block.input as { query?: string })?.query ?? query);
        }
        if (block.type === "web_search_tool_result") {
          const raw = block.content;
          if (!Array.isArray(raw)) continue;   // an error block, not results
          const results = raw
            .filter((r) => r?.type === "web_search_result")
            .map((r) => ({ url: r.url, title: r.title }));
          const already = found.find((f) => f.term === query);
          if (already) already.results.push(...results);
          else found.push({ term: query, results });
        }
      }

      return found;
    },

    think: async ({ system, prompt, shape, tools, hard, maxTokens }) => {
      /**
       * Streamed, always.
       *
       * The SDK refuses a non-streaming request whose token budget could take
       * it past ten minutes: "Streaming is required for operations that may
       * take longer than 10 minutes". Raising the grid's budget to 32,000 to
       * stop it being truncated walked straight into that, and a run died
       * after reading eight pages.
       *
       * Streaming costs nothing here. finalMessage() waits for the whole answer
       * and hands back the same object the non-streaming call did, so nothing
       * below changes.
       */
      const response = await anthropic.messages.stream({
        model: hard ? BIG : SMALL,
        max_tokens: maxTokens ?? 4000,
        system,
        ...(tools?.length || shape
          ? {
              tools: [
                ...((tools ?? []) as never[]),
                ...(shape ? [shape as never] : []),
              ],
            }
          : {}),
        // Only force the shape when there is no server tool in play. Forcing it
        // alongside web search would stop the model searching before it answered.
        ...(shape && !tools?.length
          ? { tool_choice: { type: "tool" as const, name: shape.name } }
          : {}),
        messages: [{ role: "user", content: prompt }],
      }).finalMessage();

      spent.input += response.usage.input_tokens;
      spent.output += response.usage.output_tokens;

      /**
       * An answer that was cut off is not an answer.
       *
       * This used to return an empty object and let the run carry on. A grid
       * call hit the limit, came back as {}, and the battlecard was built and
       * stored with no comparison in it. The run said "done". It cost 196,000
       * tokens and ten minutes to find out, and the only clue was an empty
       * field.
       */
      if (response.stop_reason === "max_tokens") {
        throw new Error(
          `The answer was cut off at ${maxTokens ?? 4000} tokens` +
            (shape ? ` while building "${shape.name}"` : "") +
            `. Nothing is stored from a half answer.`,
        );
      }

      if (!shape) {
        const text = response.content.find((c) => c.type === "text");
        return text && "text" in text ? text.text : "";
      }

      const used = response.content.find(
        (c) => c.type === "tool_use" && c.name === shape.name,
      );

      // Asked for a shape and given prose. Rare, and silently returning {} made
      // it indistinguishable from a model that had nothing to say.
      if (!used || !("input" in used)) {
        const said = response.content.find((c) => c.type === "text");
        throw new Error(
          `Asked for "${shape.name}" and got ` +
            (said && "text" in said ? `words instead: ${said.text.slice(0, 160)}` : "nothing"),
        );
      }

      return used.input;
    },

    progress: () => {
      // Progress is written once per step, from the result below, rather than
      // every time a tool says something. A row updated twenty times a step is
      // twenty writes to say the same thing.
    },
  };

  let result;
  try {
    result = await advance(run.stage as Stage, state, business, ctx);
  } catch (e) {
    return fail(db, runId, e instanceof Error ? e.message : String(e), spent, pages);
  }

  /**
   * Fold what this run learned back into the trade's playbook.
   *
   * Done on the way past, not only on success. A run that found the right
   * listing and then failed to write a decent battlecard still learned where
   * the listing was, and throwing that away means the next business in this
   * trade pays to find it again.
   */
  if (result.state.learned?.length && business.trade) {
    const before: Playbook = result.state.playbook ?? { trade: business.trade, ...EMPTY };
    const after = learn(before, {
      platforms: result.state.learned,
      publishes: [],
      deadEnds: (result.state.listingPages ?? [])
        .filter((p) => !p.ok)
        .map((p) => ({ host: new URL(p.url).hostname.replace(/^www\./, ""), why: p.note })),
      evidence: (result.state.listingPages ?? [])
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
  }

  // A finished run becomes a document, and the document is what the screen
  // reads from then on. The run row is the machinery; the document is the work.
  let documentId: string | null = null;
  if (result.stage === "done" && result.state.card) {
    const { data: doc } = await db
      .from("documents")
      .insert({
        workspace_id: business.id,
        tool: "competitor-tracker",
        title: `Competitor Tracker, ${new Date().toLocaleDateString("en-GB")}`,
        body: {
          ...result.state.card,
          standing: result.state.standing,
          grid: result.state.grid,
        } as never,
      })
      .select("id")
      .single();
    documentId = doc?.id ?? null;
  }

  await db
    .from("runs")
    .update({
      stage: result.stage,
      state: result.state as never,
      progress: result.progress,
      leased_until: null,
      ...(result.stage === "done" || result.stage === "failed"
        ? {
            finished_at: new Date().toISOString(),
            ok: result.stage === "done",
            error: result.state.reason ?? null,
            document_id: documentId,
          }
        : {}),
    })
    .eq("id", runId);

  /**
   * Added, never overwritten, and added in the database.
   *
   * Each step used to write its own spend over the last one, and the final step
   * makes no model calls, so every finished run recorded zero. The page count
   * was worse: it added to run.state.pagesFetched, which nothing has ever
   * written.
   *
   * Done as one statement in Postgres because the open page and the scheduled
   * tick can both advance a run, and a read-modify-write from two places loses
   * one of them. This is the number the fair use cap will be set from.
   */
  if (spent.input || spent.output || pages) {
    await db.rpc("add_run_cost", {
      run: runId,
      add_input: spent.input,
      add_output: spent.output,
      add_pages: pages,
    });
  }

  return {
    stage: result.stage,
    progress: result.progress,
    documentId,
    reason: result.state.reason ?? null,
  };
}

async function fail(
  db: ReturnType<typeof createAdminClient>,
  runId: string,
  reason: string,
  spent = { input: 0, output: 0 },
  pages = 0,
): Promise<Progress> {
  await db
    .from("runs")
    .update({
      stage: "failed",
      progress: reason,
      error: reason,
      ok: false,
      finished_at: new Date().toISOString(),
      leased_until: null,
    })
    .eq("id", runId);

  // A failed run still spent money, and hiding that is how a bill becomes a
  // surprise. Added the same way as a successful one.
  if (spent.input || spent.output || pages) {
    await db.rpc("add_run_cost", {
      run: runId,
      add_input: spent.input,
      add_output: spent.output,
      add_pages: pages,
    });
  }

  return { stage: "failed", progress: reason, documentId: null, reason };
}
