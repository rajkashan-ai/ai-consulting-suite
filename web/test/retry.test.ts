import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AT_ONCE,
  ENOUGH_NAMES,
  MOST_TRIES,
  enough,
  nextToTry,
  refusals,
  worthRetrying,
  type Attempt,
} from "../tools/competitor-tracker/retry.ts";

/**
 * Trying again, and trying elsewhere.
 *
 * The tool took the first two listing platforms it recognised, read them, and
 * carried on with whatever came back. If Checkatrade returned 403 and the other
 * timed out, the run continued with nothing off either, told the owner nothing,
 * and the thin result looked exactly like a thin market.
 *
 * Raj, 2026-09-16: the job of this tool is to provide the best competitor data
 * we possibly can, so this needs addressing.
 */

const a = (url: string, note = "", ok = false): Attempt => ({ url, ok, note });

const BOOKSY = "https://booksy.com/en-gb/s/barber/1227928_shrewsbury";
const FRESHA = "https://fresha.com/lp/en/bt/barbershops/in/gb-shrewsbury";
const CHECKA = "https://checkatrade.com/search/plumbers/shrewsbury";

// ---------------------------------------------------------------------------
// Which failures are worth asking about again.
// ---------------------------------------------------------------------------

test("a refusal is settled, and asking again is rude as well as useless", () => {
  for (const note of [
    "Their site refused us, and we do not work around a block",
    "403 Forbidden",
    "Their robots.txt asks us not to read it",
    "It is behind a login, and we never sign in to anything",
    "That page is not there, or the address does not resolve",
    "404 not found",
  ]) {
    assert.equal(worthRetrying(note), false, note);
  }
});

test("a timeout is worth asking again, because it is the one that might change", () => {
  for (const note of [
    "Their site did not answer in time",
    "timed out",
    "The page came back with nothing in it",
    "503 Service Unavailable",
    "ECONNRESET",
  ]) {
    assert.equal(worthRetrying(note), true, note);
  }
});

test("a note nobody anticipated is treated as settled", () => {
  // Deliberately narrow. The cost of guessing wrong the other way is asking
  // somebody's server again and again for a reason we never predicted.
  assert.equal(worthRetrying("something we have never seen"), false);
  assert.equal(worthRetrying(""), false);
});

test("a settled word beats a transient one in the same note", () => {
  // A 403 page whose body happens to say "temporarily unavailable" is a 403.
  assert.equal(worthRetrying("403 Forbidden: temporarily blocked"), false);
});

// ---------------------------------------------------------------------------
// What to try next.
// ---------------------------------------------------------------------------

test("a platform that refused us sends us to the next one, not back to it", () => {
  const next = nextToTry([BOOKSY, FRESHA, CHECKA], [a(BOOKSY, "403 Forbidden")]);
  assert.ok(!next.includes(BOOKSY), "we went back to a door that was shut");
  assert.ok(next.includes(FRESHA));
});

test("a platform that timed out is asked once more", () => {
  const next = nextToTry([BOOKSY, FRESHA], [a(BOOKSY, "did not answer in time"), a(FRESHA, "403")]);
  assert.deepEqual(next, [BOOKSY]);
});

test("but only once more", () => {
  const tried = [a(BOOKSY, "did not answer in time"), a(BOOKSY, "did not answer in time")];
  assert.deepEqual(nextToTry([BOOKSY], tried), []);
});

test("somewhere untried beats asking a timeout again", () => {
  // A different platform is a better bet than the same one twice.
  const next = nextToTry([BOOKSY, FRESHA], [a(BOOKSY, "did not answer in time")]);
  assert.equal(next[0], FRESHA);
});

test("a place that worked is not asked again", () => {
  assert.deepEqual(nextToTry([BOOKSY], [a(BOOKSY, "", true)]), []);
});

test("no more than two at once, and never more than the ceiling in total", () => {
  const many = Array.from({ length: 20 }, (_, i) => `https://x${i}.example/list`);
  assert.equal(nextToTry(many, []).length, AT_ONCE);

  const spent = many.slice(0, MOST_TRIES).map((u) => a(u, "403"));
  assert.deepEqual(nextToTry(many, spent), [], "kept going past the ceiling");
});

test("past the ceiling it stops, rather than counting backwards", () => {
  /**
   * The case that a plain "exactly at the ceiling" test cannot see.
   *
   * The count is also clamped further down, with
   * `slice(0, Math.min(AT_ONCE, MOST_TRIES - tried.length))`. At exactly the
   * ceiling that clamp is slice(0, 0) and returns nothing, so removing the
   * early return changed no test result. One attempt past it the clamp goes
   * negative, slice counts from the end instead, and it starts handing back
   * urls again. Two guards that agree in the normal case and disagree in the
   * one that matters.
   */
  const many = Array.from({ length: 20 }, (_, i) => `https://x${i}.example/list`);
  const over = many.slice(0, MOST_TRIES + 2).map((u) => a(u, "403"));
  assert.deepEqual(nextToTry(many, over), [], "started again past the ceiling");
});

