import test from "node:test";
import assert from "node:assert/strict";
import {
  FEWEST,
  HOURS_TO_CHOOSE,
  PICK,
  SHORTLIST,
  asChosen,
  offer,
  waitedLongEnough,
  wrongWith,
  type Offer,
} from "../tools/competitor-tracker/shortlist.ts";
import { advance, type RunState, type Stage } from "../tools/competitor-tracker/stages.ts";
import { check, WAITING_ON_A_PERSON, STILL_LIMIT } from "../lib/watchdog.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { aBusiness, fakeContext, type Recorded } from "./fake.ts";

const recorded = JSON.parse(
  readFileSync(join(import.meta.dirname, "fixtures", "shrewsbury.json"), "utf8"),
) as Recorded;

/**
 * The screen exists because one listing record in twenty is wrong about the
 * business, and no rule built on that record can tell. Fresha's own entry for
 * Rob's Cuts says "Women's Haircut, Locs, Children's Haircut"; they cut men and
 * boys. An owner knows in a second. See shortlist.ts.
 */

const row = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  area: "High St, St Albans",
  reviews: null,
  rating: null,
  reviewedDaysAgo: null,
  price: null,
  url: null,
  ...extra,
});

// ---------------------------------------------------------------------------
// What we put in front of them
// ---------------------------------------------------------------------------

test("ours come first and are marked, so agreeing is one click", () => {
  const got = offer([row("Atelier Salon & Spa"), row("Studio 10")], [row("Clipso")]);
  assert.deepEqual(got.map((o) => o.name), ["Atelier Salon & Spa", "Studio 10", "Clipso"]);
  assert.deepEqual(got.map((o) => o.ours), [true, true, false]);
});

test("a business we could not place is shown as doubtful, not dropped", () => {
  /**
   * The case Raj raised: "some we are unsure about because we haven't checked
   * their URLs". Hiding them loses real competitors; including them silently
   * is how a make-up artist ended up in a salon's comparison.
   */
  const unplaceable = offer([], [row("HOUSE of MISTR.")])[0];
  assert.equal(unplaceable.unsure, true, "a name that says nothing reads as certain");

  // The platform's own url settles it, so this one is not doubtful.
  const placed = offer([], [
    row("Some Salon", { url: "https://booksy.com/en-gb/9_some-salon_hair-salon_234686_st-albans" }),
  ])[0];
  assert.equal(placed.unsure, false);

  // And a name that names its trade is evidence too.
  assert.equal(offer([], [row("Distinct Barbering")])[0].unsure, false);
});

test("the list is capped, and nobody appears twice", () => {
  const many = Array.from({ length: 40 }, (_, i) => row(`Salon ${i}`));
  assert.equal(offer([], many).length, SHORTLIST);

  const twice = offer([row("Clipso")], [row("clipso"), row("CLIPSO ")]);
  assert.equal(twice.length, 1, "the same business offered three ways");
});

test("what it shows is what an owner recognises a shop by", () => {
  const one = offer([], [
    row("Chestnut Hair", {
      services: ["Women's Haircut", "Keratin Treatment", "Locs", "Blow Dry", "Perm"],
      rating: 4.9,
      reviews: 120,
      price: 45,
      miles: 0.4,
    }),
  ])[0];
  assert.equal(one.area, "High St, St Albans");
  assert.equal(one.rating, 4.9);
  assert.equal(one.reviews, 120);
  assert.equal(one.miles, 0.4);
  // Four is enough to recognise a shop and short enough to scan a column of
  // twenty four. Nielsen 8: nothing on screen that is rarely needed.
  assert.equal(one.services.length, 4);
});

// ---------------------------------------------------------------------------
// What comes back, and why none of it is trusted
// ---------------------------------------------------------------------------

test("a name we never offered is never accepted", () => {
  /**
   * The boundary. These names arrive from a browser and go on to a fetch
   * queue, so a name we did not offer is a name whose country and trade were
   * never established, and fetching it would walk around every filter behind
   * this screen.
   */
  const offered = offer([], [row("Atelier Salon & Spa"), row("Clipso")]);
  assert.deepEqual(asChosen(["Atelier Salon & Spa", "https://evil.example/"], offered), [
    "Atelier Salon & Spa",
  ]);
  assert.deepEqual(asChosen(["Not On The List"], offered), []);
});

test("rubbish in the reply is dropped, not thrown", () => {
  const offered = offer([], [row("Clipso")]);
  assert.deepEqual(asChosen(null, offered), []);
  assert.deepEqual(asChosen("Clipso", offered), [], "a string is not a list of choices");
  assert.deepEqual(asChosen([1, {}, null, "Clipso"], offered), ["Clipso"]);
  assert.deepEqual(asChosen(["Clipso", "clipso"], offered), ["Clipso"], "counted once");
});

