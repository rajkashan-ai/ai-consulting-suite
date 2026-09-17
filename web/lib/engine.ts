import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPage } from "@/lib/research/fetch";
import { runnerFor } from "@/tools/registry";
import type { AnyState } from "@/tools/contract";
import type { Business, ToolContext } from "@/tools/types";
import { check, note, type Watch } from "@/lib/watchdog";
import { note as noteProblem } from "@/lib/problems";
import { plainly } from "@/lib/plainly";

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

/**
 * The two ways a model call can fail, as errors whose message is already fit to
 * be read by an owner.
 *
 * The size, the part being built and whatever prose came back instead are all
 * machinery. They go on `cause`, which plainly() folds into the text we keep
 * and never into the text we show. Built here rather than written inline
 * because a `throw new Error(...)` whose argument interpolates a variable puts
 * that variable's name in the source, and the check that reads these messages
 * reads the source.
 */
function cutOff(part: string | undefined, ceiling: number): Error {
  const e = new Error("CutOff: the write up came out longer than we can handle in one go");
  e.cause = `${part ?? "no shape"} at ${ceiling}`;
  return e;
}

function wrongForm(part: string, said: string): Error {
  const e = new Error("WrongForm: the write up came back in a form we could not use");
  e.cause = `${part}: ${said}`;
  return e;
}

const SMALL = "claude-sonnet-5";
const BIG = "claude-opus-5";

