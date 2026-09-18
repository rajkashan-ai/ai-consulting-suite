import test from "node:test";
import assert from "node:assert/strict";
import type { Business, ToolContext } from "../tools/types.ts";
import {
  advance,
  knownFacts,
  priceRules,
  pricesTheyPrint,
  type ReadPage,
  type RunState,
  type Stage,
} from "../tools/content-social-planner/stages.ts";
import { unsafe } from "../tools/content-social-planner/scrub.ts";

/**
 * 2026-09-17, from the run record of 6f3c8d7b.
 *
 * A Cut Above publishes twelve prices, £35.00 to £78.00. The writer produced
 * two posts for week one and the guard dropped both:
 *
 *   {"why":"a claim nobody gave us (20%, £24.00)","what":"2026-09-17"}
 *   {"why":"a claim nobody gave us (£126.00, £89.00)","what":"2026-09-20"}
 *
 * Nothing was left, hollow() refused the plan, and fourteen minutes and 11,699
 * tokens produced no document.
 *
 * knownFacts is what the guard checks a price against. The writing prompt never
 * carried it, so the writer was told to cite a page and never told which prices
 * it was allowed to say. The two halves of the same question disagreed, and the
 * customer paid for the disagreement.
 */

const SALON: Business = {
  id: "w1",
  website: "https://acutabovestalbans.co.uk",
  name: "A Cut Above St Albans",
  trade: "hairdresser",
  town: "St. Albans",
  address: "19 High Street, St. Albans, AL3 4EH",
  headlinePrice: null,
  oneLiner: "Independent hair and beauty salon in the centre of St Albans.",
  reach: "town",
  foundVia: [],
  knownCompetitor: null,
  services: [
    { name: "Ladies Cut & Finish - Graduate Stylist", price: "£51.00" },
    { name: "Ladies Cut & Finish - Creative Director", price: "£68.00" },
    { name: "Restyle & Finish - Stylist", price: "£67.00" },
    { name: "Cleanse & Finish (short)", price: "£35.00" },
    { name: "Restyle & Finish - Creative Director", price: "£78.00" },
  ],
};

test("the writer is told which prices it may state", async () => {
  /**
   * Asserted on the prompt, because that is where the gap is. The guard
   * already refuses an invented price and did so twice on the real run: the
   * fault is that nothing told the writer before it spent the tokens.
   */
  const prompts: string[] = [];
  const ctx = {
    read: async (url: string) => ({ ok: true, url, text: "Prices on request.", title: "", fetchedAt: new Date().toISOString(), note: "" }),
    search: async () => [],
    progress: () => {},
    think: async ({ prompt, shape }: { prompt: string; shape?: { name: string } }) => {
      prompts.push(prompt);
      if (shape?.name === "posts") {
        throw new Error("stop here: the prompt is what this test is about");
      }
      return {};
    },
  } as unknown as ToolContext;

  const state = {
    pages: [{ url: SALON.website, ok: true, title: "A Cut Above", text: "Prices on request.", fetchedAt: new Date().toISOString(), note: "" }],
    read: [{ url: SALON.website, ok: true, title: "A Cut Above", text: "Prices on request.", fetchedAt: new Date().toISOString(), note: "" }],
    voice: { words: "Warm and plain." },
    channels: ["instagram", "facebook"],
    slots: [
      { date: "2026-09-17", week: 1, angle: "what-it-costs", channel: "instagram", purpose: "useful" },
      { date: "2026-09-20", week: 1, angle: "how-it-works", channel: "facebook", purpose: "useful" },
    ],
  } as unknown as RunState;

  await advance("writing" as Stage, state, SALON, ctx).catch(() => undefined);

  const asked = prompts.join("\n");
  assert.ok(asked.length > 0, "the writing stage made no model call at all");

  // Every price the guard will accept has to be in front of the writer.
  for (const price of Object.values(knownFacts(SALON).prices)) {
    assert.ok(
      asked.includes(price),
      `the writer was never told ${price} is one of their published prices`,
    );
  }

  // And it has to say that these are the only ones, or listing them is a hint
  // rather than a rule. "£126.00" was two of their prices added together.
  assert.match(
    asked,
    /no other price|only these prices|no price that is not/i,
    "nothing tells the writer these are the only prices it may state",
  );
});

/**
 * 2026-09-18, from the pre-live photo run.
 *
 * The same two halves, one layer further in. The writer is shown the pages;
 * the guard was shown only `business.services`, which holds the twelve prices
 * the sign-up run happened to extract. Their price list publishes far more.
 *
 * So the writer read "Balyage Specialist - from \u00A3141.00" off the page we put
 * in front of it, quoted it exactly, spelling and all, and we threw the post
 * away and told the owner we would not stand behind their own price list.
 */
const PRICE_LIST: ReadPage[] = [
  {
    url: "https://acutabovestalbans.co.uk/services-price-list/",
    ok: true,
    title: "Services & Price List",
    text: [
      "Ladies Cut & Finish - Graduate Stylist \u00A351.00",
      "Balyage Specialist \u2013 from \u00A3141.00",
      "Balyage & Ombre \u2013 from \u00A3126.00",
    ].join("\n"),
    fetchedOn: "2026-09-18",
    note: "",
  },
];

const POST = (words: string) => ({
  words,
  shot: "",
  why: "",
  source: { url: PRICE_LIST[0].url, fetchedOn: "2026-09-18" },
});

const PAGES = [{ url: PRICE_LIST[0].url, fetchedOn: "2026-09-18", what: "your price list" }];

test("a price printed on the page we read is a price the guard knows", () => {
  const printed = pricesTheyPrint(PRICE_LIST);
  // "from" stays in the name. It is not decoration: it says the figure is a
  // starting price, and dropping it would make the label a firmer promise
  // than their page makes.
  assert.deepEqual(printed["balyage specialist \u2013 from"], "\u00A3141.00");
  assert.deepEqual(printed["balyage & ombre \u2013 from"], "\u00A3126.00");
});

test("the guard no longer refuses their own published price", () => {
  const blind = unsafe(
    POST("Balyage Specialist starts from \u00A3141.00.") as never,
    PAGES as never,
    knownFacts(SALON) as never,
  );
  assert.match(String(blind), /141/, "the twelve stored services never knew this price");

  const seeing = unsafe(
    POST("Balyage Specialist starts from \u00A3141.00.") as never,
    PAGES as never,
    knownFacts(SALON, PRICE_LIST) as never,
  );
  assert.equal(seeing, null, "a price on their own price list was refused as an invention");
});

test("a price nobody printed is still an invention", () => {
  // 141 + 126. Arithmetic on real prices is what started all of this.
  const refused = unsafe(
    POST("Both together, \u00A3267.00.") as never,
    PAGES as never,
    knownFacts(SALON, PRICE_LIST) as never,
  );
  assert.match(String(refused), /267/, "a sum of two real prices passed as read");
});

test("the writer is told the prices the guard will hold it to", () => {
  const rules = priceRules(SALON, PRICE_LIST);
  assert.match(rules, /141\.00/, "a price the guard allows was withheld from the writer");
  assert.match(rules, /51\.00/, "a stored price went missing when pages were added");
});

test("a page of nothing but figures cannot run away with the prompt", () => {
  const huge: ReadPage[] = [
    {
      ...PRICE_LIST[0],
      text: Array.from({ length: 500 }, (_, i) => `Thing ${i} \u00A3${i + 1}.00`).join("\n"),
    },
  ];
  assert.ok(Object.keys(pricesTheyPrint(huge)).length <= 80);
});
