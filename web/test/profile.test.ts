/**
 * The profile form, and the rule that a blank box is not always a delete.
 *
 * Signing up needs a web address and nothing else, so somebody can see what the
 * tools do before deciding whether we are worth typing an address into. Every
 * field here is optional and none of it is a gate.
 *
 * Which makes the dangerous case a quiet one: a form that saves a blank over
 * something they told us last week, and nobody notices until a post is written
 * without it.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { changesFrom, looksLikeEmail } from "../tools/profile.ts";

const CHANNELS = ["instagram", "facebook", "tiktok", "linkedin", "x", "youtube"];
const form = (pairs: [string, string][]) => {
  const f = new FormData();
  for (const [k, v] of pairs) f.append(k, v);
  return f;
};

test("a field nobody was asked about is left alone", () => {
  const got = changesFrom(form([["name", "A Cut Above"]]), CHANNELS);
  assert.deepEqual(got, { name: "A Cut Above" });
  assert.ok(!("town" in got), "a field that was not on the form was written anyway");
  assert.ok(!("channels" in got), "channels were written without being asked");
});

test("a field they emptied on purpose is a correction, and is saved as one", () => {
  /* It has to be possible to take something out, or the correction is not a
     correction. Null, not an empty string: "we do not know" and "they told us
     it is blank" should not be two different values in the column. */
  const got = changesFrom(form([["town", "   "]]), CHANNELS);
  assert.deepEqual(got, { town: null });
});

test("posting nowhere is an answer, and not being asked is not", () => {
  /**
   * The one that matters. "We asked and they post nowhere" lets the planner
   * stop guessing; "nobody asked" must let it keep reading their page text.
   * Without the marker both arrive as an empty list.
   */
  const asked = changesFrom(form([["channelsAsked", "1"]]), CHANNELS);
  assert.deepEqual(asked, { channels: [] }, "an unticked form did not record an answer");

  const notAsked = changesFrom(form([["name", "x"]]), CHANNELS);
  assert.ok(!("channels" in notAsked), "silence was recorded as posting nowhere");
});

test("only channels we know about are kept", () => {
  const got = changesFrom(
    form([["channelsAsked", "1"], ["channel", "instagram"], ["channel", "myspace"], ["channel", "facebook"]]),
    CHANNELS,
  );
  assert.deepEqual(got, { channels: ["instagram", "facebook"] });
});

test("an address we would send their work to is checked, not assumed", () => {
  const bad = changesFrom(form([["contact_email", "not an address"]]), CHANNELS);
  assert.ok("error" in bad, "a bad address was saved");
  assert.match((bad as { error: string }).error, /email address/i);

  const good = changesFrom(form([["contact_email", "bookings@yoursalon.co.uk"]]), CHANNELS);
  assert.deepEqual(good, { contact_email: "bookings@yoursalon.co.uk" });
});

test("emptying the email means the address they sign in with, not a blank", () => {
  assert.deepEqual(changesFrom(form([["contact_email", ""]]), CHANNELS), { contact_email: null });
});

test("nothing on the form changes nothing", () => {
  assert.deepEqual(changesFrom(form([]), CHANNELS), {});
});

test("what counts as an address", () => {
  for (const ok of ["a@b.co", "bookings@yoursalon.co.uk", "sam.lee+posts@salon.com"]) {
    assert.equal(looksLikeEmail(ok), true, ok);
  }
  for (const no of ["", "sam", "sam@", "@salon.co.uk", "sam@salon", "two @spaces.com"]) {
    assert.equal(looksLikeEmail(no), false, no);
  }
});

test("everything is trimmed, because a trailing space is not part of a town", () => {
  assert.deepEqual(changesFrom(form([["town", "  St Albans  "]]), CHANNELS), { town: "St Albans" });
});