export type Progress = {
  /** The tool's own stage name. The engine does not know the set. */
  stage: string;
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

  /**
   * Has this one already gone wrong? Asked before any money is spent, so a run
   * that is circling does not pay for one more lap to prove it.
   */
  /**
   * Which tool this run belongs to, by the slug already stored on it.
   *
   * The engine used to import the Competitor Tracker by name, so every new tool
   * meant editing this file and two people building two tools collided on the
   * first commit. It knows nothing about any tool now.
   */
  const tool = runnerFor(run.tool);
  if (!tool) {
    return fail(db, runId, "This tool cannot run yet. Nothing has been saved.");
  }

  const watch = ((run.state ?? {}) as { watch?: Watch }).watch ?? {};

  /**
   * Did the last attempt at this run die without saving?
   *
   * `began` is written before the work starts, so it is still here if the step
   * never got to write anything. That is the case none of our other numbers can
   * see, and on 2026-09-17 it was the case that mattered: the step route is
   * capped at 60 seconds, the lease is 90, and the scheduler fires every 60, so
   * a step that outlives the cap is killed, saves nothing, and is then picked
   * up again by whoever claims next. Nothing recorded it.
   */
  if (watch.began) {
    const seconds = Math.round((Date.now() - Date.parse(watch.began.at)) / 1000);
    watch.died = [...(watch.died ?? []), { stage: watch.began.stage, seconds }];
    console.warn(`[step] ${watch.began.stage} started and never finished, ${seconds}s ago`);
  }
  watch.began = { stage: run.stage, at: new Date().toISOString() };
  (run.state as { watch?: Watch } | null) && ((run.state as { watch?: Watch }).watch = watch);
  await db
    .from("runs")
    .update({ state: { ...(run.state ?? {}), watch } as never })
    .eq("id", runId);
  const verdict = check(watch, { stage: run.stage, startedAt: run.started_at });
  if (verdict) {
    // The reason the customer reads and the reason we need are different
    // things. Theirs goes in the error, ours goes in the state, where it is
    // still here tomorrow when somebody asks what happened.
    await db
      .from("runs")
      .update({
        state: { ...(run.state ?? {}), watch: { ...watch, stopped: verdict.why, began: null } } as never,
      })
      .eq("id", runId);
    return fail(db, runId, verdict.say);
  }

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

  /**
   * The tool's own state, which the engine stores and never looks inside.
   *
   * That is what lets a tool change its shape without anything outside its own
   * folder knowing, and it is why this is AnyState rather than one tool's type.
   */
  let state = (run.state ?? {}) as AnyState;

  // Whatever this tool needs loaded before a step. It decides for itself
  // whether there is anything to do; the engine does not know what it is.
  if (tool.prepare) state = await tool.prepare(state as never, business, db as never);

  /**
   * What this step spent, including what the prompt cache gave back.
   *
   * The two cache numbers are counted apart from `input` because they are
   * billed apart: a read is a tenth of base input and a write is one and a
   * quarter times it. Adding them together would produce a figure that answers
   * no question anybody has.
   */
  const spent = { input: 0, output: 0, cacheWritten: 0, cacheRead: 0 };
  let pages = 0;

  /**
   * How long one model call may take, and how many times it may be retried.
   *
   * WHY THESE ARE SET RATHER THAN LEFT ALONE
   * The SDK's own defaults are 10 minutes per attempt and two retries, and its
   * documentation says plainly that "request timeouts are retried by default,
   * so in a worst-case scenario you may wait much longer than this timeout".
   * Nothing here set either, so one ctx.think call could occupy half an hour,
   * and a retry redoes the whole thing including every web search.
   *
   * That is what a hang looks like from outside. On 2026-09-17 the naming call
   * sat for 11.8 minutes with nothing saved and was stopped by hand: 10 minutes
   * of first attempt, then a retry that was still going. It is the same shape
   * as the 20.8 minute run on 16 September and the 16 minutes Raj watched.
   *
   * The numbers come from measurement, not from taste. The slowest call that
   * has ever succeeded here is the naming call at 133.5 seconds, every other
   * call measured under 55. 180 seconds is that plus a third. One retry, so a
   * genuine blip does not end a run, and a stuck call costs six minutes rather
   * than thirty. Both are one measurement each and should be revisited when
   * there are more.
   */
  const CALL_SECONDS = 180;
  const RETRIES = 1;

  /**
   * How long one stream may run in total before we end it.
   *
   * Measured on the clock, not on silence, and the difference matters. The
   * client `timeout` above does not cover a stream at all: it guards the HTTP
   * request and does not re-arm once bytes are flowing, so a long stream runs
   * as long as it likes with `timeout: 180000` set.
   *
   * The first version of this ended a stream that had said nothing for 120
   * seconds, and it was wrong. The run that prompted it looked hung and was
   * not: the event count climbed the whole time, 38 to 146 to 261 to 316 to
   * 402, with gaps of 154, 171, 201 and 231 seconds that each resumed. Ending
   * it on silence would have killed a working call, and only counting the
   * events told the two apart.
   *
   * 300 seconds bounds a runaway without touching anything measured. With the
   * naming call out of the path the longest real call is the listings read at
   * about 50 seconds.
   */
  const RUN_SECONDS = 300;

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: CALL_SECONDS * 1000,
    maxRetries: RETRIES,
  });

  /**
   * Say, while it is happening, that a call has gone quiet.
   *
   * A hang leaves no record: the step saves nothing until the call returns, so
   * everything we store is written by steps that finished. The only way to know
   * where a stuck call stopped is to say so while it is stuck. Prints every
   * thirty seconds with how many events have arrived and how long ago the last
   * one was, so a stall is told apart from a call that is simply long.
   */
  const sayIfStalled = (
    stream: { on: (e: "streamEvent", cb: () => void) => unknown; abort: () => void },
    label: string,
  ) => {
    let events = 0;
    let last = Date.now();
    stream.on("streamEvent", () => {
      events += 1;
      last = Date.now();
    });
    const began = Date.now();
    const tick = setInterval(() => {
      const quiet = Math.round((Date.now() - last) / 1000);
      const running = Math.round((Date.now() - began) / 1000);
      if (running >= RUN_SECONDS) {
        console.warn(`[stall] ${label}: ${running}s and ${events} events. Ending it.`);
        clearInterval(tick);
        stream.abort();
        return;
      }
      console.warn(`[stall] ${label}: ${events} events in ${running}s, nothing for ${quiet}s`);
    }, 30_000);
    return () => clearInterval(tick);
  };

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
      /**
       * ONE TERM PER CALL. The whole reason this is not one call.
       *
       * All five terms used to go in a single request, and the model ran them
       * one after another inside that one conversation. Every search result
       * block stays in the conversation, and the API bills input for each turn
       * carrying everything before it. So five searches cost one, then two,
       * then three, then four, then five copies of the pile.
       *
       * Measured on 2026-09-17: that call was billed 127,351 input tokens in
       * thirty seconds, against a 150,000 ceiling for the whole run. The run
       * died at the next stage with 158,090 spent, having done nothing wrong
       * except ask five questions in one breath.
       *
       * Separate calls carry nothing of each other, so the cost is five times
       * one search rather than fifteen. They run at the same time, so the
       * thirty seconds does not become two and a half minutes. max_uses is
       * forced to 1: a config built for five terms would otherwise let a single
       * term search five times and rebuild the same pile inside one call.
       */
      const justOne = { ...(toolConfig as Record<string, unknown>), max_uses: 1 };

      const askFor = async (term: string) => {
        const running = anthropic.messages.stream({
          model: SMALL,
          max_tokens: 1000,
          system:
            "Run the search below using the search tool. Do not summarise or " +
            "judge what comes back. A one line acknowledgement is all the answer " +
            "needs to be.",
          tools: [justOne as never],
          messages: [{ role: "user", content: `Search for: ${term}` }],
        });
        const stopSaying = sayIfStalled(running, `search ${term}`);
        const response = await running.finalMessage().finally(stopSaying);

        spent.input += response.usage.input_tokens;
        spent.output += response.usage.output_tokens;
        countCache(spent, response.usage);

        type SearchBlock = {
          type: string;
          input?: { query?: string };
          /** An array of results, or an error object when the search failed. */
          content?: { type?: string; url: string; title: string }[] | unknown;
        };

        const results: { url: string; title: string }[] = [];
        for (const block of response.content as unknown as SearchBlock[]) {
          if (block.type !== "web_search_tool_result") continue;
          const raw = block.content;
          if (!Array.isArray(raw)) continue;   // an error block, not results
          for (const r of raw) {
            if (r?.type === "web_search_result") results.push({ url: r.url, title: r.title });
          }
        }
        return { term, results };
      };

      // Different searches, so there is never a reason to wait for one before
      // asking the next. A term that fails comes back with no results rather
      // than taking the other four with it.
      const settled = await Promise.allSettled(terms.map(askFor));
      const found: { term: string; results: { url: string; title: string }[] }[] = [];
      for (const [i, outcome] of settled.entries()) {
        if (outcome.status === "fulfilled") {
          found.push(outcome.value);
          continue;
        }
        /**
         * A search that threw is not a search that found nothing.
         *
         * This returned an empty result set and said nothing, so on 2026-09-17
         * two businesses failed in half a second having spent no tokens, and
         * told their owner "we could not find any other barbers in Shrewsbury".
         * The truth was that every call had errored. A wrong answer delivered
         * confidently is worse than the error it replaced, and swallowing it
         * here is the same fault the error handling work was meant to remove.
         */
        console.warn(`[search] "${terms[i]}" threw: ${String(outcome.reason).slice(0, 300)}`);
        found.push({ term: terms[i] ?? "", results: [] });
      }
      // Every one failing is a fault, not a market with nothing in it.
      if (terms.length && found.every((f) => !f.results.length)) {
        const why = settled.find((o) => o.status === "rejected");
        if (why && why.status === "rejected") throw why.reason;
      }
      return found;
    },

    think: async ({ system, prompt, cachedPrefix, shape, tools, hard, maxTokens }) => {
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
      const running = anthropic.messages.stream({
        model: hard ? BIG : SMALL,
        max_tokens: maxTokens ?? 4000,
        /**
         * The system prompt is cached, and it is the only thing that is.
         *
         * The documented rule is to put the breakpoint on the last block that
         * stays identical between requests. The system prompt is exactly that:
         * a tool's rules do not change between the calls of one run, or between
         * runs, and the tracker's writing stage alone sends it three times.
         *
         * A cache read is a tenth of base input; a write is one and a quarter
         * times. So the first call of a run pays slightly more and every call
         * after it pays a tenth, which is only worth doing because the same
         * prefix is reused several times within the five minute life.
         *
         * The prompt is NOT cached. It carries the evidence, and the evidence
         * is different in every run and mostly different between calls in one
         * run. Caching a block that changes writes a new entry every time and
         * reads none, which costs 1.25x to achieve nothing.
         *
         * Below the model's minimum prefix length, nothing is cached and no
         * error is raised, which is why `cacheRead` is recorded rather than
         * assumed. See ARCHITECTURE.md section 2.
         */
        system: [{ type: "text" as const, text: system, cache_control: { type: "ephemeral" as const } }],
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
        /**
         * A shared prefix goes in its own block with the breakpoint on it, so
         * the calls after the first read it instead of paying for it again.
         * Without one this is the plain string it always was.
         */
        messages: [
          {
            role: "user" as const,
            content: cachedPrefix
              ? [
                  {
                    type: "text" as const,
                    text: cachedPrefix,
                    cache_control: { type: "ephemeral" as const },
                  },
                  { type: "text" as const, text: prompt },
                ]
              : prompt,
          },
        ],
      });
      const stopSaying = sayIfStalled(running, shape?.name ?? "prose");
      const response = await running.finalMessage().finally(stopSaying);

      /**
       * Say what this one call cost, and what it was carrying.
       *
       * The run-level and stage-level numbers could not answer "which call is
       * the expensive one". On 2026-09-17 a writing step billed 110,249 input
       * tokens and the only way offered to explain it was arithmetic over the
       * saved state, which came out at half that and was therefore wrong. One
       * line per call, printed beside the real usage from the response, is the
       * measurement rather than the estimate.
       */
      console.log(
        `[think] ${shape?.name ?? "prose"}${hard ? " hard" : ""}: ` +
          `system ${system.length.toLocaleString()} chars, ` +
          `prompt ${prompt.length.toLocaleString()} chars` +
          (cachedPrefix ? ` (+${cachedPrefix.length.toLocaleString()} shared)` : "") +
          ` -> ` +
          `${response.usage.input_tokens.toLocaleString()} in, ` +
          `${response.usage.output_tokens.toLocaleString()} out, ` +
          `cache ${(response.usage.cache_read_input_tokens ?? 0).toLocaleString()} read / ` +
          `${(response.usage.cache_creation_input_tokens ?? 0).toLocaleString()} written`,
      );
      spent.input += response.usage.input_tokens;
      spent.output += response.usage.output_tokens;
      countCache(spent, response.usage);

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
        throw cutOff(shape?.name, maxTokens ?? 4000);
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
        throw wrongForm(shape.name, said && "text" in said ? said.text.slice(0, 160) : "nothing");
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
  const startedStep = Date.now();
  try {
    result = await tool.advance(run.stage, state as never, business, ctx);
  } catch (e) {
    const seconds = (Date.now() - startedStep) / 1000;
    console.warn(`[step] ${run.stage} threw after ${seconds.toFixed(1)}s`);
    watch.began = null;
    return faulted(db, runId, run.state, watch, e, spent, pages, {
      stage: run.stage,
      seconds,
    });
  }

  /**
   * Count the step that just happened, against the stage it was spent in.
   *
   * Recorded against `run.stage`, the stage we were in when we started, not
   * `result.stage`, where we ended up. A run that circles between checking and
   * fixing spends a step in each every time round, and counting the destination
   * would credit the work to the wrong one and never trip a cap.
   */
  /**
   * Built on what the step left behind, not on what it started with.
   *
   * This was `note(watch, ...)`, using the watch from before the step, so a
   * failure reason that advance() had just recorded was overwritten one line
   * later and lost. A real run failed today with nothing stored to say why,
   * for the second time, by a different route to the first.
   */
  (result.state as { watch?: Watch }).watch = note(
    (result.state as { watch?: Watch }).watch ?? watch,
    run.stage,
    result.progress,
    {
    seconds: (Date.now() - startedStep) / 1000,
    input: spent.input,
    output: spent.output,
    cacheWritten: spent.cacheWritten,
    cacheRead: spent.cacheRead,
    pages,
  });
  // It saved, so it did not die. Cleared here rather than anywhere earlier,
  // because everything between the claim and this line can still be killed.
  (result.state as { watch?: Watch }).watch!.began = null;
  console.log(
    `[step] ${run.stage} -> ${result.stage} in ` +
      `${((Date.now() - startedStep) / 1000).toFixed(1)}s, ` +
      `${spent.input.toLocaleString()} in, ${spent.output.toLocaleString()} out, ${pages} pages`,
  );

  /**
   * Whatever this tool wants to keep from the run, kept.
   *
   * Called on the way past, not only on success: the tracker's own comment for
   * this said a run that found the right listing and then failed still learned
   * where the listing was. The engine does not know what any of it is.
   */
  if (tool.learn) await tool.learn(result.state as never, business, db as never);

  // A finished run becomes a document, and the document is what the screen
  // reads from then on. The run row is the machinery; the document is the work.
  let documentId: string | null = null;
  if (result.stage === "done") {
    const body = tool.buildBody(result.state as never);

    /**
     * Do not store a document that is not worth opening.
     *
     * A run that reaches here has already been paid for, so refusing costs
     * nothing that is not already spent, and it is the last place we can catch
     * a card that passed every check on the way and still has nothing in it.
     * The alternative is a page that says "done" above an empty table.
     */
    const why = tool.hollow(body);
    if (why) {
      return fail(
        db,
        runId,
        `We could not finish this properly: ${why}. Nothing has been saved. Start it again.`,
        spent,
        pages,
      );
    }

    const { data: doc } = await db
      .from("documents")
      .insert({
        workspace_id: business.id,
        tool: tool.slug,
        title: tool.title(new Date()),
        body: body as never,
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
    reason: (result.state as { reason?: string }).reason ?? null,
  };
}

/**
 * A step threw. Tell the owner something they can act on, keep the real text.
 *
 * Both halves matter. Theirs used to be the exception's own words, so a barber
 * could be shown a token budget and a shape name. Ours has to survive, because
 * the real text is the only thing that makes the fault findable tomorrow.
 */
async function faulted(
  db: ReturnType<typeof createAdminClient>,
  runId: string,
  had: unknown,
  watch: Watch,
  e: unknown,
  spent: { input: number; output: number; cacheWritten?: number; cacheRead?: number },
  pages: number,
  step: { stage: string; seconds: number },
): Promise<Progress> {
  const plain = plainly(e);

  /**
   * A step that threw still spent the money.
   *
   * This wrote the watch it was handed, so a failed step's tokens reached the
   * run row and never reached `watch.cost`. The two then disagreed, and one of
   * them is what the spend ceiling reads.
   *
   * On 2026-09-17 a run was charged 205,450 input tokens with 60,647 recorded.
   * The ceiling is 150,000 and never fired, because the number it reads was 70
   * per cent short. A limit that cannot see the spend is not a limit, it is a
   * decoration, and it looked like protection for a day.
   */
  const counted = note(watch, step.stage, plain.say, {
    seconds: step.seconds,
    input: spent.input,
    output: spent.output,
    cacheWritten: spent.cacheWritten ?? 0,
    cacheRead: spent.cacheRead ?? 0,
    pages,
  });

  /**
   * A thrown run is a fault, not an outcome.
   *
   * A run that stops because a site refused us has worked correctly and is not
   * recorded here. A run that threw has hit something we did not plan for, and
   * that is exactly what this table is for: `runs.state.watch.stopped` already
   * held the reason, but only for that one run, so nobody could tell a fault
   * that happened once from one happening to everybody.
   */
  await noteProblem(db as never, {
    error: e,
    where: `run ${(had as { stage?: string } | null)?.stage ?? "unknown"}`,
    kind: "run",
    // They came for a comparison and are not getting one.
    severity: "stopped",
    runId,
  });

  await db
    .from("runs")
    .update({
      state: { ...((had ?? {}) as object), watch: { ...counted, stopped: plain.why } } as never,
    })
    .eq("id", runId);
  return fail(db, runId, plain.say, spent, pages);
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

/**
 * Add what the prompt cache did on this call to the running total.
 *
 * Both fields are optional on the response: an account or a model with no
 * caching in play simply does not send them, and the documentation says
 * explicitly that a prompt below the minimum length is not cached and raises no
 * error. So a zero here means "nothing was cached", which is the honest answer
 * and is exactly what we need to see before claiming caching saved anything.
 */
function countCache(
  spent: { cacheWritten: number; cacheRead: number },
  usage: { cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null },
): void {
  spent.cacheWritten += usage.cache_creation_input_tokens ?? 0;
  spent.cacheRead += usage.cache_read_input_tokens ?? 0;
}
