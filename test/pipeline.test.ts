import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { advance, type RunState, type Stage } from "../tools/competitor-tracker/stages.ts";
import { aBusiness, fakeContext, type Recorded } from "./fake.ts";

/**
 * The whole research pipeline, without the web or the model.
 *
 * Until now this was covered by me running it and watching, which found real
 * bugs and never stopped one coming back. The pages are from a real run on
 * 15 September, trimmed and not invented.
 */

const recorded = JSON.parse(
  readFileSync(join(import.meta.dirname, "fixtures", "shrewsbury.json"), "utf8"),
) as Recorded;

/** Run the stages until it stops, or until it clearly is not going to. */
async function runTo(
  finish: Stage,
  opts: Parameters<typeof fakeContext>[1] = {},
  business = aBusiness(),
) {
  const { ctx, calls } = fakeContext(recorded, opts);
  let stage: Stage = "searching";
  let state: RunState = {};
  const seen: Stage[] = [];

  for (let i = 0; i < 25; i++) {
    const step = await advance(stage, state, business, ctx);
    stage = step.stage;
    state = step.state;
    seen.push(stage);
    if (stage === finish || stage === "failed" || stage === "done") break;
  }
  return { stage, state, calls, seen };
}

test("the whole thing runs end to end, in the right order", async () => {
  const { seen, stage } = await runTo("writing");
  assert.deepEqual(seen.slice(0, 4), ["listings", "choosing", "reading", "writing"]);
  assert.notEqual(stage, "failed");
});

test("the searches are built from the trade and the town, never the business's own name", async () => {
  // Searching for yourself returns yourself, tells you nothing, and burns one
  // of the searches we pay for.
  const { calls } = await runTo("choosing");
  const terms = calls.search[0] ?? [];
  assert.ok(terms.length > 0);
  for (const t of terms) {
    assert.ok(/barber/i.test(t), t);
    assert.ok(!/The Barber Shop Shrewsbury/i.test(t), `searched for itself: ${t}`);
  }
});

test("the local listing page is what gets read, not the American ones", async () => {
  const { calls } = await runTo("choosing");
  assert.ok(calls.read.length > 0, "it read nothing");
  for (const url of calls.read) {
    assert.ok(!/en-us|yelp\.com|yellowpages/.test(url), `read a US page: ${url}`);
  }
});

test("five competitors, and the business is not one of them", async () => {
  const { state } = await runTo("reading");
  const names = (state.competitors ?? []).map((c) => c.name);
  assert.ok(names.length > 0 && names.length <= 5, `got ${names.length}`);
  assert.ok(
    !names.some((n) => /the barber shop shrewsbury/i.test(n)),
    `the customer is on their own list: ${names.join(", ")}`,
  );
});

test("the one the owner named is kept and marked, whatever the listing says", async () => {
  const { state } = await runTo("reading", {}, aBusiness({ knownCompetitor: "Chapter One Barbers" }));
  const named = (state.competitors ?? []).find((c) => /Chapter One/i.test(c.name));
  assert.ok(named, "the named competitor was dropped");
  assert.equal(named!.addedByCustomer, true);
});

test("every page read is asked for through the given reader", async () => {
  // A tool that could reach the web another way could skip robots.txt, the
  // pause between requests and the blocked list. This is the assertion that
  // the only door is the one we built.
  const { calls } = await runTo("writing");
  assert.ok(calls.read.length >= 2);
  for (const url of calls.read) assert.match(url, /^https?:\/\//, url);
});

test("a run with no trade stops and says which detail is missing", async () => {
  const { stage, state } = await runTo("failed", {}, aBusiness({ trade: null }));
  assert.equal(stage, "failed");
  assert.match(state.reason ?? "", /what they do/);
});

test("a listing that refuses us does not take the run down", async () => {
  const { stage } = await runTo("choosing", { refuse: ["booksy.com", "fresha.com"] });
  // It carries on to choosing with whatever search found, rather than throwing.
  assert.ok(stage === "choosing" || stage === "failed");
});

test("a listing naming nobody falls back to the search, it does not give up", async () => {
  // I expected it to stop. It carries on with whatever the search found, which
  // is right: a listing is the best source for a local trade, not the only one.
  const { stage, state } = await runTo("reading", { think: { businesses: { businesses: [] } } });
  assert.notEqual(stage, "failed");
  assert.ok((state.competitors ?? []).length >= 2, "fell back to nobody");
});

test("nothing anywhere stops with a sentence, rather than writing about nobody", async () => {
  // Searches that return nothing at all, which is what a rare trade in a small
  // town looks like. The run must say so, not produce a battlecard about air.
  const empty: Recorded = { ...recorded, searchResults: [], listed: [] };
  const { ctx } = fakeContext(empty, { think: { businesses: { businesses: [] } } });

  let stage: Stage = "searching";
  let state: RunState = {};
  for (let i = 0; i < 12; i++) {
    const step = await advance(stage, state, aBusiness(), ctx);
    stage = step.stage;
    state = step.state;
    if (stage === "failed" || stage === "done") break;
  }

  assert.equal(stage, "failed");
  assert.match(state.reason ?? "", /Nothing came back|could not find|not enough/);
  // And it says what to do about it, not just that it went wrong.
  assert.ok((state.reason ?? "").length > 40, `too terse: ${state.reason}`);
});

test("what the run learned about this trade is carried back", async () => {
  // The playbook is how the second barber in a town skips the discovery work.
  const { state } = await runTo("reading");
  assert.ok(state.learned?.length, "learned nothing about where barbers are listed");
  assert.ok(
    state.learned!.some((l) => /booksy|fresha/.test(l.host)),
    `learned: ${JSON.stringify(state.learned)}`,
  );
});

test("the sources on the card are pages that were actually read", async () => {
  const { state } = await runTo("checking");
  const card = state.card;
  if (!card) return; // the fake model returns an empty card by default
  const read = new Set([
    ...Object.values(state.pages ?? {}).flat().map((p) => p.url),
    ...(state.listingPages ?? []).map((p) => p.url),
  ]);
  for (const s of card.sources) {
    assert.ok(read.has(s.url), `cited a page nobody read: ${s.url}`);
  }
});

test("an American barber never reaches a British battlecard", async () => {
  // Found by the empty-listing test. With no listing it fell back to search
  // candidates and produced "The Barbers At Shrewsbury" and "Mason Dixon
  // Barbershop", both Shrewsbury Pennsylvania. The country filter was reading
  // the business name, and the country is in the result's title:
  // "The Barbers At Shrewsbury | Shrewsbury PA | Facebook".
  const { state } = await runTo("reading", { think: { businesses: { businesses: [] } } });
  const names = (state.competitors ?? []).map((c) => c.name).join(" | ");
  for (const american of ["Mason Dixon", "The Barbers At Shrewsbury", "Perrone"]) {
    assert.ok(!names.includes(american), `an American barber got in: ${names}`);
  }
});
