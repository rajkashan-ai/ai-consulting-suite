/**
 * The photo path, checked without a browser and without spending.
 *
 * Three separate things, all of which decide whether a post is honest: the
 * arithmetic that decides what size goes to the writer, the refusals that stop
 * a bad file reaching the API, and the line the owner reads saying what is
 * actually behind the post.
 *
 * Built 2026-09-18.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LONG_EDGE,
  MOST_BASE64,
  QUALITY,
  SENT_AS,
  TAKES,
  asPhoto,
  drawAt,
} from "../tools/content-social-planner/photo.ts";
import { creditLine, notesHint } from "../tools/content-social-planner/sources.ts";

/* ── what size goes to the writer ───────────────────────────────────────── */

test("a photo bigger than the limit comes down to it, keeping its shape", () => {
  const wide = drawAt(4032, 3024);
  assert.equal(Math.max(wide.width, wide.height), LONG_EDGE);
  /* 4:3 in, 4:3 out. A stretched photo describes a stretched haircut. */
  assert.equal(Math.round((wide.width / wide.height) * 100), Math.round((4032 / 3024) * 100));

  const tall = drawAt(3024, 4032);
  assert.equal(Math.max(tall.width, tall.height), LONG_EDGE, "portrait is measured on the wrong edge");
});

test("a photo already small enough is left alone, never blown up", () => {
  assert.deepEqual(drawAt(800, 600), { width: 800, height: 600 });
  assert.deepEqual(drawAt(LONG_EDGE, 900), { width: LONG_EDGE, height: 900 });
});

test("a nonsense size produces nothing to draw rather than a crash", () => {
  for (const [w, h] of [[0, 100], [-5, 5], [NaN, 10], [Infinity, 10]]) {
    assert.deepEqual(drawAt(w, h), { width: 0, height: 0 }, `${w}x${h} got through`);
  }
});

test("a very long thin photo still has a side of at least one pixel", () => {
  const thin = drawAt(9000, 3);
  assert.equal(thin.width, LONG_EDGE);
  assert.ok(thin.height >= 1, "the short side rounded away to nothing");
});

test("we send the smaller of the two resolutions on purpose", () => {
  /**
   * Sonnet 5 accepts 2576 on the long edge. We use 1568, which is the older
   * limit, because the bigger one costs up to 4784 image tokens against 1568
   * and Anthropic's own guidance is to downsample where the fidelity is not
   * needed. If this ever changes it should change with a measurement.
   */
  assert.equal(LONG_EDGE, 1568);
  assert.ok(LONG_EDGE < 2576, "we are paying for resolution nobody asked for");
  assert.equal(SENT_AS, "image/jpeg");
  assert.ok(QUALITY > 0 && QUALITY < 1);
});

/* ── what is refused before it reaches the API ──────────────────────────── */

const data = (n: number) => "A".repeat(n);

test("a real data url is split into what the API takes", () => {
  const got = asPhoto(`data:image/jpeg;base64,${data(40)}`);
  assert.deepEqual(got, { media_type: "image/jpeg", data: data(40) });
});

test("the prefix is stripped, because the API will not take it", () => {
  const got = asPhoto(`data:image/png;base64,${data(10)}`);
  assert.ok(!("error" in got));
  assert.doesNotMatch((got as { data: string }).data, /^data:/, "the whole data url was sent");
  assert.doesNotMatch((got as { data: string }).data, /base64,/, "the prefix went with it");
});

test("nothing, or something that is not a photo, is refused in their words", () => {
  for (const bad of [null, undefined, 42, "", "not a data url", "data:text/plain;base64,QQ=="]) {
    const got = asPhoto(bad);
    assert.ok("error" in got, `${String(bad)} was accepted as a photo`);
    assert.doesNotMatch(
      (got as { error: string }).error,
      /base64|data url|media_type|null|undefined|API/i,
      "the refusal is written in our words, not theirs",
    );
  }
});

test("every kind we say we take is a kind we take", () => {
  for (const kind of TAKES) {
    assert.ok(!("error" in asPhoto(`data:${kind};base64,${data(10)}`)), `${kind} is offered and refused`);
  }
});

test("a photo too big for a server action is refused here, not by a 413", () => {
  /**
   * Next rejects a server action body over 1 MB with a 413, which reaches the
   * owner as a failure with no reason. This is the same refusal said in words
   * they can act on.
   */
  const got = asPhoto(`data:image/jpeg;base64,${data(MOST_BASE64 + 1)}`);
  assert.ok("error" in got);
  assert.match((got as { error: string }).error, /too big/i);
  assert.ok(!("error" in asPhoto(`data:image/jpeg;base64,${data(MOST_BASE64)}`)), "the limit is off by one");
  assert.ok(MOST_BASE64 < 1024 * 1024, "our cap is above the body limit it exists to stay under");
});