test("the ceiling is respected part way through a batch", () => {
  const many = Array.from({ length: 20 }, (_, i) => `https://x${i}.example/list`);
  const spent = many.slice(0, MOST_TRIES - 1).map((u) => a(u, "403"));
  assert.equal(nextToTry(many, spent).length, 1, "asked for two when one was left");
});

// ---------------------------------------------------------------------------
// When to stop.
// ---------------------------------------------------------------------------

test("enough names does not stop the looking while a platform is untouched", () => {
  /**
   * Changed deliberately on 2026-09-16. It asserted the opposite and the
   * opposite was wrong.
   *
   * A real run searched Booksy and Fresha, got twelve Fresha results, read
   * Booksy first, found thirty two names, decided that was plenty and stopped.
   * Every barber on Fresha and not on Booksy was invisible, and nothing said
   * so. Enough names is not the same as enough coverage.
   */
  const names = Array.from({ length: ENOUGH_NAMES }, (_, i) => `Shop ${i}`);
  assert.equal(enough(names, [BOOKSY, FRESHA, CHECKA], []), false);
});

test("enough names stops it once every platform has been looked at", () => {
  const names = Array.from({ length: ENOUGH_NAMES }, (_, i) => `Shop ${i}`);
  const tried = [a(BOOKSY, "", true), a(FRESHA, "", true), a(CHECKA, "403")];
  assert.equal(enough(names, [BOOKSY, FRESHA, CHECKA], tried), true);
});

test("a second page of the same platform does not count as covering it", () => {
  // Two pages of one platform mostly list the same businesses twice. A
  // platform is covered when we have asked it, not when we have asked twice.
  const names = Array.from({ length: ENOUGH_NAMES }, (_, i) => `Shop ${i}`);
  const twoBooksy = [BOOKSY, `${BOOKSY}-2`, FRESHA];
  assert.equal(enough(names, twoBooksy, [a(BOOKSY, "", true), a(`${BOOKSY}-2`, "", true)]), false);
});

test("an untouched platform is tried before a second page of one we have read", () => {
  const next = nextToTry([`${BOOKSY}-2`, FRESHA], [a(BOOKSY, "", true)]);
  assert.equal(next[0], FRESHA, "it went back to the same platform first");
});

test("running out of places stops it too, however few names we have", () => {
  assert.equal(enough([], [BOOKSY], [a(BOOKSY, "403")]), true);
});

test("a thin result with somewhere left to look is not finished", () => {
  assert.equal(enough(["One Shop"], [BOOKSY, FRESHA], [a(BOOKSY, "403")]), false);
});

// ---------------------------------------------------------------------------
// What the owner is told.
// ---------------------------------------------------------------------------

test("every place that turned us away is reported", () => {
  const said = refusals([a(BOOKSY, "403 Forbidden"), a(CHECKA, "did not answer in time")]);
  assert.deepEqual(said.map((r) => r.name).sort(), ["booksy.com", "checkatrade.com"]);
});

test("asking twice is one line, not two", () => {
  // An owner does not need to know we retried.
  const said = refusals([a(BOOKSY, "did not answer"), a(BOOKSY, "did not answer")]);
  assert.equal(said.length, 1);
});

test("a place that refused and then worked is not reported as a refusal", () => {
  const said = refusals([a(BOOKSY, "did not answer"), a(BOOKSY, "", true)]);
  assert.deepEqual(said, []);
});

test("a place is named by its site, not by a full url", () => {
  const said = refusals([a("https://www.checkatrade.com/search/plumbers/shrewsbury?x=1", "403")]);
  assert.equal(said[0].name, "checkatrade.com");
});

test("an unparseable address does not crash the report", () => {
  assert.equal(refusals([a("not a url", "403")]).length, 1);
});

// ---------------------------------------------------------------------------
// Through the pipeline, which is where the last three gaps were. 2026-09-16.
// ---------------------------------------------------------------------------

import { advance, type RunState } from "../tools/competitor-tracker/stages.ts";
import { aBusiness, fakeContext, type Recorded } from "./fake.ts";
import { sourceOf } from "./tool-source.ts";

const recorded = JSON.parse(
  readFileSync(join(import.meta.dirname, "fixtures", "shrewsbury.json"), "utf8"),
) as Recorded;

