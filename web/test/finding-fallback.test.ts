/**
 * Looking a competitor up when the listing left no link.
 *
 * MEASURED, NOT ASSUMED
 * Fresha's St Albans listing was fetched on 2026-09-18, robots checked first.
 * 217KB of server HTML carrying schema.org JSON-LD: a name and a postal address
 * per business and nothing else. 300 anchors, none pointing at a venue page,
 * and the string "price" absent from the page entirely. So `fetchable()`
 * rightly stores no url, and the plain search by name is the only route left.
 *
 * That search is a lottery. For one of the five it returned a Cylex directory
 * that refused us; for another a booking profile read cleanly at 12,000
 * characters. So when it finds nobody, we ask again on the hosts we had
 * already decided to trust for this trade and town.
 *
 * `knownHosts` is `whereToLook(...).hosts`, already filtered of blocked hosts.
 * There is deliberately no second list of platforms anywhere.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { advance, type RunState, type Stage } from "../tools/competitor-tracker/stages.ts";
import { aBusiness, fakeContext, type Recorded } from "./fake.ts";
import { blockedHosts } from "../tools/sources/uk-directories.ts";

const recorded: Recorded = {
  searchResults: [{ term: "x", results: [] }],
  pages: {},
} as unknown as Recorded;

const stateFor = (knownHosts: string[]) =>
  ({
    profile: { name: "You", town: "St Albans", trade: "hairdresser", missing: [] },
    competitors: [{ name: "Nobody Can Find Me", claims: {} }],
    queue: [{ name: "you", url: "https://example.com" }],
    knownHosts,
  }) as unknown as RunState;

test("a competitor nothing turns up for is asked about again, on trusted hosts only", async () => {
  const { ctx, calls } = fakeContext(recorded);
  await advance("finding" as Stage, stateFor(["booksy.com", "fresha.com"]), aBusiness(), ctx);

  assert.equal(calls.search.length, 2, "the fallback did not happen, or happened more than once");
  const second = calls.search[1].join(" ");
  assert.match(second, /Nobody Can Find Me/, "the fallback asked about somebody else");
  assert.match(second, /site:booksy\.com/);
  assert.match(second, /site:fresha\.com/);
});

test("with no trusted hosts there is no second search, rather than the first one again", async () => {
  /* A site-restricted search with no sites in it is the first search repeated:
     the same cost and no new answer. */
  const { ctx, calls } = fakeContext(recorded);
  await advance("finding" as Stage, stateFor([]), aBusiness(), ctx);
  assert.equal(calls.search.length, 1);
});

test("the fallback searches nowhere we have recorded as blocked", async () => {
  /**
   * knownHosts comes off whereToLook, which filters blockedHosts already. This
   * asserts the property at the point it matters rather than trusting that it
   * was filtered upstream: a search for a page we are not allowed to open
   * spends a search to learn something already written down.
   */
  const { ctx, calls } = fakeContext(recorded);
  await advance("finding" as Stage, stateFor(["booksy.com", "fresha.com"]), aBusiness(), ctx);
  const everySearch = calls.search.map((t) => t.join(" ")).join(" ");
  for (const host of blockedHosts()) {
    assert.ok(!everySearch.includes(`site:${host}`), `searched ${host}, which is blocked`);
  }
});

test("social is never a fallback target", async () => {
  /* Instagram and Facebook both answer "their robots.txt asks us not to read
     this page", verified by fetching them rather than assumed. They are tier
     three in tierOf and must never be searched for either. */
  const { ctx, calls } = fakeContext(recorded);
  await advance("finding" as Stage, stateFor(["booksy.com", "fresha.com"]), aBusiness(), ctx);
  const everySearch = calls.search.map((t) => t.join(" ")).join(" ");
  for (const s of ["facebook.com", "instagram.com", "tiktok.com", "x.com", "twitter.com"]) {
    assert.ok(!everySearch.includes(s), `${s} was searched`);
  }
});

test("it is one extra search and never a loop", async () => {
  /* The stage returns after one competitor either way, so the cap on this is
     structural rather than a counter somebody has to remember to increment. */
  const { ctx, calls } = fakeContext(recorded);
  const step = await advance("finding" as Stage, stateFor(["booksy.com"]), aBusiness(), ctx);
  assert.ok(calls.search.length <= 2, `${calls.search.length} searches for one competitor`);
  assert.deepEqual(step.state.lookedUp, ["Nobody Can Find Me"]);
});

test("a competitor the first search places is not asked about twice", () => {
  /**
   * The cost guarantee, and the condition this fallback hangs on.
   *
   * Removing `!found` has to turn this red or the guard is decoration. It was
   * decoration once already today: the first version of this test used a
   * fixture the fake never resolves, so forcing the fallback to fire always
   * changed nothing and the test passed either way.
   */
  return (async () => {
    const findable: Recorded = {
      searchResults: [
        {
          term: "x",
          results: [
            {
              url: "https://booksy.com/en-gb/1_findable-salon_hair_2_st-albans",
              title: "Findable Salon, St Albans",
              snippet: "Book Findable Salon in St Albans.",
            },
          ],
        },
      ],
      pages: {},
    } as unknown as Recorded;

    const { ctx, calls } = fakeContext(findable);
    const state = {
      profile: { name: "You", town: "St Albans", trade: "hairdresser", missing: [] },
      competitors: [{ name: "Findable Salon", claims: {} }],
      queue: [{ name: "you", url: "https://example.com" }],
      knownHosts: ["booksy.com", "fresha.com"],
    } as unknown as RunState;

    const step = await advance("finding" as Stage, state, aBusiness(), ctx);

    assert.equal(calls.search.length, 1, "it searched again for one it had already placed");
    assert.ok(
      (step.state.queue ?? []).some((q) => q.name === "Findable Salon"),
      "the fixture does not actually resolve, so this test proves nothing",
    );
  })();
});