/* ── the list they pick from ────────────────────────────────────────────── */

test("the greyed example is their own service and their own price", () => {
  const hint = notesHint([
    { name: "Dry cut", price: null },
    { name: "Balayage", price: "£95" },
    { name: "Blow dry", price: "£25" },
  ]);
  assert.match(hint, /Balayage, £95/, "the example is not one of theirs");
  assert.match(hint, /Blow dry, £25/, "only one example, so the shape is not shown");
  assert.doesNotMatch(hint, /Dry cut/, "an unpriced service crowded out a priced one");
});

test("a business we could read no prices for still gets the unpriced names", () => {
  const hint = notesHint([{ name: "Haircut" }, { name: "Beard trim" }]);
  assert.match(hint, /Haircut/);
  assert.match(hint, /Beard trim/);
});

test("a business we could read no services for gets the shape without an example", () => {
  /**
   * Never a made-up price. Showing a barber "Balayage, £95" would be this
   * product inventing a service and a price for somebody else's business,
   * which is the one thing it exists not to do.
   */
  for (const none of [[], null, undefined, [{ name: "  " }]]) {
    const hint = notesHint(none as never);
    assert.match(hint, /what it costs/i, `${JSON.stringify(none)} produced no guidance`);
    assert.doesNotMatch(hint, /£/, "a price appeared for a business with none");
  }
});

test("twelve grades of one cut show as one example, not two", () => {
  /**
   * A Cut Above's price list is "Ladies Cut & Finish - Graduate Stylist"
   * through to "- Creative Director": twelve rows, one service. Taking the
   * first two gave "Ladies Cut & Finish - Graduate Stylist, £51.00. Ladies Cut
   * & Finish - Stylist, £57.00", which shows the same thing twice. That list is
   * exactly what made the old picker unusable.
   */
  const theirs = [
    { name: "Ladies Cut & Finish - Graduate Stylist", price: "£51.00" },
    { name: "Ladies Cut & Finish - Stylist", price: "£57.00" },
    { name: "Ladies Cut & Finish - Creative Director", price: "£68.00" },
    { name: "Restyle & Finish - Stylist", price: "£62.00" },
  ];
  const hint = notesHint(theirs);
  assert.match(hint, /Ladies Cut & Finish, £51\.00/, "the grade is still in the example");
  assert.match(hint, /Restyle & Finish, £62\.00/, "the second example is the same service again");
  assert.equal((hint.match(/£/g) ?? []).length, 2, "more than two examples");
});

test("the example never runs longer than the box it sits in", () => {
  const many = Array.from({ length: 12 }, (_x, i) => ({ name: `Service ${i}`, price: "£51" }));
  const hint = notesHint(many);
  assert.ok(hint.length < 120, `the placeholder is ${hint.length} characters`);
  assert.equal((hint.match(/£51/g) ?? []).length, 2, "more than two examples");
});

/* ── what the owner is told is behind the post ──────────────────────────── */

test("a post off their pages says so, exactly as it always did", () => {
  assert.equal(creditLine(false, "2026-09-17", null), "From your own page, read 2026-09-17");
});

test("a post off a photo names the photo as well as the page", () => {
  const said = creditLine(true, "2026-09-17", "2026-09-18");
  assert.match(said, /your photo/i, "the photo is not named as a source");
  assert.match(said, /added 2026-09-18/);
  assert.match(said, /your own page/i, "the page stopped being credited");
  assert.match(said, /read 2026-09-17/);
});

test("a photo post never claims the page describes the work", () => {
  /**
   * The fault this whole field exists to stop. A post describing a haircut,
   * stamped "from your own page", points the receipt at something that does
   * not say it. The guards would pass it: they check numbers and names, not
   * whether a sentence is backed.
   */
  const said = creditLine(true, "2026-09-17", "2026-09-18");
  assert.notEqual(said, "From your own page, read 2026-09-17");
  assert.ok(said.indexOf("photo") < said.indexOf("page"), "the photo is credited after the page");
});

test("a missing date leaves the sentence readable rather than half written", () => {
  assert.equal(creditLine(false, null, null), "From your own page");
  assert.doesNotMatch(creditLine(true, null, null), /null|undefined|,\s*,/);
});
