import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dropBad,
  sayDropped,
  stillWrong,
  worthShowing,
} from "../tools/competitor-tracker/dropActions.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { advance, type RunState, type Stage } from "../tools/competitor-tracker/stages.ts";
import { droppable, find, read, write } from "../tools/competitor-tracker/mend.ts";
import { validateBattlecard } from "../../Agents/Competitor Tracker/src/guards.ts";
import { asText } from "../tools/competitor-tracker/stages.ts";
import { aBusiness , ownerAgrees} from "./fake.ts";
import type { ToolContext } from "../tools/types.ts";

/**
 * Does mending converge?
 *
 * Six live runs failed at the checks today, every one of them at the last step.
 * The repair was handed the whole card, rewrote sixty sentences to fix one, and
 * introduced a new fault while fixing the old one. Every fix was a fresh chance
 * to break something, so it could never settle.
 *
 * The sentences below are real: taken from those runs, not written by me.
 */

const REFUSED = JSON.parse(
  readFileSync(join(import.meta.dirname, "fixtures", "refused.json"), "utf8"),
) as { rule: string; sentence: string }[];

const day = new Date().toISOString().slice(0, 10);
const source = { url: "https://booksy.com/en-gb/s/barber/1227928_shrewsbury", fetchedOn: day };

/** A card carrying one real refused sentence, everything else sound. */
function cardWith(sentence: string) {
  return {
    business: "The Barber Shop Shrewsbury",
    ranAt: new Date().toISOString(),
    competitors: [
      {
        name: "HINCES",
        addedByCustomer: false,
        claims: {
          reviews: [
            { text: "HINCES shows 2,461 reviews on Booksy", value: 2461, source },
            { text: sentence, value: 156, source },
          ],
        },
      },
    ],
    actions: [1, 2, 3].map((rank) => ({
      rank,
      area: "reviews" as const,
      headline: `Ask every customer for a review, week ${rank}`,
      why: "Because of what we read on Booksy.",
      evidence: [{ text: "HINCES shows 2,461 reviews on Booksy", value: 2461, source }],
    })),
    sources: [source],
    unreadable: [],
  };
}

const refusedBy = (card: unknown) =>
  Object.entries(validateBattlecard(card as never, asText(card as never), new Date()))
    .filter(([, v]) => (Array.isArray(v) ? v.length > 0 : v === true))
    .map(([k]) => k);

/** A model that mends properly, the way a good answer looks. */
const mender = (reply: (sentence: string) => string | null): ToolContext => ({
  read: async () => { throw new Error("no reading here"); },
  search: async () => { throw new Error("no searching here"); },
  progress: () => {},
  think: async ({ prompt }) => {
    const m = /This sentence was refused:\n\n {4}(.+)\n/.exec(prompt);
    return { sentence: reply(m?.[1] ?? "") };
  },
});

/** Drive checking and fixing until it settles, and count the passes. */
async function settle(card: unknown, ctx: ToolContext) {
  let stage: Stage = "checking";
  let state = { card } as RunState;
  let passes = 0;

  for (let i = 0; i < 20; i++) {
    const step = await advance(stage, state, aBusiness(), ctx);
    stage = step.stage;
    state = ownerAgrees(step) as RunState;
    if (stage === "fixing") passes += 1;
    if (stage === "done" || stage === "failed") break;
  }
  return { stage, state, passes };
}

test("every refused sentence we have actually seen can be located in a card", () => {
  // If a sentence cannot be found there is nothing to mend, and the run refuses
  // the whole card for a wording problem it could have fixed.
  assert.ok(REFUSED.length > 0, "no real refused sentences captured");
  for (const { sentence } of REFUSED) {
    const card = cardWith(sentence);
    assert.ok(find(card as never, sentence).length > 0, `cannot find: ${sentence}`);
  }
});

