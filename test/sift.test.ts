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
