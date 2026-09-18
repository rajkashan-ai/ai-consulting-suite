/**
 * The business name in the rail, which is the one place we edit their own name.
 *
 * 216px of sidebar, and "A Cut Above St Albans" measured 151px in a 137px box,
 * so it ellipsised to "A Cut Above St Alb…": it lost the half that identifies
 * them while repeating the half printed directly underneath. Trimming the town
 * off is the fix, and trimming somebody's name is the kind of thing that has to
 * be tested before it is trusted.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { withoutTown } from "../tools/place.ts";

test("a town on the end comes off, because it is on the line below", () => {
  assert.equal(withoutTown("A Cut Above St Albans", "St Albans"), "A Cut Above");
});

test("the separator goes with it, whatever it was", () => {
  for (const raw of ["A Cut Above, St Albans", "A Cut Above - St Albans", "A Cut Above  St Albans"]) {
    assert.equal(withoutTown(raw, "St Albans"), "A Cut Above", raw);
  }
});

test("a town in the middle stays, because it is part of how they are known", () => {
  assert.equal(withoutTown("St Albans Hair Studio", "St Albans"), "St Albans Hair Studio");
});

test("a business named only for its town keeps its name", () => {
  /* Never return an empty rail. */
  assert.equal(withoutTown("St Albans", "St Albans"), "St Albans");
  assert.equal(withoutTown("St Albans", "st albans"), "St Albans");
});

test("a name that is nothing but punctuation and its town keeps its name", () => {
  /**
   * The case that reaches the last guard rather than the length check, and it
   * was not covered: removing `|| trimmed` failed nothing, which means the
   * guard was decorative. Stored names are read off other people's websites,
   * so a leading comma is not hypothetical.
   */
  assert.equal(withoutTown(", St Albans", "St Albans"), ", St Albans");
  assert.equal(withoutTown("- St Albans", "St Albans"), "- St Albans");
});

test("case and spacing do not decide whether it matches", () => {
  assert.equal(withoutTown("Bellatique Studio MARKYATE", "Markyate"), "Bellatique Studio");
  assert.equal(withoutTown("  Rob's Cuts London Colney  ", "London Colney"), "Rob's Cuts");
});

test("no town, or a blank one, changes nothing", () => {
  assert.equal(withoutTown("A Cut Above St Albans", null), "A Cut Above St Albans");
  assert.equal(withoutTown("A Cut Above St Albans", "   "), "A Cut Above St Albans");
});

test("a name shorter than its town is left alone", () => {
  assert.equal(withoutTown("Hair", "St Albans"), "Hair");
});

test("a town that merely appears at the end of a word is not stripped", () => {
  /* "Bath" is a town. "Bath" inside "Aftermath" is not. */
  assert.equal(withoutTown("Aftermath", "math"), "Aftermath");
});
