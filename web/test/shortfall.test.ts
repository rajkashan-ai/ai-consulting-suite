import { test } from "node:test";
import assert from "node:assert/strict";
import { WANTED, areasMissing, funnelReads, shortfall, type Funnel } from "../tools/competitor-tracker/shortfall.ts";
import { GRID_AREAS } from "../tools/competitor-tracker/stages.ts";

/**
 * Fewer than five competitors: is that the town, or is it us?
 *
 * Raj asked it on 2026-09-16 and it is the right question. A run that compares
 * one business could mean there is genuinely only one other barber within
 * reach, or that there were fifteen and our own code threw fourteen away. On
 * the page those look identical, so a bug in our research reads to an owner as
 * a fact about their market, and they may price against it.
 *
 * Not hypothetical: that same day, a barber trading as "Cuts" lost both "Cuts
 * Above" and "Precision Cuts" to our own matching rule.
 *
 * The real run for scale: 36 names found, 15 distinct businesses, 5 compared.
 * Five is a cap, not a ceiling.
 */

const funnel = (over: Partial<Funnel> = {}): Funnel => ({
  found: 36,
  notYou: 36,
  rightTrade: 34,
  distinct: 15,
  compared: 5,
  ...over,
});

test("a full comparison says nothing, because there is nothing to say", () => {
  assert.deepEqual(shortfall(funnel(), "barber", "Shrewsbury"), { kind: "full" });
});

test("more distinct businesses than we compared is our fault, not the town's", () => {
  // Nothing legitimate discards a business between having it and comparing it.
  const v = shortfall(funnel({ compared: 1 }), "barber", "Shrewsbury");
  assert.equal(v.kind, "ours");
  assert.match((v as { why: string }).why, /compared 1 of 15/);
});

test("a genuinely small town is a finding, and is said as one", () => {
  // Two barbers in the whole town is worth knowing. It is not a gap and it must
  // not read like one.
  const v = shortfall(funnel({ found: 3, notYou: 2, rightTrade: 2, distinct: 2, compared: 2 }), "barber", "Ludlow");
  assert.equal(v.kind, "town");
  assert.match((v as { say: string }).say, /Ludlow/);
  assert.match((v as { say: string }).say, /all we could find/);
});

test("the one competitor case reads as a fact, not an apology", () => {
  const v = shortfall(funnel({ found: 2, notYou: 1, rightTrade: 1, distinct: 1, compared: 1 }), "farrier", "Clun");
  assert.equal(v.kind, "town");
  const say = (v as { say: string }).say;
  assert.match(say, /the one other farrier/);
  assert.match(say, /worth knowing/);
  assert.doesNotMatch(say, /sorry|unfortunately|could not|failed/i);
});

test("exactly at the line is a full comparison", () => {
  assert.equal(shortfall(funnel({ compared: WANTED }), "barber", "x").kind, "full");
  assert.equal(shortfall(funnel({ compared: WANTED - 1, distinct: WANTED }), "barber", "x").kind, "ours");
});

test("the count we lost is never shown to the owner", () => {
  // "compared 1 of 15" is ours to act on. An owner reading it learns that we
  // are broken and nothing about their market.
  const v = shortfall(funnel({ compared: 1 }), "barber", "Shrewsbury");
  assert.ok(!("say" in v), "an owner is shown our internal count");
});

test("a missing trade or town does not produce a sentence with a hole in it", () => {
  const v = shortfall(funnel({ found: 2, notYou: 2, rightTrade: 2, distinct: 2, compared: 2 }), null, null);
  const say = (v as { say: string }).say;
  assert.doesNotMatch(say, /null|undefined|\s{2,}/);
});

// ---------------------------------------------------------------------------
// The four areas.
// ---------------------------------------------------------------------------

test("all four areas say nothing", () => {
  assert.equal(areasMissing(GRID_AREAS, [...GRID_AREAS]), null);
});

test("a missing area is named, so it is not mistaken for nobody publishing", () => {
  const said = areasMissing(GRID_AREAS, ["pricing", "channels", "blindspots"]);
  assert.match(said ?? "", /reviews/);
  assert.match(said ?? "", /Everything else here is unaffected/);
});

test("several missing areas read as a sentence, not a list dump", () => {
  // Written against a fixed list rather than GRID_AREAS, because the point is
  // the sentence, not which areas a run happens to ask for today. It used to
  // use GRID_AREAS and broke the moment the areas changed, which tested the
  // configuration and not the wording.
  const said = areasMissing(["pricing", "channels", "reviews", "blindspots"], ["pricing"]);
  assert.match(said ?? "", /channels, reviews and blindspots/);
});

test("the areas message never blames the owner or names our machinery", () => {
  const said = areasMissing(GRID_AREAS, ["pricing"]) ?? "";
  assert.doesNotMatch(said, /you did|your fault|call|token|stage|model|api/i);
});

// ---------------------------------------------------------------------------
// The narrowing, said in one line. Added 2026-09-16.
// ---------------------------------------------------------------------------

test("the narrowing reads as the work it was", () => {
  // The real numbers off the run Raj was looking at.
  const said = funnelReads({
    searches: 5, links: 48, listings: 2,
    found: 32, notYou: 32, rightTrade: 30, distinct: 15, compared: 5,
  });

  assert.match(said ?? "", /ran 5 searches/);
  assert.match(said ?? "", /looked at 48 results/);
  assert.match(said ?? "", /read 2 town listings/);
  assert.match(said ?? "", /found 32 businesses/);
  assert.match(said ?? "", /compared the 5 closest/);
});

test("one of a thing is not said as one things", () => {
  const said = funnelReads({
    searches: 1, links: 3, listings: 1,
    found: 2, notYou: 2, rightTrade: 2, distinct: 2, compared: 2,
  });
  assert.match(said ?? "", /ran 1 search\b/);
  assert.match(said ?? "", /read 1 town listing\b/);
});

test("nothing is claimed about a step that did not happen", () => {
  // A run that read no listing must not say it read zero of them: a sentence
  // about an absence we did not need to mention.
  const said = funnelReads({
    searches: 3, links: 10, listings: 0,
    found: 4, notYou: 4, rightTrade: 4, distinct: 4, compared: 4,
  });
  assert.doesNotMatch(said ?? "", /0 town|no town/i);
});

test("a run with nothing recorded says nothing at all", () => {
  // Old battlecards have no funnel. Silence beats a line of zeroes.
  assert.equal(funnelReads({ found: 0, notYou: 0, rightTrade: 0, distinct: 0, compared: 0 }), null);
});
