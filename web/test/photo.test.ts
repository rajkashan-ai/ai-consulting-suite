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
import { creditLine, servicesToOffer } from "../tools/content-social-planner/sources.ts";

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

test("the services offered are theirs, with the priced ones first", () => {
  const got = servicesToOffer([
    { name: "Dry cut", price: null },
    { name: "Balayage", price: "£95" },
    { name: "Blow dry", price: "£25" },
  ]);
  assert.deepEqual(got, ["Balayage", "Blow dry", "Dry cut"]);
});

test("a site that named no services offers none, rather than a list we made up", () => {
  assert.deepEqual(servicesToOffer([]), []);
  assert.deepEqual(servicesToOffer(null), []);
  assert.deepEqual(servicesToOffer(undefined), []);
  assert.deepEqual(servicesToOffer([{ name: "  ", price: "£10" }]), []);
});

test("the same service listed twice is offered once", () => {
  assert.deepEqual(servicesToOffer([{ name: "Cut", price: "£10" }, { name: "Cut" }]), ["Cut"]);
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