/** Run to the end of choosing, with some pages refusing us. */
async function withRefusals(refuse: (url: string) => string | null) {
  const { ctx } = fakeContext(recorded, {});
  const read = ctx.read;
  const asked: string[] = [];

  ctx.read = async (url: string) => {
    asked.push(url);
    const note = refuse(url);
    if (note) {
      return {
        ok: false,
        url,
        text: "",
        title: null,
        fetchedAt: new Date().toISOString(),
        note,
      };
    }
    return read(url);
  };

  let state: RunState = {};
  let stage = "searching" as never;
  for (let i = 0; i < 30; i += 1) {
    const step = await advance(stage, state, aBusiness(), ctx);
    stage = step.stage as never;
    state = step.state;
    if (stage === "reading" || stage === "failed" || stage === "done") break;
  }
  return { state, stage, asked };
}

test("a platform that refuses us sends the run to the next one", async () => {
  // The case that started this: Checkatrade returns 403 and the run used to
  // carry on with nothing, silently.
  let booksyAsked = 0;
  const { state, asked } = await withRefusals((url) => {
    if (url.includes("booksy")) {
      booksyAsked += 1;
      return "Their site refused us, and we do not work around a block";
    }
    return null;
  });

  assert.equal(booksyAsked, 1, "we went back to a door that was shut");
  assert.ok(
    asked.some((u) => u.includes("fresha")),
    "the next platform was never tried",
  );
  assert.ok((state.fromListings ?? []).length > 0, "no names came from anywhere");
});

test("a platform that times out is asked again when we still need names", async () => {
  /**
   * Only when we still need them. The first version of this test expected the
   * retry unconditionally and failed, because the other platform had answered
   * and given us enough: going back for a second try would have been work for
   * nothing, and a second request to a server that was already struggling.
   *
   * So both platforms fail here, which is the case where the retry is the whole
   * point.
   */
  const asks = new Map<string, number>();
  await withRefusals((url) => {
    if (!/booksy|fresha/.test(url)) return null;
    asks.set(url, (asks.get(url) ?? 0) + 1);
    return "Their site did not answer in time";
  });

  // Counted per page, not per site: a town can have two listing pages on the
  // same platform, and counting by host made a correct run look like four
  // requests to one server.
  const counts = [...asks.values()];
  assert.ok(counts.length > 0, "no listing page was tried at all");
  assert.ok(
    counts.some((n) => n === 2),
    `no page was asked twice: ${JSON.stringify([...asks])}`,
  );
  assert.ok(
    counts.every((n) => n <= 2),
    `a page was asked more than twice: ${JSON.stringify([...asks])}`,
  );
});

test("a timeout is not retried once somewhere else has answered", async () => {
  // The opposite guard, and the reason the test above needed both to fail.
  let booksy = 0;
  await withRefusals((url) => {
    if (!url.includes("booksy")) return null;
    booksy += 1;
    return "Their site did not answer in time";
  });

  assert.equal(booksy, 1, "asked again after we already had what we needed");
});

test("when every platform refuses, the run says which ones and does not pretend", async () => {
  const { state } = await withRefusals((url) =>
    /booksy|fresha/.test(url) ? "Their site refused us, and we do not work around a block" : null,
  );

  const refused = state.refusedSources ?? [];
  assert.ok(refused.length >= 2, `only ${refused.length} refusals were recorded`);
  assert.ok(
    refused.some((r) => r.name.includes("booksy")),
    "a platform that turned us away was not reported",
  );
});

test("looking harder stops once there are enough names", async () => {
  // A good first listing must not send us round every platform for nothing.
  const { asked } = await withRefusals(() => null);
  const listings = asked.filter((u) => /\/(s|lp)\//.test(u));
  assert.ok(listings.length <= AT_ONCE, `read ${listings.length} listings when the first was enough`);
});

test("a listing for the wrong country is never fetched, however trusted the host", () => {
  /**
   * A real run read booksy.com/en-us/s/barber-shop/28689_shrewsbury:
   * Shrewsbury in the United States. The check was `(isOurs || trusted)`, so a
   * known platform skipped the country test altogether, and "shrewsbury" is in
   * the address of both towns. We paid to read it and fed its businesses into a
   * Shropshire comparison.
   *
   * Read off the source, because the choosing happens inside the listings step
   * and nothing else can reach it.
   */
  // Comments stripped: the note explaining why the old check went still
  // contains the old check, and a test that fires on its own explanation is a
  // test that can never pass. Third time today.
  const src = sourceOf("competitor-tracker")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/\s+/g, " ");

  assert.doesNotMatch(src, /\(isOurs \|\| trusted\)/, "a trusted host bypasses the country check again");
  // The playbook may still vouch for a page being a listing. It may never
  // vouch for the country: clearlyNotOurs is checked whoever serves the page.
  assert.match(src, /looksLikeAListing && ours && !clearlyNotOurs/);
  assert.match(src, /const ours = isOurs \|\| \(trusted && !clearlyNotOurs\)/);
  assert.match(src, /en-us/, "nothing rules out an American listing");
});
