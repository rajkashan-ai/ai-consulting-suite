import { test } from "node:test";
import assert from "node:assert/strict";
import { notYou, oneEach, rightTrade, sift } from "../tools/competitor-tracker/sift.ts";

const n = (name: string) => ({ name });

test("the customer is not their own competitor", () => {
  // They ranked top of their own list, because proximity matched their own
  // address perfectly, which it always will.
  const out = notYou(
    [n("The Barber Shop Shrewsbury"), n("HINCES")],
    "The Barber Shop Shrewsbury",
  );
  assert.deepEqual(out.map((x) => x.name), ["HINCES"]);
});

test("the customer under a slightly different name is still the customer", () => {
  assert.equal(notYou([n("The Barber Shop")], "The Barber Shop Shrewsbury").length, 0);
  assert.equal(notYou([n("Barber Shop Shrewsbury Ltd")], "The Barber Shop Shrewsbury").length, 0);
});

test("one shop, one entry, and the fuller name survives", () => {
  // "HINCES Barber" came from the customer and "HINCES" from the listing, and
  // both took a slot out of five.
  const out = oneEach([n("HINCES"), n("HINCES Barber"), n("NO.1 BARBERS")]);
  assert.deepEqual(out.map((x) => x.name), ["HINCES Barber", "NO.1 BARBERS"]);
});

test("two genuinely different shops are not collapsed", () => {
  const out = oneEach([n("Golden Scissors"), n("Silver Scissors")]);
  assert.equal(out.length, 2);
});

test("a beauty clinic is not a barber", () => {
  // Booking platforms group nearby trades on one page, so appearing on a barber
  // listing is not proof of being a barber.
  const out = rightTrade(
    [n("Golden Scissors Hair And Beauty Clinique"), n("HINCES Barber")],
    "barber",
  );
  assert.deepEqual(out.map((x) => x.name), ["HINCES Barber"]);
});

test("a name that gives no clue is kept, not guessed at", () => {
  // Plenty of real businesses are called something that says nothing. Refusing
  // those would lose far more than it saves.
  const out = rightTrade([n("Chapter One"), n("The Lockhart")], "barber");
  assert.equal(out.length, 2);
});

test("with no trade known it refuses nobody", () => {
  assert.equal(rightTrade([n("Anything")], null).length, 1);
});

test("all three together, on the real first run", () => {
  const out = sift(
    [
      n("The Barber Shop Shrewsbury"),
      n("HINCES"),
      n("HINCES Barber"),
      n("Golden Scissors Hair And Beauty Clinique"),
      n("NO.1 BARBERS"),
      n("Branded Barbers Shrewsbury"),
    ],
    { you: "The Barber Shop Shrewsbury", trade: "barber" },
  );
  // Three of six were noise, and each one was a quarter of the comparison.
  assert.deepEqual(out.map((x) => x.name), [
    "HINCES Barber",
    "NO.1 BARBERS",
    "Branded Barbers Shrewsbury",
  ]);
});

// ---------------------------------------------------------------------------
// Removing the customer must not remove their rivals. Added 2026-09-16.
// ---------------------------------------------------------------------------

/**
 * Found by an independent test pass on 2026-09-16.
 *
 * The rule was "is one name inside the other". That reads fine and quietly
 * deleted real competitors, because a short trading name sits inside a great
 * many longer ones. A barber called "Cuts" lost both "Cuts Above" and
 * "Precision Cuts" and was then told we could only find one barber in their
 * town: two of five slots gone, silently, and a false explanation.
 *
 * The same line had a second way to fail. A name that normalised to the empty
 * string matched everything, because every string contains "". That hit every
 * business whose name is not in the English alphabet, and also "The Company"
 * and "Co Ltd", which are made entirely of the words the suffix strip removes.
 */

test("a short name does not swallow the competitors that contain it", () => {
  const kept = notYou(
    [n("Cuts Above"), n("Precision Cuts"), n("Kemp Barbers")],
    "Cuts",
  ).map((r) => r.name);

  assert.deepEqual(kept, ["Cuts Above", "Precision Cuts", "Kemp Barbers"]);
});

test("but the customer's own shop is still removed, exactly", () => {
  const kept = notYou([n("Cuts"), n("Kemp Barbers")], "Cuts").map((r) => r.name);
  assert.deepEqual(kept, ["Kemp Barbers"]);
});

test("the same shop with a town added is still one shop", () => {
  // This is what the rule is for and it has to keep working. Two words or more,
  // matching from the start, is the same business under a fuller name.
  for (const [you, theirs] of [
    ["The Barber Shop", "The Barber Shop Shrewsbury"],
    ["Reed Plumbing", "Reed Plumbing & Heating"],
    ["The Barber Shop Shrewsbury", "The Barber Shop"],
  ]) {
    assert.deepEqual(notYou([n(theirs)], you), [], `${you} vs ${theirs}`);
  }
});

test("a different shop sharing a first word is kept", () => {
  // "Reed Plumbing" and "Reed Joinery" share a family name and nothing else.
  const kept = notYou([n("Reed Joinery"), n("Reed Electrical")], "Reed Plumbing");
  assert.equal(kept.length, 2);
});

test("a name in another alphabet keeps every competitor", () => {
  // The empty string is inside every string, so a name that normalised to
  // nothing deleted the whole list and the owner was told their town had no
  // competitors in it.
  for (const you of ["محل الحلاقة", "理髮店", "Перукарня", "Κουρείο"]) {
    const kept = notYou([n("NO.1 BARBERS"), n("ARMANDO Barbershop")], you);
    assert.equal(kept.length, 2, `${you} emptied the list`);
  }
});

test("a name made only of suffix words keeps every competitor", () => {
  // "The Company" is an ordinary English name. Every word in it is on the list
  // of suffixes we strip, so it normalised to nothing and hit the same fault.
  for (const you of ["The Company", "Co Ltd", "The Co", "The Limited"]) {
    const kept = notYou([n("NO.1 BARBERS"), n("ARMANDO Barbershop")], you);
    assert.equal(kept.length, 2, `${you} emptied the list`);
  }
});

test("a competitor whose name we cannot read at all is dropped, not kept", () => {
  // An entry that is only punctuation or emoji is not a business we can compare
  // anything to, and it would spend one of five slots.
  const kept = notYou([n("!!! ***"), n("NO.1 BARBERS")], "The Barber Shop").map((r) => r.name);
  assert.deepEqual(kept, ["NO.1 BARBERS"]);
});
