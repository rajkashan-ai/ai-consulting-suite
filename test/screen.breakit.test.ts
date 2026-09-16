import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { advance, type RunState } from "../tools/competitor-tracker/stages.ts";
import { buildBody, hollow } from "../tools/competitor-tracker/document.ts";
import { check } from "../lib/watchdog.ts";
import {
  findNamedReviewers,
  findRankClaims,
  findTrafficClaims,
} from "../../Agents/Competitor Tracker/src/guards.ts";
import { aBusiness, fakeContext, type Recorded } from "./fake.ts";

/**
 * Written by an independent tester against the product requirement.
 *
 *   - Never leak how the product is built onto the customer's screen. No stage
 *     names, step counts, token counts, limits or internal jargon.
 *     (UI/CLAUDE.md section 7 rule 7.)
 *   - Never claim a competitor's traffic, ad spend or Google ranking, and never
 *     name a person who wrote a review.
 *   - Never run forever, and never kill a run that is healthy.
 */

const recorded = JSON.parse(
  readFileSync(join(import.meta.dirname, "fixtures", "shrewsbury.json"), "utf8"),
) as Recorded;

const anAction = (rank: number) => ({
  rank,
  area: "pricing",
  headline: `Publish a price for job ${rank}`,
  why: "Four of the five publish one and you do not.",
  evidence: [
    {
      text: "Four of the five publish a classic cut price on Booksy",
      value: 4,
      source: { url: "https://booksy.com/en-gb/s/barber/1227928_shrewsbury", fetchedOn: "2026-09-15" },
    },
  ],
});

const cleanNarrative = {
  competitors: [{ name: "ARMANDO Barbershop", claims: {} }],
  where_you_win: [],
  where_they_win: [],
  actions: [1, 2, 3].map(anAction),
};

async function run(
  think: Record<string, unknown>,
  business = aBusiness(),
  pages: Recorded = recorded,
) {
  const { ctx } = fakeContext(pages, { think });
  let state: RunState = {};
  let stage = "searching" as never;
  let last = "";
  for (let i = 0; i < 30; i++) {
    const step = await advance(stage, state, business, ctx);
    stage = step.stage as never;
    state = step.state;
    last = step.progress;
    if (stage === "done" || stage === "failed") break;
  }
  return { stage, state, progress: last };
}

/**
 * The words that give away how this thing is built. Taken from the project's
 * own rule and from the existing watchdog test, which uses the same list.
 */
const MACHINERY =
  /\bstage\b|\bstep\b|\bsite:|searching|listings|choosing|writing|token|\bcap\b|\blimit\b|\bshape\b|\bschema\b|\bprompt\b|\bmodel\b|\bapi\b|\bjson\b|undefined|\bnull\b/i;

// ---------------------------------------------------------------------------
// Nothing the customer reads says how the product works.
// ---------------------------------------------------------------------------

test("breakit: a failed search does not put our search syntax on the screen", async () => {
  // A business that said it gets customers through a booking site. The search
  // then runs "barber Shrewsbury site:booksy.com", and when nothing comes back
  // the failure quotes it at the owner.
  const nothing: Recorded = { ...recorded, searchResults: [{ term: "barber Shrewsbury", results: [] }] };

  const { stage, state } = await run({}, aBusiness({ foundVia: ["booking"] }), nothing);

  assert.equal(stage, "failed");
  assert.doesNotMatch(
    state.reason ?? "",
    MACHINERY,
    `reason shown to the owner: ${state.reason}`,
  );
});

test("breakit: every reason a run can fail with is free of machinery", async () => {
  const reasons: string[] = [];

  // No trade.
  reasons.push(
    (await run({}, aBusiness({ trade: null as never, town: null as never }))).state.reason ?? "",
  );

  // Nothing came back from the search.
  reasons.push(
    (
      await run({}, aBusiness({ foundVia: ["booking"] }), {
        ...recorded,
        searchResults: [{ term: "barber Shrewsbury", results: [] }],
      })
    ).state.reason ?? "",
  );

  // The comparison could not be built.
  reasons.push((await run({ comparison: { comparison: [] } })).state.reason ?? "");

  // Nothing worth doing came out of it.
  reasons.push(
    (
      await run({
        comparison: { comparison: recorded.grid },
        battlecard: { ...cleanNarrative, actions: [] },
      })
    ).state.reason ?? "",
  );

  const leaks = reasons.filter(Boolean).filter((r) => MACHINERY.test(r));
  assert.deepEqual(leaks, [], `reasons carrying machinery:\n  ${leaks.join("\n  ")}`);
});

test("breakit: the message a stopped run shows does not promise something untrue", () => {
  // The run row is created fresh with no state, so "start it again" starts from
  // nothing. Telling an owner it carries on is a claim about our own machinery
  // and it is not true.
  /**
   * Setup changed on 2026-09-16, by the builder, and said plainly because this
   * is a tester's test. The assertion is untouched. It built a stopped run by
   * putting the clock 99 minutes back, and the fix for the sibling finding
   * ("a run picked up after a closed laptop") means the clock no longer stops
   * anything: it is working time now. So the stop is built the new way, from
   * time actually spent, and the message is checked exactly as before.
   */
  const v = check(
    { cost: { reading: { seconds: 99 * 60, input: 0, output: 0, pages: 0 } } },
    { stage: "reading", startedAt: new Date(Date.now() - 99 * 60_000) },
  );
  assert.ok(v, "a run that worked 99 minutes was not stopped at all");
  assert.doesNotMatch(
    v!.say,
    /carry on from what it already found|pick up where/i,
    v!.say,
  );
});