test("they cannot pick more than we compare", () => {
  const offered = offer([], Array.from({ length: 10 }, (_, i) => row(`Salon ${i}`)));
  assert.equal(asChosen(offered.map((o) => o.name), offered).length, PICK);
});

test("one competitor is not a comparison, and it says so in their words", () => {
  assert.match(wrongWith(["Only One"])!, /at least 2/i);
  assert.equal(wrongWith(["One", "Two"]), null);
  // No machinery in the sentence: no stage name, no field name, no count of
  // rows. Rule 1.4a, and TESTING 7.
  assert.doesNotMatch(wrongWith([])!, /stage|state|null|undefined|competitors\[/i);
});

// ---------------------------------------------------------------------------
// Waiting, and not waiting for ever
// ---------------------------------------------------------------------------

test("a run waits, then goes ahead with ours rather than producing nothing", () => {
  const asked = new Date("2026-09-17T09:00:00Z").toISOString();
  assert.equal(waitedLongEnough(asked, new Date("2026-09-18T08:00:00Z")), false, "23 hours");
  assert.equal(waitedLongEnough(asked, new Date("2026-09-19T10:00:00Z")), true, "49 hours");
  // Never asked, so nothing to be late for.
  assert.equal(waitedLongEnough(null, new Date()), false);
  // An unreadable date is not a deadline. It used to be: Date.parse returns
  // NaN, NaN comparisons are false, and the fallback silently never fired.
  assert.equal(waitedLongEnough("not a date", new Date()), false);
  assert.equal(HOURS_TO_CHOOSE, 48);
});

test("the watchdog does not kill a run that is waiting for a person", () => {
  /**
   * Both stuck detectors measure repetition, and a run parked on this screen
   * repeats on purpose for as long as the owner takes. Without the exemption
   * it would be stopped within three ticks.
   */
  assert.ok(WAITING_ON_A_PERSON.has("picking"));
  const parked = { saidSame: STILL_LIMIT + 5, saidLast: "picking waiting" };
  assert.equal(check(parked, { stage: "picking", startedAt: new Date() }), null);
  // And the exemption is for this stage only.
  assert.ok(check(parked, { stage: "reading", startedAt: new Date() }) !== null);
});

test("waiting spends nothing", async () => {
  const { ctx, calls } = fakeContext(recorded);
  const state = { offered: offer([], [row("Clipso"), row("Atelier Salon & Spa")]) } as RunState;
  const step = await advance("picking" as Stage, state, aBusiness(), ctx);

  assert.equal(step.stage, "picking", "it moved on without an answer");
  assert.equal(calls.think.length, 0, "a waiting step called the model");
  assert.equal(calls.search.length, 0);
  assert.equal(calls.read.length, 0, "a waiting step fetched a page");
});

// ---------------------------------------------------------------------------
// Their answer is the one that counts
// ---------------------------------------------------------------------------

test("their five become the set, and their pages are what gets read", async () => {
  const { ctx } = fakeContext(recorded);
  const offered = offer([], [
    row("Atelier Salon & Spa", { url: "https://booksy.com/en-gb/1_atelier_hair-salon_2_st-albans" }),
    row("Clipso", { url: "https://booksy.com/en-gb/2_clipso_hair-salon_2_st-albans" }),
    row("Nobody Picked This One"),
  ]);
  const state = { offered, chosen: ["Clipso", "Atelier Salon & Spa"] } as RunState;

  const step = await advance("picking" as Stage, state, aBusiness(), ctx);
  assert.equal(step.stage, "reading");
  assert.deepEqual((step.state.competitors ?? []).map((c) => c.name), [
    "Clipso",
    "Atelier Salon & Spa",
  ]);
  assert.ok(
    (step.state.competitors ?? []).every((c) => c.addedByCustomer),
    "a business they chose themselves is not marked as theirs",
  );
  const queued = (step.state.queue ?? []).map((q) => q.name);
  assert.ok(!queued.includes("Nobody Picked This One"), "it read one they did not choose");
  assert.equal(queued[0], "you", "their own site is read first, as on every other route");
});

test("unticking our suggestion does not retract a name they typed in", async () => {
  /**
   * addedByCustomer has always meant "survives every weekly run, for ever".
   * Building the set from the tick boxes alone quietly undid that, and it is
   * the kind of loss nobody notices until a competitor goes missing.
   */
  const { ctx } = fakeContext(recorded);
  const offered = offer([], [row("Clipso"), row("Atelier Salon & Spa")]);
  const step = await advance(
    "picking" as Stage,
    { offered, chosen: ["Clipso"] } as RunState,
    aBusiness({ knownCompetitor: "Chapter One Barbers" }),
    ctx,
  );
  const names = (step.state.competitors ?? []).map((c) => c.name);
  assert.ok(names.includes("Chapter One Barbers"), `they typed it in and it went: ${names}`);
  assert.equal(names[0], "Chapter One Barbers", "kept first, so the cap never drops it");
});

test("nobody answered, so ours are used rather than nothing", async () => {
  const { ctx } = fakeContext(recorded);
  const long = new Date(Date.now() - (HOURS_TO_CHOOSE + 1) * 3_600_000).toISOString();
  const state = {
    offered: offer([], [row("Clipso")]),
    offeredAt: long,
    competitors: [{ name: "Clipso", claims: {} }],
    queue: [{ name: "Clipso", url: "https://example.com/clipso" }],
  } as unknown as RunState;

  const step = await advance("picking" as Stage, state, aBusiness(), ctx);
  assert.equal(step.stage, "reading", "a run nobody answered produced nothing at all");
  assert.deepEqual((step.state.competitors ?? []).map((c) => c.name), ["Clipso"]);
});

test("the numbers on the screen are the ones the run is built around", () => {
  // A screen asking for five while the run compares six is a screen that lies.
  assert.equal(PICK, 5);
  assert.equal(FEWEST, 2);
  assert.ok(SHORTLIST >= 20, "measured: 20 real candidates in one St Albans listing");
});

// ---------------------------------------------------------------------------
// The screen, and the two places it could leak or spin
// ---------------------------------------------------------------------------

test("the run loop hands over instead of spinning while it waits", () => {
  /**
   * The loop asks for the next step every second and a half. A run parked on
   * the picker answers the same thing every time, so without this the browser
   * drives a run that cannot move while the screen says "Working".
   */
  const running = readFileSync(
    join(import.meta.dirname, "..", "app", "workspace", "[tool]", "running.tsx"),
    "utf8",
  );
  assert.match(running, /answer\.stage === "picking"/, "the loop does not notice the picker");
});

test("no page text ever reaches the browser", () => {
  /**
   * A run's state holds the text of pages read off other people's websites.
   * The screen needs one field out of it. Passing the state and letting the
   * component pick would put all of it in the page source.
   */
  const screen = readFileSync(
    join(import.meta.dirname, "..", "app", "workspace", "[tool]", "competitor-tracker.tsx"),
    "utf8",
  );
  assert.match(screen, /\.offered \?\? \[\]/, "the offer is no longer taken out of the state");
  assert.doesNotMatch(
    screen,
    /state=\{|offered=\{latest\.state\}/,
    "the whole run state is handed to the browser",
  );
});

test("the picker writes no colours or fonts of its own", () => {
  // Every colour and size is a token in design.css. A hex in a component is a
  // colour nothing can change centrally.
  const picker = readFileSync(
    join(import.meta.dirname, "..", "app", "workspace", "[tool]", "picker.tsx"),
    "utf8",
  );
  assert.doesNotMatch(picker, /#[0-9a-f]{3,8}\b/i, "a hex colour in a tool component");
  assert.doesNotMatch(picker, /font-family|fontFamily/, "a font in a tool component");
  assert.doesNotMatch(picker, /style=\{\{/, "an inline style in a tool component");
});

test("nothing on the screen is our machinery", () => {
  /**
   * Rule 1.4a, Nielsen 2. "picking", "state", "offered" and "run" are our
   * words. An owner reading them has been told about our insides and can do
   * nothing with it.
   */
  const picker = readFileSync(
    join(import.meta.dirname, "..", "app", "workspace", "[tool]", "picker.tsx"),
    "utf8",
  );
  const shown = [...picker.matchAll(/>\s*([A-Z][^<>{}]{8,})/g)].map((m) => m[1]);
  for (const line of shown) {
    assert.doesNotMatch(
      line,
      /\bstage\b|\bstate\b|\brun id\b|\btoken\b|\bqueue\b|\bnull\b|\bundefined\b/i,
      `the screen says: ${line.trim()}`,
    );
  }
});

test("answering it is not the same as still being asked", () => {
  /**
   * Saving a choice writes `chosen` and leaves the stage alone, so a screen
   * keyed only on the stage drew the picker again over the answer they had
   * just given, and the progress panel that advances the run never mounted.
   */
  const screen = readFileSync(
    join(import.meta.dirname, "..", "app", "workspace", "[tool]", "competitor-tracker.tsx"),
    "utf8",
  );
  assert.match(screen, /!parked\.chosen\?\.length/, "the picker is drawn over their own answer");
});

test("a run waiting on a person does not hold a slot in the queue", () => {
  /**
   * stalled_runs returns three runs a minute, oldest first. A run parked for
   * two days would take a slot every minute and write itself back each time,
   * while newer runs queued behind it. A run they have answered must still be
   * returned, or choosing and closing the laptop does nothing.
   */
  const sql = readFileSync(
    join(import.meta.dirname, "..", "supabase", "competitor-tracker-2026-09-17-waiting-runs.sql"),
    "utf8",
  );
  assert.match(sql, /not \(stage = 'picking' and \(state -> 'chosen'\) is null\)/);
  assert.match(sql, /create or replace function public\.stalled_runs/);
});
