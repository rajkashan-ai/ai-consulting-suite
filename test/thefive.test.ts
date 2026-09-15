import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * The five that were ranked are the five that appear.
 *
 * From the first real run. Ranking chose NO.1, HINCES, Branded Barbers and
 * Golden Scissors. The battlecard came back about Fade Inn, Darwin's and
 * Barbering AJ, because the writing step was handed the whole listing page and
 * chose again. Every bit of ranking work was decoration.
 *
 * This is the filter, tested on its own. An instruction in a prompt is guidance;
 * this is the part that cannot be talked out of.
 */
const key = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, "");

function keepOnlyAgreed(returned: string[], agreed: string[]): string[] {
  const set = new Set(agreed.map(key));
  if (!set.size) return returned;
  return returned.filter((n) => {
    const k = key(n);
    return [...set].some((a) => a === k || a.includes(k) || k.includes(a));
  });
}

test("a business the model found interesting is dropped", () => {
  const out = keepOnlyAgreed(
    ["HINCES", "Darwin's Barbers", "NO.1 BARBERS", "The Fade Inn"],
    ["HINCES", "NO.1 BARBERS", "Branded Barbers"],
  );
  assert.deepEqual(out, ["HINCES", "NO.1 BARBERS"]);
});

test("the same shop under a slightly different name is kept", () => {
  // "HINCES" and "HINCES Barber" are one shop. Refusing one of them would throw
  // away the evidence we actually gathered about it.
  assert.deepEqual(keepOnlyAgreed(["HINCES"], ["HINCES Barber"]), ["HINCES"]);
  assert.deepEqual(keepOnlyAgreed(["HINCES Barber"], ["HINCES"]), ["HINCES Barber"]);
});

test("punctuation and case do not make two shops out of one", () => {
  assert.deepEqual(keepOnlyAgreed(["no.1 barbers"], ["NO.1 BARBERS"]), ["no.1 barbers"]);
  assert.deepEqual(keepOnlyAgreed(["Darwin's Barbers"], ["Darwins Barbers"]), ["Darwin's Barbers"]);
});

test("a different shop with a similar word is still dropped", () => {
  assert.deepEqual(keepOnlyAgreed(["Golden Scissors"], ["Silver Scissors"]), []);
});

test("with nothing agreed it does not silently empty the card", () => {
  // If ranking produced nothing, dropping everything would turn a thin result
  // into a blank one, which is worse and harder to diagnose.
  assert.deepEqual(keepOnlyAgreed(["Anyone"], []), ["Anyone"]);
});
