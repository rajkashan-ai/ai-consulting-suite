/**
 * A gap the writer left, rather than a number it invented.
 *
 * The writer needed a figure nobody had given it and produced £141.00.
 * `findInventedClaims` caught it, the whole post was thrown away, and the owner
 * saw "we wrote one and would not stand behind it" and got nothing. Refusing
 * was right about the number and wrong about the outcome.
 *
 * Raj, 2026-09-18: leave an obvious space that tells them to put a price in.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { blanksIn, inPieces, withoutMarkers } from "../tools/content-social-planner/paths.ts";

const file = (...b: string[]) => readFileSync(join(import.meta.dirname, "..", ...b), "utf8");
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

test("a post with no gaps is one piece and nothing to fill", () => {
  const words = "Book online or give us a call on 01727 861124.";
  assert.deepEqual(inPieces(words), [{ text: words, blank: false }]);
  assert.equal(blanksIn(words), 0);
});

test("a gap is split out, keeping the words either side", () => {
  const got = inPieces("A cut and finish is [your price for this] at the moment.");
  assert.deepEqual(got, [
    { text: "A cut and finish is ", blank: false },
    { text: "your price for this", blank: true },
    { text: " at the moment.", blank: false },
  ]);
  assert.equal(blanksIn("A cut and finish is [your price for this] at the moment."), 1);
});

test("the instruction survives, because the chip carries it as words", () => {
  /* brand.css rule 4: colour is never the only signal. An amber chip that says
     nothing is a coloured box, and somebody printing the post loses it. */
  const [piece] = inPieces("[how long it took]").filter((p) => p.blank);
  assert.equal(piece.text, "how long it took");
});

test("more than one gap in a post is fine", () => {
  assert.equal(blanksIn("[your price] for a cut, [your price] for colour."), 2);
});

test("a stray bracket is words, not a gap", () => {
  /* Owners write brackets. "(see below) [ " must not become an amber chip with
     nothing in it, and an unclosed one must not eat the rest of the post. */
  for (const words of ["Open 9 to 5 [Monday to Friday", "A note ] here", "Nothing [] at all"]) {
    assert.equal(blanksIn(words), 0, words);
    assert.equal(inPieces(words).map((p) => p.text).join(""), words, "the words changed");
  }
});

test("something absurdly long in brackets is words, not a gap", () => {
  /* A model that pastes a paragraph into brackets has not left a gap, and an
     amber chip holding sixty words is not something anyone types over. */
  const long = `[${"x".repeat(80)}]`;
  assert.equal(blanksIn(long), 0);
});

test("the writer is told to leave a gap rather than invent a figure", () => {
  const action = code(file("app", "workspace", "[tool]", "make-actions.ts"));
  assert.match(action, /do not invent one and do not leave it out/i);
  assert.match(action, /\[your price/i, "the shape of a gap is not spelled out");
});

test("the screen draws the gap, and draws it as a blank", () => {
  const made = file("app", "workspace", "[tool]", "made.tsx");
  assert.match(made, /inPieces\(p\.words\)/, "the post is printed raw, brackets and all");
  assert.match(made, /className="blank"/, "a gap is drawn as ordinary text");
});

/**
 * 2026-09-18, from the pre-live photo run.
 *
 * The post came back reading "our Balyage Specialist service, from \u00A3141.00
 * [1][2]." The page number is meant to travel in `from`, which already carried
 * it. Written into the sentence as well, it is a footnote marker in something
 * somebody pastes into Instagram, and because a gap is the same brackets it
 * was counted as two gaps and would have been drawn as amber chips asking them
 * to fill in "1" and "2".
 */
test("a page number is not a gap", () => {
  assert.equal(blanksIn("our Balyage Specialist service, from \u00A3141.00 [1][2]."), 0);
  // And a real gap beside one is still a gap.
  assert.equal(blanksIn("It took [how long] and cost \u00A341 [2]."), 1);
});

test("page numbers come out of the words, and nothing else does", () => {
  assert.equal(
    withoutMarkers("our Balyage Specialist service, from \u00A3141.00 [1][2]."),
    "our Balyage Specialist service, from \u00A3141.00.",
  );
  assert.equal(
    withoutMarkers("Booked [3] for [your price here] today."),
    "Booked for [your price here] today.",
  );
  // Their own brackets survive: a gap is not a citation.
  assert.equal(withoutMarkers("It took [how long]."), "It took [how long].");
  // Line breaks are the shape of the post and are not touched.
  assert.equal(withoutMarkers("One line [1]\n\nNext line"), "One line\n\nNext line");
});
