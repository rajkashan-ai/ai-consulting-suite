import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBody, hollow, type DocumentBody } from "../tools/competitor-tracker/document.ts";
import type { RunState } from "../tools/competitor-tracker/stages.ts";

/**
 * Is the thing we store worth opening?
 *
 * Every grid test before this one checked `state.grid`, which is the grid on
 * its way to the document. Nothing checked the document. They are assembled in
 * different places, so a run can hold a perfectly good grid in its state and
 * store a hollow one, and no test would have said a word.
 *
 * I walked into exactly that gap an hour ago reading this run back: my own
 * script looked for a field name that does not exist and reported five
 * competitors with no data in them. The product was fine and the reader was
 * wrong, but it is the same failure in the other direction, and it proved there
 * was nothing here that would have told either of us which.
 *
 * The body below is the real one, cut down from the stored Shrewsbury
 * battlecard, so the field names in these tests are the field names the product
 * actually writes.
 */

const REAL: DocumentBody = {
  business: "The Barber Shop Shrewsbury",
  ranAt: "2026-09-15",
  competitors: [
    {
      name: "NO.1 BARBERS",
      claims: {
        pricing: [
          {
            text: "Haircut £18.00, 40 minutes",
            value: "£18.00",
            source: { url: "https://booksy.com/en-gb/42390", fetchedOn: "2026-09-15" },
          },
        ],
      },
    },
  ],
  actions: [
    {
      headline: "Add a fade price to the list already on your website",
      why: "Three of the five publish one and you do not.",
      evidence: [{ url: "https://booksy.com/en-gb/42390", fetchedOn: "2026-09-15" }],
    },
  ],
  grid: [
    {
      area: "pricing",
      columns: ["The Barber Shop Shrewsbury", "NO.1 BARBERS"],
      rows: [
        {
          attribute: "Standard men's cut",
          cells: [
            { value: "Classic Cut £15.00", source: { url: "https://www.shrewsburybarber.co.uk/", fetchedOn: "2026-09-15" } },
            { value: "Haircut £18.00, 40min", source: { url: "https://booksy.com/en-gb/42390", fetchedOn: "2026-09-15" } },
          ],
        },
      ],
    },
  ],
} as unknown as DocumentBody;

/** The real body with one thing broken. */
const broken = (change: (b: DocumentBody) => void): DocumentBody => {
  const copy = structuredClone(REAL);
  change(copy);
  return copy;
};

// ---------------------------------------------------------------------------
// The good one.
// ---------------------------------------------------------------------------

test("the real stored battlecard is accepted", () => {
  assert.equal(hollow(REAL), null);
});

test("the body carries the grid and the standing, which live outside the card", () => {
  // Battlecard is the agent's type and the guards check it. The grid and the
  // standing are kept beside it, which is exactly why they can go missing here
  // without a single guard objecting.
  const state = {
    card: { business: "x", competitors: [], actions: [] },
    grid: REAL.grid,
    standing: { winning: [], losing: [] },
  } as unknown as RunState;

  const body = buildBody(state);
  assert.ok(body?.grid, "the grid was dropped on the way into the document");
  assert.ok(body?.standing, "the standing was dropped on the way into the document");
  assert.equal(body?.business, "x");
});

test("no card means no document, rather than an empty one", () => {
  assert.equal(buildBody({} as RunState), null);
  assert.match(hollow(null) ?? "", /no battlecard/);
});

// ---------------------------------------------------------------------------
// The failures that have actually reached a stored document.
// ---------------------------------------------------------------------------

test("a card with no comparison is refused", () => {
  // The 196,000 token failure. The grid call came back empty, the card was
  // stored without it, and the run said done. Caught at the model now, and
  // caught here as well, because it was stored by a different line of code
  // than the one that was fixed.
  assert.match(hollow(broken((b) => { b.grid = []; })) ?? "", /comparison is missing/);
  assert.match(hollow(broken((b) => { delete b.grid; })) ?? "", /comparison is missing/);
});

