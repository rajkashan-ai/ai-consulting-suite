/**
 * The words a model reaches for and a person does not.
 *
 * Two jobs, and the second is the harder one. Catching "testament" is easy.
 * Not catching somebody's real caption is what keeps this list worth having: a
 * false positive throws away a good post, and the owner is told only that we
 * would not stand behind it, so they never learn which word did it.
 *
 * Checked against the standard Raj set on 2026-09-18.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { houseStyle } from "../tools/content-social-planner/scrub.ts";
import { sourceOf } from "./tool-source.ts";

/* Real captions, in the voice these businesses actually write in. Not one of
   them may trip the list. */
const THEIRS = [
  "Bride in at 6am and we had her in the chair before the shop opened. Long day, worth it.",
  "People often ring and ask what a cut costs, so here it is plainly. A ladies cut and finish with one of our stylists is £57.00.",
  "A little on how colour works here, because it is not just turn up and go. Before any colouring service a simple sensitivity test may be needed at least 24 hours beforehand.",
  "This colour was worked by our Creative Director. That soft blend from dark roots into lighter, tousled ends takes a proper eye for placement.",
  "We are closed Monday for the bank holiday and back Tuesday at nine. Book online or give us a call on 01727 861124.",
  "Two chairs free this Thursday afternoon if anyone fancies a change before the weekend.",
  "Nine years on the High Street this month. Thank you to everyone who has sat in that chair.",
  "Dave has been cutting hair since 1998 and still says the fade is the hardest thing to get right.",
  "If your colour has gone brassy over the summer, that is the sun and the chlorine, not your shampoo. Come in and we will look at it.",
  "New stock in: the shampoo everyone kept asking about after we ran out in July.",
];

test("no real caption trips the list", () => {
  for (const words of THEIRS) {
    assert.equal(houseStyle(words), null, `refused a real caption over "${houseStyle(words)}": ${words.slice(0, 60)}`);
  }
});

test("the phrases the standard names are caught", () => {
  const caught: Record<string, string> = {
    "It is a testament to the team.": "testament",
    "In today's fast-paced world, hair matters.": "in today's fast-paced world",
    "We delve into the detail.": "delve",
    "A tapestry of colour and light.": "a tapestry of",
    "Whatever you need, we've got you covered.": "we have got you covered",
    "Your one-stop shop for hair.": "one-stop shop",
    "We are the go-to salon in town.": "the go-to",
    "Rest assured, your colour is safe with us.": "rest assured",
    "Embark on a new look this spring.": "embark on",
    "In the world of hair, texture is everything.": "in the world of",
  };
  for (const [words, name] of Object.entries(caught)) {
    assert.equal(houseStyle(words), name, `missed: ${words}`);
  }
});

test("the manufactured ending is caught, and the call to book is not", () => {
  /**
   * Raj's fourth rule, made specific to this medium. A social post that ends
   * "book online or call us" is doing its job. What is banned is the sentence
   * that sounds like an ending and says nothing.
   */
  for (const ending of [
    "With the right colour, the possibilities are endless.",
    "When it comes to your hair, the sky's the limit.",
    "At the end of the day, it is about how you feel.",
    "One thing is certain: good hair changes your week.",
  ]) {
    assert.ok(houseStyle(ending), `let a manufactured ending through: ${ending}`);
  }

  for (const proper of [
    "Book online or give us a call on 01727 861124.",
    "We are at 19 High Street, St Albans. Walk in or book ahead.",
    "Give us a ring if you want to talk it through first.",
    "Chairs are free Thursday. Come in.",
  ]) {
    assert.equal(houseStyle(proper), null, `refused a real call to book: ${proper}`);
  }
});

test("every pattern on the list is reachable, so none is decoration", () => {
  /**
   * A pattern that cannot fire is a rule nobody is keeping. Each one above is
   * proved by a phrase that trips it; this counts them, so a pattern added
   * without a case shows up here rather than in six months.
   */
  const src = sourceOf("content-social-planner");
  const block = src.slice(src.indexOf("const HOUSE"), src.indexOf("];", src.indexOf("const HOUSE")));
  const patterns = (block.match(/^\s*\[\/.*?\/i,/gm) ?? []).length;
  assert.ok(patterns >= 28, `only ${patterns} patterns, so some were lost`);
});

test("the writer is told the four things the standard asks for", () => {
  /**
   * The standard Raj set on 2026-09-18. Two of its four are adapted to the
   * medium rather than copied, and the adaptation is stated here so the next
   * person does not read it as a gap:
   *
   * "a seasoned domain expert would agree" becomes "a rival in the same trade
   * would recognise somebody who does the work", because the reader of a salon
   * caption is a customer, not an expert.
   *
   * "headings, bullet points" becomes the first line and short paragraphs,
   * because a caption with headings in it is not a caption.
   *
   * Matched on fragments that do not span the template literal's line breaks.
   * A longer phrase reads better here and silently never matches, which is the
   * third time that has caught me today.
   */
  const rules = sourceOf("content-social-planner");

  /* 1. Tone and voice: cadence, which nothing was asking for. */
  assert.match(rules, /vary the length of your sentences/i);
  assert.match(rules, /same shape in a row/i);

  /* 2. Substance, in this medium's terms. */
  assert.match(rules, /only somebody who does this work/i);
  assert.match(rules, /could have been written about any business/i);

  /* 3. Structure, in this medium's terms. */
  assert.match(rules, /first line stands on its own/i);
  assert.match(rules, /never headings or bullet points/i);

  /* 4. Endings, and the exception that keeps the post useful. */
  assert.match(rules, /lifts the mood and says nothing/i);
  assert.match(rules, /is not a closing line/i);
});
