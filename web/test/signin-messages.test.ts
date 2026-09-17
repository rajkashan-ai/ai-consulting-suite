import { test } from "node:test";
import assert from "node:assert/strict";
import { readable } from "../app/sign-in/messages.ts";

/**
 * 15 September: pressing "Email me a code" with no Supabase project behind the
 * app said "That did not work. Try again." Trying again could never have
 * worked. A message that blames itself vaguely sends the reader to the wrong
 * place, which for a customer is us and for us is the code.
 */

test("an unreachable service says it is not set up, in every browser's wording", () => {
  for (const wording of [
    "TypeError: Failed to fetch",          // Chrome
    "NetworkError when attempting to fetch resource.", // Firefox
    "Load failed",                          // Safari
    "fetch failed",                         // Node
  ]) {
    assert.match(readable(wording), /not set up yet/, wording);
  }
});

test("a missing setting points at the setup notes, not at the user", () => {
  assert.match(
    readable("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local"),
    /no Supabase project behind it yet/,
  );
});

test("someone not on the list is told plainly", () => {
  assert.match(readable("Database error saving new user"), /not on the list/);
  assert.match(readable("not_invited"), /not on the list/);
});

test("a wrong code is separated from a broken app", () => {
  assert.match(readable("Token has expired or is invalid"), /wrong or has expired/);
});

test("nothing ever says whether an email exists", () => {
  // Typing addresses in and watching which behave differently must not be a
  // way of finding out who our customers are.
  for (const m of [
    "User not found",
    "User already registered",
    "Email not confirmed",
    "Signups not allowed for otp",
  ]) {
    const said = readable(m).toLowerCase();
    assert.ok(!said.includes("exist"), m);
    assert.ok(!said.includes("already"), m);
    assert.ok(!said.includes("registered"), m);
    assert.ok(!said.includes("no account"), m);
  }
});

test("an unknown error still says something, and never nothing", () => {
  assert.ok(readable("something nobody predicted").length > 20);
});