test("a comparison with no rows is refused", () => {
  assert.match(hollow(broken((b) => { b.grid![0].rows = []; })) ?? "", /no rows/);
});

test("a comparison where every cell is blank is refused", () => {
  // The shape arrived and the facts did not. On the page this reads as a
  // finished comparison of businesses we know nothing about, which is worse
  // than an honest failure because it looks like an answer.
  const empty = broken((b) => {
    for (const cell of b.grid![0].rows[0].cells) cell.value = null;
  });
  assert.match(hollow(empty) ?? "", /nothing in any of its cells/);

  const blank = broken((b) => {
    for (const cell of b.grid![0].rows[0].cells) cell.value = "   ";
  });
  assert.match(hollow(blank) ?? "", /nothing in any of its cells/);
});

test("one blank cell among real ones is fine", () => {
  // Not everybody publishes everything. "Vale publish no prices" is a result,
  // not a gap, and a rule that refused it would refuse most honest runs.
  const some = broken((b) => { b.grid![0].rows[0].cells[1].value = null; });
  assert.equal(hollow(some), null);
});

test("a row that does not line up with its columns is refused", () => {
  // Cells are read against columns by position. One short, and every price
  // after it is printed against the wrong business: a false claim about a real
  // named company, which is the worst thing this product can do.
  const short = broken((b) => { b.grid![0].rows[0].cells.pop(); });
  const why = hollow(short) ?? "";
  assert.match(why, /1 values for 2 businesses/);
  assert.match(why, /Standard men's cut/);
});

test("a card with no competitors is refused", () => {
  assert.match(hollow(broken((b) => { b.competitors = []; })) ?? "", /no competitors/);
});

test("a card with nothing to do is refused", () => {
  // A comparison with no actions is a page of facts about other people's
  // businesses. The product's job is what to do about them.
  assert.match(hollow(broken((b) => { b.actions = []; })) ?? "", /nothing for them to do/);
});

// ---------------------------------------------------------------------------
// What the customer is told.
// ---------------------------------------------------------------------------

test("every refusal says what is wrong in words an owner can read", () => {
  const reasons = [
    hollow(null),
    hollow(broken((b) => { b.grid = []; })),
    hollow(broken((b) => { b.grid![0].rows = []; })),
    hollow(broken((b) => { b.competitors = []; })),
    hollow(broken((b) => { b.actions = []; })),
  ];

  assert.equal(reasons.filter(Boolean).length, 5);
  for (const why of reasons) {
    assert.doesNotMatch(why!, /undefined|null|\bobject\b|stage|token|jsonb/i, why!);
    assert.ok(why!.length > 12, why!);
  }
});

// ---------------------------------------------------------------------------
// What is not here, and why. Added 2026-09-16.
// ---------------------------------------------------------------------------

test("the reason a comparison is short reaches the document", () => {
  /**
   * The line is worked out in the choosing stage and stored on the run. If it
   * does not get copied into the document, the owner sees a comparison of two
   * businesses with nothing said about it, which is the exact silence this
   * whole piece of work exists to remove.
   *
   * Breaking this on purpose changed no test result until this was written: the
   * rule was tested on its own, and so was the document, and nothing ran across
   * the join. That is the third time today the join was the gap.
   */
  const state = {
    card: { business: "x", competitors: [{ name: "a", claims: {} }], actions: [{ headline: "do" }] },
    grid: REAL.grid,
    shortfallSay: "We compared the one other farrier in Clun we could find and read.",
    areasSay: "We could not build the reviews comparison this time.",
  } as unknown as RunState;

  const body = buildBody(state);
  assert.match(body?.shortfall ?? "", /one other farrier/);
  assert.match(body?.areas ?? "", /reviews/);
});

test("a full comparison carries neither line", () => {
  // Nothing to explain, so nothing said. An empty explanation on a complete
  // document reads as though something is wrong when nothing is.
  const body = buildBody({ card: REAL, grid: REAL.grid } as unknown as RunState);
  assert.equal(body?.shortfall, undefined);
  assert.equal(body?.areas, undefined);
});
