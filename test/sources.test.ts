import { test } from "node:test";
import assert from "node:assert/strict";
import {
  belongsTo,
  cite,
  citeRules,
  dropMisattributed,
  dropMisattributedClaims,
  expand,
  numberPages,
  type Page,
} from "../tools/competitor-tracker/sources.ts";

/**
 * Page numbers instead of retyped urls.
 *
 * The model used to write a full url and date into every cell, claim and piece
 * of evidence, about 230 times a card, for roughly ten thousand output tokens.
 * Output tokens are the runtime at about a hundred a second, so that was a
 * minute and a half of every run spent retyping addresses we already held.
 *
 * The risk mattered more than the time. This codebase already records, in the
 * search step, that a model asked to repeat twenty urls will eventually repair
 * one. We were asking two hundred times a card. The tests below are mostly
 * about that: a number the model invents must expand to nothing, never to a
 * plausible url that reads like a source.
 */

const PAGES: Page[] = [
  { url: "https://booksy.com/en-gb/s/barber/1227928_shrewsbury", fetchedOn: "2026-09-15" },
  { url: "https://booksy.com/en-gb/42390_no-1-barbers", fetchedOn: "2026-09-15" },
  { url: "https://www.shrewsburybarber.co.uk/", fetchedOn: "2026-09-14" },
];

// ---------------------------------------------------------------------------
// Numbering.
// ---------------------------------------------------------------------------

test("pages are numbered from one, in the order given", () => {
  const list = numberPages(PAGES);
  assert.equal(list.length, 3);
  assert.equal(expand(list, 1)?.url, PAGES[0].url);
  assert.equal(expand(list, 3)?.url, PAGES[2].url);
});

test("the same page read twice gets one number", () => {
  // A page can arrive as both the listing and a competitor's own page. Two
  // numbers for one page is two ways to cite the same fact, and it shifts every
  // number after it.
  const list = numberPages([PAGES[0], PAGES[1], PAGES[0]]);
  assert.equal(list.length, 2);
  assert.equal(expand(list, 2)?.url, PAGES[1].url);
});

test("each number keeps the date that page was read", () => {
  // Not today's date. A run resumed tomorrow must not restamp yesterday's
  // reading, or every source silently claims to be fresher than it is.
  assert.equal(expand(numberPages(PAGES), 3)?.fetchedOn, "2026-09-14");
});

// ---------------------------------------------------------------------------
// A number we did not hand out expands to nothing.
// ---------------------------------------------------------------------------

test("an invented number expands to nothing, not to a url", () => {
  const list = numberPages(PAGES);
  for (const bad of [0, -1, 4, 99, 1.5, NaN, Infinity, null, undefined, "", "two", {}, []]) {
    assert.equal(expand(list, bad), null, `expand(${JSON.stringify(bad)}) should be null`);
  }
});

test("a number written as text still works", () => {
  // Models return "2" often enough that refusing it would throw away a good
  // citation over its type.
  assert.equal(expand(numberPages(PAGES), "2")?.url, PAGES[1].url);
});

// ---------------------------------------------------------------------------
// Expanding a whole answer.
// ---------------------------------------------------------------------------

test("every from becomes a source, at every depth", () => {
  // The same citation shape appears in grid cells, in per business claims and
  // in action evidence, at three different depths. This is why it is a walk and
  // not three separate expansions: a forgotten one is an unsourced claim.
  const answer = {
    comparison: [
      {
        area: "pricing",
        columns: ["You", "NO.1"],
        rows: [{ attribute: "Cut", cells: [{ value: "£15", from: 3 }, { value: "£18", from: 2 }] }],
      },
    ],
    competitors: [
      { name: "NO.1", claims: { pricing: [{ text: "Haircut £18", value: "£18", from: 2 }] } },
    ],
    actions: [{ headline: "Do it", evidence: [{ text: "A fact", value: null, from: 1 }] }],
  };

  const out = cite(answer, numberPages(PAGES)) as typeof answer & Record<string, never>;

  const cell = (out.comparison[0].rows[0].cells[0] as unknown) as { source: { url: string } };
  assert.equal(cell.source.url, PAGES[2].url);

  const claim = (out.competitors[0].claims.pricing[0] as unknown) as { source: { url: string } };
  assert.equal(claim.source.url, PAGES[1].url);

  const ev = (out.actions[0].evidence[0] as unknown) as { source: { url: string } };
  assert.equal(ev.source.url, PAGES[0].url);
});