// ---------------------------------------------------------------------------
// The comparison grid is the thing the customer reads. It is checked too.
// ---------------------------------------------------------------------------

test("breakit: a traffic claim in a grid cell never reaches the stored document", async () => {
  const columns = ["The Barber Shop Shrewsbury", "ARMANDO Barbershop"];

  const { state } = await run({
    comparison: {
      comparison: [
        {
          area: "pricing",
          columns,
          rows: [
            {
              attribute: "How busy they are",
              cells: [
                { value: "About 4,000 visitors a month to their site", from: 1 },
                { value: "They rank second on Google for barber Shrewsbury", from: 1 },
              ],
            },
          ],
        },
      ],
    },
    battlecard: cleanNarrative,
  });

  const body = buildBody(state);
  if (hollow(body)) return; // refused, which is the right answer

  const onThePage = (body?.grid ?? [])
    .flatMap((g) => g.rows)
    .flatMap((r) => r.cells)
    .map((c) => c.value)
    .filter(Boolean)
    .join(". ");

  assert.deepEqual(findTrafficClaims(onThePage), [], `traffic claim stored: ${onThePage}`);
  assert.equal(findRankClaims(onThePage), false, `rank claim stored: ${onThePage}`);
});

test("breakit: where you win and where they win are checked like everything else", async () => {
  const { state } = await run({
    comparison: { comparison: recorded.grid },
    battlecard: {
      ...cleanNarrative,
      where_they_win: [
        {
          point: "They are seen more",
          detail: "NO.1 BARBERS ranks first on Google and takes most of the traffic in town.",
        },
      ],
      where_you_win: [
        { point: "Your reviews", detail: "Sarah Wilkinson wrote that your fades are the best in town." },
      ],
    },
  });

  const body = buildBody(state);
  if (hollow(body)) return;

  const columns = [...(body?.standing?.winning ?? []), ...(body?.standing?.losing ?? [])]
    .map((s) => `${s.point}. ${s.detail}`)
    .join(" ");

  assert.equal(findRankClaims(columns), false, `rank claim stored: ${columns}`);
  assert.deepEqual(findTrafficClaims(columns), [], `traffic claim stored: ${columns}`);
  assert.deepEqual(findNamedReviewers(columns), [], `named reviewer stored: ${columns}`);
});

// ---------------------------------------------------------------------------
// The watchdog. It must stop a stuck run and leave a healthy one alone.
// ---------------------------------------------------------------------------

test("breakit: a run picked up after a closed laptop is not killed on sight", () => {
  // The requirement is that each step saves, so a closed laptop does not lose
  // the run. This run has done two steps' work and was left alone overnight.
  const v = check(
    { spent: { searching: 1, listings: 1 }, saidSame: 1 },
    { stage: "choosing", startedAt: new Date(Date.now() - 14 * 60 * 60 * 1000) },
  );
  assert.equal(v, null, `a healthy resumed run was stopped: ${v?.why}`);
});

test("breakit: a run that is genuinely still is stopped", () => {
  const v = check({ saidSame: 5 }, { stage: "checking", startedAt: new Date() });
  assert.ok(v, "a run repeating itself five times was not stopped");
});

// ---------------------------------------------------------------------------
// Hostile names.
// ---------------------------------------------------------------------------

test("breakit: a business name full of regex characters does not break the run", async () => {
  const nasty = "Bob's (Cuts) [Ltd] +$^*?|\\ & <script>alert(1)</script>";
  const started = Date.now();
  const { stage, state } = await run(
    { comparison: { comparison: recorded.grid }, battlecard: cleanNarrative },
    aBusiness({ name: nasty }),
  );
  const took = Date.now() - started;

  assert.ok(took < 5000, `took ${took}ms`);
  assert.equal(stage, "done", `ended at ${stage}: ${state.reason}`);
  assert.equal(state.grid?.[0]?.columns[0], nasty, "the customer's own column lost its name");
});

test("breakit: a right to left name does not carry an override into the document", async () => {
  // U+202E flips everything printed after it. A name carrying one turns the
  // rest of the row backwards on the page.
  const rtl = "‮محل الحلاقة";
  const { stage, state } = await run(
    { comparison: { comparison: recorded.grid }, battlecard: cleanNarrative },
    aBusiness({ name: rtl }),
  );

  assert.equal(stage, "done", `did not finish, so this proves nothing: ${state.reason}`);
  const stored = JSON.stringify(buildBody(state));
  assert.match(stored, /الحلاقة/, "the name never reached the document, so this proves nothing");
  assert.doesNotMatch(
    stored,
    /[‪-‮⁦-⁩]/,
    "a bidirectional override survived into the stored document",
  );
});

test("breakit: an enormous business name does not hang the run", async () => {
  const huge = "A".repeat(1_000_000);
  const started = Date.now();
  const { stage } = await run(
    { comparison: { comparison: recorded.grid }, battlecard: cleanNarrative },
    aBusiness({ name: huge }),
  );
  const took = Date.now() - started;
  assert.ok(took < 10_000, `took ${took}ms and ended at ${stage}`);
});