test("a real refused sentence, properly reworded, settles the card", async () => {
  for (const { sentence } of REFUSED) {
    const card = cardWith(sentence);
    assert.ok(refusedBy(card).includes("unboundedCounts"), `${sentence} should be refused`);

    const { stage, passes } = await settle(
      card,
      mender(() => "156 of the 156 reviews on Booksy are five star"),
    );

    assert.equal(stage, "done", `did not settle: ${sentence}`);
    assert.equal(passes, 1, "one sentence should need one pass");
  }
});

test("a rewrite that is no better ends in the claim being dropped", async () => {
  // The floor. Without it a model that keeps producing refusable sentences
  // loops until the limit and the customer sees nothing.
  const card = cardWith(REFUSED[0].sentence);
  const { stage, state } = await settle(card, mender(() => "Still none below, none at all"));

  assert.equal(stage, "done", "dropping did not settle it");
  const kept = state.card!.competitors[0].claims.reviews!;
  assert.equal(kept.length, 1, "the bad claim should have been cut");
  assert.match(kept[0].text, /2,461 reviews on Booksy/, "the good claim must survive");
});

test("a model that gives up drops the claim rather than looping", async () => {
  const card = cardWith(REFUSED[0].sentence);
  const { stage, state } = await settle(card, mender(() => null));
  assert.equal(stage, "done");
  assert.equal(state.card!.competitors[0].claims.reviews!.length, 1);
});

test("mending one sentence never touches another", async () => {
  const card = cardWith(REFUSED[0].sentence);
  const before = JSON.stringify(card.actions);

  const { state } = await settle(card, mender(() => "156 of 156 reviews on Booksy are five star"));

  assert.equal(
    JSON.stringify(state.card!.actions),
    before,
    "the actions moved while a claim was being mended",
  );
});

test("a headline is never dropped, because an action without one is not an action", () => {
  const card = cardWith("x");
  assert.equal(droppable(card as never, { kind: "action-headline", action: 0 }), false);
  assert.equal(droppable(card as never, { kind: "claim", competitor: 0, area: "reviews", index: 1 }), true);
  // Nor the last piece of evidence: that turns a supported action into an
  // unsupported one, which is a worse fault than the wording.
  assert.equal(droppable(card as never, { kind: "action-evidence", action: 0, index: 0 }), false);
});

test("replacing a sentence does not disturb the card it came from", () => {
  const card = cardWith(REFUSED[0].sentence);
  const frozen = JSON.stringify(card);
  write(card as never, { kind: "claim", competitor: 0, area: "reviews", index: 1 }, "new words");
  assert.equal(JSON.stringify(card), frozen, "the original card was mutated");
});

test("a complaint about the card's shape is not mended for ever", async () => {
  // Too many competitors, or the wrong number of actions. No sentence to fix,
  // so it must refuse rather than spend five passes finding that out.
  const card = { ...cardWith("fine"), actions: [] };
  const { stage, passes } = await settle(card, mender(() => "anything"));
  assert.equal(stage, "failed");
  assert.ok(passes <= 1, `spent ${passes} passes on something it cannot mend`);
});

test("read finds the words at a spot, and null when the card has moved", () => {
  const card = cardWith("a sentence");
  assert.equal(read(card as never, { kind: "claim", competitor: 0, area: "reviews", index: 1 }), "a sentence");
  assert.equal(read(card as never, { kind: "claim", competitor: 9, area: "reviews", index: 0 }), null);
});

test("a model that keeps producing bad sentences still terminates", async () => {
  /**
   * The case that cannot be allowed to loop. Each rewrite is different, so it
   * counts as an improvement and gets written in, and the next check refuses it
   * again. Without a limit this spends real money for ever.
   */
  let n = 0;
  const card = cardWith(REFUSED[0].sentence);
  const { stage, passes } = await settle(
    card,
    mender(() => `Still hundreds of them and none on you, attempt ${++n}`),
  );

  assert.equal(stage, "failed", "it should give up rather than spend for ever");
  assert.ok(passes <= 5, `spent ${passes} passes`);
  assert.ok(n <= 5, `asked the model ${n} times`);
});