test("the number itself is not left behind next to the source", () => {
  const out = cite({ value: "£15", from: 1 }, numberPages(PAGES)) as Record<string, unknown>;
  assert.ok(!("from" in out), "from survived into the stored card");
  assert.deepEqual(Object.keys(out).sort(), ["source", "value"]);
});

test("an invented number leaves the claim unsourced rather than sourced wrongly", () => {
  // This is the whole point. An unsourced claim fails a check we already have.
  // A wrongly sourced one is a false statement about a real named business that
  // looks exactly like a true one.
  const out = cite({ value: "£15", from: 99 }, numberPages(PAGES)) as unknown as { source: unknown };
  assert.equal(out.source, null);
});

test("anything without a from is passed through untouched", () => {
  const before = { area: "pricing", columns: ["You"], note: "A note", rows: [], n: 4, ok: true };
  assert.deepEqual(cite(before, numberPages(PAGES)), before);
});

test("nulls and empty lists survive the walk", () => {
  assert.equal(cite(null, PAGES), null);
  assert.deepEqual(cite([], PAGES), []);
  assert.deepEqual(cite({ cells: [] }, PAGES), { cells: [] });
  assert.deepEqual(cite({ value: null, from: null }, numberPages(PAGES)), { value: null, source: null });
});

// ---------------------------------------------------------------------------
// What the model is told.
// ---------------------------------------------------------------------------

test("the numbered list shown to the model matches the list used to expand", () => {
  // If these two ever drift by one, every price is attributed to the wrong
  // business and every one of them still looks sourced.
  const list = numberPages(PAGES);
  const shown = citeRules(list);

  for (const [i, page] of list.entries()) {
    assert.ok(shown.includes(`[${i + 1}] ${page.url}`), `page ${i + 1} missing from the prompt`);
    assert.equal(expand(list, i + 1)?.url, page.url);
  }
});

test("the model is told not to write urls", () => {
  const shown = citeRules(numberPages(PAGES));
  assert.match(shown, /never by url/i);
  assert.match(shown, /Do not write urls/i);
});

// ---------------------------------------------------------------------------
// Whose page is this? Added 2026-09-16.
// ---------------------------------------------------------------------------

/**
 * A number that is real is not the same as a number that is right.
 *
 * `expand` refusing an invented number stops an invented url, and that was
 * tested above and passed. It says nothing about whether the page it did
 * expand has anything to do with the business the fact is about, and until an
 * independent test pass on 2026-09-16 nothing else asked either. The result
 * was a genuine, live, clickable Booksy url under the wrong shop's name.
 *
 * That is worse than an invented url, not better. An invented one breaks when
 * somebody clicks it. This one opens a real page for a real business and looks
 * checked, so an owner prices against a rival who is not their rival.
 *
 * It sat in the join between two things that were each well tested on their
 * own. That is where to look next time.
 */

const OWNED: Page[] = [
  { url: "https://booksy.com/town-listing", fetchedOn: "2026-09-16", about: null },
  { url: "https://booksy.com/no-1-barbers", fetchedOn: "2026-09-16", about: "NO.1 BARBERS" },
  { url: "https://shrewsburybarber.co.uk/", fetchedOn: "2026-09-16", about: "The Barber Shop Shrewsbury" },
];

test("a page read for one business cannot source a fact about another", () => {
  assert.equal(belongsTo(OWNED, "https://booksy.com/no-1-barbers", "NO.1 BARBERS"), true);
  assert.equal(belongsTo(OWNED, "https://booksy.com/no-1-barbers", "The Barber Shop Shrewsbury"), false);
});

test("a page covering the whole town can source a fact about anyone in it", () => {
  // The listing prints every barber in Shrewsbury. Refusing it would throw away
  // most of the real citations this product has.
  for (const who of ["NO.1 BARBERS", "The Barber Shop Shrewsbury", "Someone Else"]) {
    assert.equal(belongsTo(OWNED, "https://booksy.com/town-listing", who), true, who);
  }
});

