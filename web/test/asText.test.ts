import { test } from "node:test";
import assert from "node:assert/strict";
import { asText } from "../tools/competitor-tracker/stages.ts";

/**
 * What the guards are given to read.
 *
 * If a field is missed here, every guard that scans words silently stops
 * covering it: the claim is on the screen and no rule ever looks at it. That is
 * how findRankClaims passed five tests while running on nothing.
 */
const card = {
  business: "The Barber Shop",
  ranAt: "2026-09-15T09:00:00Z",
  competitors: [
    { name: "HINCES", addedByCustomer: false,
      claims: { pricing: [{ text: "Classic cut £35", value: 35, source: { url: "u", fetchedOn: "2026-09-15" } }] } },
  ],
  actions: [
    { rank: 1, area: "reviews" as const, headline: "Ask for reviews",
      why: "They have 2,461 and you have none",
      evidence: [{ text: "HINCES has 2,461", value: 2461, source: { url: "u", fetchedOn: "2026-09-15" } }],
      deferred: "We cannot tell you to cut a price" },
  ],
  sources: [{ url: "u", fetchedOn: "2026-09-15" }],
  unreadable: [{ name: "Vale", reason: "forbidden" as const }],
};

test("every word a customer could read is given to the guards", () => {
  const out = asText(card as never);
  for (const must of [
    "The Barber Shop", "HINCES", "Classic cut £35",
    "Ask for reviews", "They have 2,461 and you have none",
    "HINCES has 2,461", "We cannot tell you to cut a price", "Vale",
  ]) {
    assert.ok(out.includes(must), `missing from what the guards scan: ${must}`);
  }
});

test("an empty card does not throw", () => {
  const bare = { business: "x", ranAt: "", competitors: [], actions: [], sources: [], unreadable: [] };
  assert.doesNotThrow(() => asText(bare as never));
});

test("a competitor with no claims at all does not throw", () => {
  const thin = { ...card, competitors: [{ name: "Quiet", addedByCustomer: false, claims: {} }] };
  assert.match(asText(thin as never), /Quiet/);
});