test("giving up says which rule, in words, and not a function name", async () => {
  const card = cardWith(REFUSED[0].sentence);
  const { state } = await settle(card, mender(() => "none below, still none below"));
  const said = state.reason ?? "";
  if (said) {
    assert.ok(!/unboundedCounts|findUnbounded/.test(said), `code name shown: ${said}`);
  }
});

test("two refused sentences at once are mended one at a time", async () => {
  // One per pass is what makes it converge. Both should end up sound.
  const card = cardWith(REFUSED[0].sentence);
  card.competitors[0].claims.reviews.push({
    text: "Darwin's has hundreds and you have none",
    value: 692,
    source,
  } as never);

  let i = 0;
  const { stage, passes } = await settle(
    card,
    mender(() => ["156 of 156 reviews on Booksy are five star", "692 of the reviews we read are on Booksy"][i++] ?? "ok"),
  );

  assert.equal(stage, "done", "two sentences did not settle");
  assert.equal(passes, 2, "one pass per sentence");
});

// ---------------------------------------------------------------------------
// One bad action does not take the card with it
// ---------------------------------------------------------------------------

/**
 * The guards were a gate. One action resting on a number nobody could source
 * and the comparison, the two columns and the other two actions went in the bin
 * with it, all built and paid for. That happened to the bakery twice on
 * 2026-09-16, on a different rule each time, and the owner saw nothing both
 * times.
 */
test("an action with no evidence is dropped, and the rest of the card lives", () => {
  const actions = [
    { rank: 1, area: "pricing", headline: "Publish your prices", evidence: [{ value: 1 }] },
    { rank: 2, area: "reviews", headline: "Made this one up", evidence: [] },
    { rank: 3, area: "pricing", headline: "Name a package", evidence: [{ value: 2 }] },
  ] as never[];

  const cut = dropBad(actions, [{ kind: "no-evidence", headline: "Made this one up" }]);

  assert.deepEqual(cut.dropped, ["Made this one up"]);
  assert.equal(cut.kept.length, 2, "the good actions went with the bad one");
  assert.ok(worthShowing(cut));
});

test("what is left is renumbered, not left with a hole where the second was", () => {
  const actions = [
    { rank: 1, area: "pricing", headline: "A", evidence: [{ value: 1 }] },
    { rank: 2, area: "reviews", headline: "B", evidence: [] },
    { rank: 3, area: "pricing", headline: "C", evidence: [{ value: 2 }] },
  ] as never[];

  const cut = dropBad(actions, [{ kind: "no-evidence", headline: "B" }]);
  assert.deepEqual(cut.kept.map((a) => a.rank), [1, 2], "1 and 3 reads as a missing action");
  assert.deepEqual(cut.kept.map((a) => a.headline), ["A", "C"]);
});

test("dropping every action is not a card worth showing", () => {
  // One action is thin and still useful. None means nothing answers "what
  // should I change", which is the question the whole page builds up to.
  const actions = [{ rank: 1, area: "pricing", headline: "A", evidence: [] }] as never[];
  const cut = dropBad(actions, [{ kind: "no-evidence", headline: "A" }]);
  assert.equal(worthShowing(cut), false);
});

test("the owner is told one was left out, in their words not ours", () => {
  const cut = { kept: [], dropped: ["A"] } as never;
  const said = sayDropped(cut)!;
  assert.match(said, /could not back it up/);
  assert.doesNotMatch(said, /guard|rule|evidence check|validate|action problem/i);
});

/**
 * "There should be exactly three, numbered one to three" is the right thing to
 * ask a model for and the wrong thing to hold against a card we shortened
 * ourselves.
 */
test("having dropped one ourselves, we do not then complain there are two", () => {
  const problems = [
    { kind: "wrong-count", count: 2 },
    { kind: "ranks-not-1-2-3", ranks: [1, 2] },
  ] as never[];

  assert.equal(stillWrong(problems, true).length, 0, "it would loop on its own decision");
  assert.equal(stillWrong(problems, false).length, 2, "a model returning two is still wrong");
});
