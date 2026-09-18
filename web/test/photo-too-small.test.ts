import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stretchFor } from "../../Agents/Content & Social Planner/src/preview.js";

/**
 * 2026-09-18. Raj resized a photo and said it had lost its quality.
 *
 * The photo was 236 by 419 and 14KB. Every size this tool offers is 900 pixels
 * or more, so a 1080 square meant a 4.6 times stretch, drawing each pixel about
 * twenty one times. No encoder setting puts back detail the camera never took,
 * and the tool did it silently and said nothing before or after.
 */

test("the photo Raj used is smaller than every size we offer", () => {
  assert.equal(Number(stretchFor(236, 419, 1080, 1080).toFixed(2)), 4.58);
  assert.equal(Number(stretchFor(236, 419, 1080, 1920).toFixed(2)), 4.58);
  assert.equal(Number(stretchFor(236, 419, 1200, 630).toFixed(2)), 5.08);
});

test("a photo big enough is never called stretched", () => {
  // Straight off a phone. Cropping is not stretching and must not be flagged.
  assert.equal(stretchFor(4032, 3024, 1080, 1080), 1);
  assert.equal(stretchFor(3024, 4032, 1080, 1920), 1);
  // Exactly the size asked for is a true fit, not a stretch.
  assert.equal(stretchFor(1080, 1080, 1080, 1080), 1);
});

test("a photo one pixel short is stretched, barely, and the screen ignores it", () => {
  const s = stretchFor(1079, 1079, 1080, 1080);
  assert.ok(s > 1 && s < 1.05, `${s} should be a hair over 1`);
});

test("nonsense dimensions do not become a warning", () => {
  assert.equal(stretchFor(0, 0, 1080, 1080), 1);
  assert.equal(stretchFor(-5, 400, 1080, 1080), 1);
});

test("the screen says it before the files are written, not after", () => {
  const view = readFileSync(
    join(import.meta.dirname, "..", "app", "workspace", "[tool]", "resizer.tsx"),
    "utf8",
  );
  assert.match(view, /stretchFor/, "the screen never asks whether the photo is big enough");
  // Their number beside ours: "too small" is a judgement they cannot check.
  assert.match(view, /image\.naturalWidth\} by \{image\.naturalHeight\}/);
  // And on each size, so "some of the sizes" says which.
  assert.match(view, /toggle__warn/);
  // The geometry stays in one file. This screen uses it, never re-derives it.
  assert.doesNotMatch(view, /function stretchFor/, "a second copy of the geometry");
});