test("a url we never read belongs to nobody", () => {
  // We cannot say whose it is, and "we do not know" must not read as "yes".
  assert.equal(belongsTo(OWNED, "https://booksy.com/never-read-this", "NO.1 BARBERS"), false);
  assert.equal(belongsTo(OWNED, null, "NO.1 BARBERS"), false);
  assert.equal(belongsTo(OWNED, "", "NO.1 BARBERS"), false);
});

test("names match past case and punctuation", () => {
  // The grid matches columns the same loose way, so this has to agree with it
  // or a business passes there and fails here.
  assert.equal(belongsTo(OWNED, "https://booksy.com/no-1-barbers", "no1 barbers"), true);
  assert.equal(belongsTo(OWNED, "https://booksy.com/no-1-barbers", "NO·1 BARBERS!"), true);
});

test("a page read for two businesses stops belonging to either", () => {
  // One page listing two shops can honestly source a fact about both. Keeping
  // the first name would silently refuse the second one's real citation.
  const list = numberPages([
    { url: "https://shared", fetchedOn: "2026-09-16", about: "A" },
    { url: "https://shared", fetchedOn: "2026-09-16", about: "B" },
  ]);
  assert.equal(list.length, 1);
  assert.equal(belongsTo(list, "https://shared", "A"), true);
  assert.equal(belongsTo(list, "https://shared", "B"), true);
});

test("a cell sourced to someone else's page is blanked, not corrected", () => {
  // Blanked, because we cannot know which page the fact really came from and
  // guessing is how the wrong url got there. A blank cell is a state the
  // product already has: not everybody publishes everything.
  const grids = [
    {
      area: "pricing",
      columns: ["The Barber Shop Shrewsbury", "NO.1 BARBERS"],
      rows: [
        {
          attribute: "Classic cut",
          cells: [
            { value: "£15", source: { url: "https://booksy.com/no-1-barbers", fetchedOn: "2026-09-16" } },
            { value: "£18", source: { url: "https://booksy.com/no-1-barbers", fetchedOn: "2026-09-16" } },
          ],
        },
      ],
    },
  ];

  const { grids: out, dropped } = dropMisattributed(grids, OWNED);
  assert.equal(dropped, 1, "the misattributed cell was not caught");

  // Column 0 is the customer, sourced to a competitor's page. Gone.
  assert.equal(out[0].rows[0].cells[0].value, null);
  assert.equal(out[0].rows[0].cells[0].source, null);

  // Column 1 is NO.1, sourced to NO.1's own page. Untouched.
  assert.equal(out[0].rows[0].cells[1].value, "£18");
  assert.equal(out[0].rows[0].cells[1].source?.url, "https://booksy.com/no-1-barbers");
});

test("a cell that was already blank is left alone and not counted", () => {
  const grids = [
    {
      area: "pricing",
      columns: ["NO.1 BARBERS"],
      rows: [{ attribute: "Beard trim", cells: [{ value: null, source: null }] }],
    },
  ];
  const { dropped } = dropMisattributed(grids, OWNED);
  assert.equal(dropped, 0);
});

test("a claim sourced to someone else's page is dropped", () => {
  const competitors = [
    {
      name: "NO.1 BARBERS",
      claims: {
        pricing: [
          { text: "Theirs", source: { url: "https://booksy.com/no-1-barbers", fetchedOn: "2026-09-16" } },
          { text: "Somebody else's", source: { url: "https://shrewsburybarber.co.uk/", fetchedOn: "2026-09-16" } },
          { text: "The town's", source: { url: "https://booksy.com/town-listing", fetchedOn: "2026-09-16" } },
        ],
      },
    },
  ];

  const { competitors: out, dropped } = dropMisattributedClaims(competitors, OWNED);
  assert.equal(dropped, 1);
  assert.deepEqual(out[0].claims.pricing.map((c) => c.text), ["Theirs", "The town's"]);
});

test("a claim with no source is left for the guards, not quietly removed", () => {
  // Removing it here would hide an unsourced claim rather than fail on it, and
  // the guards are the thing that is supposed to see it.
  const competitors = [{ name: "NO.1 BARBERS", claims: { pricing: [{ text: "No source", source: null }] } }];
  const { competitors: out, dropped } = dropMisattributedClaims(competitors, OWNED);
  assert.equal(dropped, 0);
  assert.equal(out[0].claims.pricing.length, 1);
});
