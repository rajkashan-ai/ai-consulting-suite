import { test } from "node:test";
import assert from "node:assert/strict";
import { assertNoContactDetails, redact, safeQuote } from "../lib/privacy/redact.ts";

// TESTING.md: a feature arrives with its criteria as tests. These are the
// criteria for "we do not store other people's personal data".

test("takes out an email address", () => {
  const { text, removed } = redact("Ask for dave@barbers.co.uk, he is great");
  assert.ok(!text.includes("dave@barbers.co.uk"));
  assert.deepEqual(removed, ["an email address"]);
});

test("takes out UK phone numbers in the shapes people actually write them", () => {
  for (const number of [
    "07700 900123",
    "07700900123",
    "+44 7700 900123",
    "01743 123456",
    "01743 123 456",
  ]) {
    const { text } = redact(`Call ${number} to book`);
    // No digit of it survives. The weaker check, that the last six digits are
    // gone, passed while a leading "0" was still being left behind.
    assert.equal(text, "Call [phone] to book", number);
  }
});

test("takes out a full postcode but leaves the district", () => {
  assert.ok(!redact("They are at SY1 2AB").text.includes("SY1 2AB"));
  // A district is a place, not a household, and it is how we know which town
  // a business works in.
  assert.equal(redact("Covering the SY1 area").text, "Covering the SY1 area");
});

test("takes out a social handle, but keeps the business's own", () => {
  const { text } = redact("Great cut from @dave_the_barber at @hincesuk", {
    keep: ["@hincesuk"],
  });
  assert.ok(!text.includes("@dave_the_barber"));
  assert.ok(text.includes("@hincesuk"));
});

test("takes out names we were given, whole words only", () => {
  const { text } = redact("Mark marked the line perfectly", { names: ["Mark"] });
  assert.equal(text, "[a person] marked the line perfectly");
});

test("a quote longer than 25 words is dropped, not trimmed", () => {
  // Rule 5: we summarise, we never reproduce. A trimmed quote is still a copy.
  assert.equal(safeQuote(Array(30).fill("word").join(" ")), null);
  assert.ok(safeQuote("The attention to detail is ridiculous"));
});

test("a quote is dropped rather than cleaned when a contact detail survives", () => {
  assert.equal(safeQuote("Best barber, text 07700 900123"), null);
});

test("the last gate throws instead of quietly cleaning", () => {
  assert.throws(
    () => assertNoContactDetails({ quote: "email me at a@b.co" }, "a battlecard"),
    /Refusing to store an email address/,
  );
  assert.doesNotThrow(() =>
    assertNoContactDetails({ quote: "Five stars, quick and tidy" }, "a battlecard"),
  );
});

test("a regex with the global flag does not go stale between calls", () => {
  // lastIndex on a shared /g regex is the classic way a check passes on the
  // first call and silently fails on the second. Run it twice, same answer.
  const bad = { quote: "a@b.co" };
  assert.throws(() => assertNoContactDetails(bad, "one"));
  assert.throws(() => assertNoContactDetails(bad, "two"));
});
