import { test } from "node:test";
import assert from "node:assert/strict";
import { advance, type RunState } from "../tools/competitor-tracker/stages.ts";
import type { Business, ToolContext } from "../tools/types.ts";

/**
 * A refused card is reworded once before it is thrown away.
 *
 * Across four real runs the guards refused four cards for four different
 * sentences, each a phrasing problem in an otherwise sound battlecard. Tuning
 * the prompt fixed one and the next run failed somewhere else. The guards
 * already know exactly what is wrong, so they now say so and it gets fixed.
 */

const business: Business = {
  id: "1", website: "https://x.co.uk", name: "The Barber Shop", trade: "barber",
  town: "Shrewsbury", address: null, headlinePrice: null, oneLiner: null,
  reach: "nearby", foundVia: [], knownCompetitor: null,
};

/** A card breaking exactly one rule: a count with no boundary. */
const brokenCard = {
  business: "The Barber Shop",
  ranAt: new Date().toISOString(),
  competitors: [
    {
      name: "HINCES",
      addedByCustomer: false,
      claims: {
        reviews: [
          {
            text: "They have hundreds of reviews and you have none.",
            value: 2461,
            source: { url: "https://booksy.com/x", fetchedOn: new Date().toISOString().slice(0, 10) },
          },
        ],
      },
    },
  ],
  actions: [1, 2, 3].map((rank) => ({
    rank,
    area: "reviews" as const,
    headline: `Do thing ${rank}`,
    why: "Because of what we read.",
    evidence: [
      {
        text: "HINCES shows 2,461 reviews on Booksy",
        value: 2461,
        source: { url: "https://booksy.com/x", fetchedOn: new Date().toISOString().slice(0, 10) },
      },
    ],
  })),
  sources: [{ url: "https://booksy.com/x", fetchedOn: new Date().toISOString().slice(0, 10) }],
  unreadable: [],
};

const noContext = (): ToolContext => ({
  read: async () => { throw new Error("should not read"); },
  think: async () => { throw new Error("should not think"); },
  search: async () => { throw new Error("should not search"); },
  progress: () => {},
});

test("a card that breaks a rule goes to be fixed, not thrown away", async () => {
  const out = await advance("checking", { card: brokenCard } as RunState, business, noContext());
  assert.equal(out.stage, "fixing");
  assert.ok(out.state.problems?.length, "it carries what was wrong");
  assert.equal(out.state.problems?.[0].rule, "unboundedCounts");
  assert.match(out.state.problems![0].sentences[0], /hundreds of reviews/);
});

test("a clean card goes straight through", async () => {
  const clean = {
    ...brokenCard,
    competitors: [
      {
        ...brokenCard.competitors[0],
        claims: {
          reviews: [
            {
              text: "HINCES shows 2,461 reviews on Booksy",
              value: 2461,
              source: brokenCard.sources[0],
            },
          ],
        },
      },
    ],
  };
  const out = await advance("checking", { card: clean } as RunState, business, noContext());
  assert.equal(out.stage, "done");
});

test("a second failure is a refusal, not another attempt", async () => {
  // A loop that keeps asking spends real money getting nowhere. One repair
  // means the fault is in the wording; two means it is in the facts.
  const out = await advance(
    "checking",
    { card: brokenCard, repairs: 1 } as RunState,
    business,
    noContext(),
  );
  assert.equal(out.stage, "failed");
  assert.match(out.state.reason ?? "", /counted something without saying out of what/);
});

test("the refusal names the rule in words, not as a function name", async () => {
  const out = await advance(
    "checking",
    { card: brokenCard, repairs: 1 } as RunState,
    business,
    noContext(),
  );
  assert.ok(!/unboundedCounts/.test(out.state.reason ?? ""), "no code names in front of a customer");
});

test("nothing built at all is a refusal, not a repair", async () => {
  const out = await advance("checking", {} as RunState, business, noContext());
  assert.equal(out.stage, "failed");
});
