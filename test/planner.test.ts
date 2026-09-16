import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Business, ToolContext } from "../tools/types.ts";
import { advance, channelsFor, firstLine, knownFacts, worthReading, type ReadPage, type RunState, type Stage } from "../tools/content-social-planner/stages.ts";
import { buildBody, hollow } from "../tools/content-social-planner/document.ts";
import { unsafe } from "../tools/content-social-planner/scrub.ts";
import { contentSocialPlanner } from "../tools/content-social-planner/index.ts";
import { expand, numberPages, cite, citeRules } from "../tools/content-social-planner/sources.ts";
import { shapeMonth, expectedPosts } from "../tools/content-social-planner/shape.ts";
import { validateShape } from "../../Agents/Content & Social Planner/src/plan-shape.ts";
import { CHANNEL } from "../../Agents/Content & Social Planner/src/types.ts";

/**
 * The Content Planner, run end to end without the web or the model.
 *
 * The pages are a real capture of shrewsburybarber.co.uk, read on 16 September,
 * with scripts and styles stripped. Not written by me: a fixture I invent tests
 * my idea of what their site says, which is the thing most likely to be wrong.
 */

const FIXTURE = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "tools", "content-social-planner", "fixtures", "barber.json"), "utf8"),
) as { pages: { url: string; ok: boolean; title: string | null; text: string; fetchedAt: string; note: string }[] };

const BUSINESS: Business = {
  id: "b1",
  website: "https://shrewsburybarber.co.uk",
  name: "The Barber Shop Shrewsbury",
  trade: "barber",
  town: "Shrewsbury",
  address: "Castle Gates",
  headlinePrice: 8,
  services: [
    { name: "Clipper cut", price: "£8.00" },
    { name: "Classic cut", price: "£15.00" },
    { name: "Beard trim", price: "£8.00" },
  ],
  oneLiner: "A barber shop in Shrewsbury.",
  reach: "town",
  foundVia: [],
  knownCompetitor: null,
};

type Calls = { read: string[]; think: { shape?: string; system: string; prompt: string; schema?: unknown }[] };

/** A post the model might plausibly return, sourced to page 1. */
const GOOD_POST = {
  words:
    "Our prices, so nobody has to ask first. Clipper cut is eight pounds, a classic cut is fifteen, " +
    "and a beard trim is eight. We are appointment only, so ring ahead and we will find you a slot " +
    "that suits. Most people are in and out inside half an hour.",
  shot: "Your price list where you actually have it written down.",
  why: "A price nobody has to ask for is a reason to walk in.",
  from: 1,
};

/**
 * `post` is a template, not a list. Fixing the list at one post meant the fake
 * answered a two post week with one post, every test using an override failed
 * on "we did not get a full week back", and the thing each was written to
 * check was never reached.
 */
function fake(answers: Record<string, unknown> = {}, post?: Record<string, unknown>) {
  const calls: Calls = { read: [], think: [] };
  const ctx: ToolContext = {
    read: async (url) => {
      calls.read.push(url);
      /* The real reader follows redirects and hands back where it landed. The
         capture landed on www and the business row says the apex, so a fake
         that matched on the string alone served nothing and every test failed
         at the first page. A fake that is easier to satisfy than the thing it
         stands in for is worse than no fake. */
      const key = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
      const hit = FIXTURE.pages.find((p) => key(p.url) === key(url));
      if (hit) return { ...hit };
      /* A page the site does not have. The real reader answers with a refusal
         rather than throwing, and a guessed path that is not there is the
         normal case, not an error. */
      return { ok: false, url, text: "", title: null, fetchedAt: "2026-09-16T09:00:00.000Z", note: "not in the fixture" };
    },
    think: async (o) => {
      calls.think.push({ shape: o.shape?.name, system: o.system, prompt: o.prompt, schema: o.shape?.input_schema });
      const name = o.shape?.name ?? "";
      if (name in answers) return answers[name];
      if (name === "voice") return { words: "Plain and quick. They say what things cost and expect you to ring.", from: 1 };
      if (name === "posts") {
        const n = (o.shape!.input_schema as { properties: { posts: { minItems: number } } }).properties.posts.minItems;
        return { posts: Array.from({ length: n }, () => ({ ...GOOD_POST, ...(post ?? {}) })) };
      }
      return {};
    },
    search: async () => [],
    progress: () => {},
  };
  return { ctx, calls };
}

/** Drive the whole pipeline to a stop, exactly as the engine would. */
async function runToEnd(ctx: ToolContext, business = BUSINESS, cap = 25) {
  let stage: Stage = "reading";
  let state: RunState = {};
  const seen: Stage[] = [];
  for (let i = 0; i < cap && stage !== "done" && stage !== "failed"; i++) {
    const step = await advance(stage, state, business, ctx);
    stage = step.stage;
    state = step.state;
    seen.push(stage);
  }
  return { stage, state, seen };
}

/* ── it runs ──────────────────────────────────────────────────────────────── */

test("a real site produces a real month of posts, offline", async () => {
  const { ctx } = fake();
  const { stage, state } = await runToEnd(ctx);

  assert.equal(stage, "done", state.reason ?? "");
  assert.ok((state.posts ?? []).length >= 4, `only ${(state.posts ?? []).length} slots`);
  const written = (state.posts ?? []).filter((p) => "words" in p);
  assert.ok(written.length >= 1, "nothing was written");
  for (const p of written) {
    assert.ok((p as { source?: { url: string } }).source?.url, "a post reached the end with no source");
  }
});

test("it reads their own pages and nobody else's", async () => {
  const { ctx, calls } = fake();
  await runToEnd(ctx);
  for (const url of calls.read) {
    assert.match(url, /shrewsburybarber\.co\.uk/, `it went off their site to ${url}`);
  }
  assert.ok(calls.read.length >= 2, "it only ever read the home page");
});

test("each step stops, so a closed tab loses one step and not the run", async () => {
  const { ctx } = fake();
  let stage: Stage = "reading";
  let state: RunState = {};
  const step = await advance(stage, state, BUSINESS, ctx);
  assert.notEqual(step.stage, "done", "one call did the whole run");
  assert.ok(step.progress.length > 0, "a step said nothing about what it did");
  // Resuming from the saved state alone, with nothing else carried over.
  const resumed = await advance(step.stage, JSON.parse(JSON.stringify(step.state)), BUSINESS, ctx);
  assert.notEqual(resumed.stage, "failed", resumed.state.reason ?? "");
});

/* ── the month is the shape the rules require ─────────────────────────────── */

test("the month is listed one row per week, not one per post", async () => {
  const { ctx } = fake();
  const { state } = await runToEnd(ctx);
  const weeks = state.weeks ?? [];

  assert.ok(weeks.length, "no month spine at all");
  assert.equal(
    new Set(weeks.map((w) => w.week)).size,
    weeks.length,
    `the same week is listed twice: ${weeks.map((w) => w.week).join(", ")}`,
  );
  assert.equal(
    weeks.reduce((n, w) => n + w.posts, 0),
    (state.posts ?? []).length,
    "the weeks do not add up to the month",
  );
  for (const w of weeks) {
    assert.equal(new Set(w.channels).size, w.channels.length, `${w.week} lists a channel twice`);
  }
});

test("the month satisfies the shape rules in the agent folder", () => {
  for (const cadence of ["weekly", "twice-weekly", "most-days"] as const) {
    const slots = shapeMonth(cadence, "2026-09-16T09:00:00.000Z", ["instagram", "facebook"]);
    assert.equal(slots.length, expectedPosts(cadence), `${cadence} has the wrong number of posts`);
    const problems = validateShape({ posts: slots, cadence, channels: ["instagram", "facebook"] } as never);
    assert.deepEqual(problems, [], `${cadence}: ${JSON.stringify(problems)}`);
  }
});

test("no angle runs twice together, and none more than three times a month", () => {
  for (const cadence of ["weekly", "twice-weekly", "most-days"] as const) {
    const slots = shapeMonth(cadence, "2026-09-16T09:00:00.000Z", ["instagram"]);
    const counts: Record<string, number> = {};
    slots.forEach((s, i) => {
      counts[s.angle] = (counts[s.angle] ?? 0) + 1;
      if (i) assert.notEqual(s.angle, slots[i - 1].angle, `${cadence} repeats ${s.angle} back to back`);
    });
    for (const [angle, n] of Object.entries(counts)) {
      assert.ok(n <= 3, `${cadence} uses ${angle} ${n} times`);
    }
  }
});

/* ── the model never writes a url ─────────────────────────────────────────── */

test("the model is never asked for a url, and is told to cite by number", async () => {
  const { ctx, calls } = fake();
  await runToEnd(ctx);
  assert.ok(calls.think.length >= 2, "the model was barely asked anything");
  for (const call of calls.think) {
    assert.match(call.prompt, /Cite by number, never by url/, `${call.shape} was not given the rule`);
    const schema = JSON.stringify(call.schema ?? {});
    assert.doesNotMatch(schema, /"url"|"link"|"href"/, `${call.shape} asks the model for a url`);
  }
});

test("a page number nobody handed out becomes no source at all", () => {
  const pages = numberPages([{ url: "https://x.test/a", fetchedOn: "2026-09-16", what: "home" }]);
  assert.equal(expand(pages, 2), null, "an out of range number found a page");
  assert.equal(expand(pages, 0), null, "page zero found a page");
  assert.equal(expand(pages, "2"), null);
  assert.deepEqual(expand(pages, 1), { url: "https://x.test/a", fetchedOn: "2026-09-16" });
});

test("expand refuses anything that is not a number we handed out", () => {
  const pages = numberPages([{ url: "https://x.test/a", fetchedOn: "2026-09-16", what: "home" }]);
  // Number(true) is 1. This is the one function that must not coerce.
  for (const nasty of [true, [1], { valueOf: () => 1 }, "1.0", " 1x", null, undefined]) {
    assert.equal(expand(pages, nasty), null, `${JSON.stringify(nasty)} became page one`);
  }
});

test("citing walks to wherever the shape put it", () => {
  const pages = numberPages([{ url: "https://x.test/a", fetchedOn: "2026-09-16", what: "home" }]);
  const out = cite({ deep: { list: [{ words: "hi", from: 1 }] } }, pages) as unknown as {
    deep: { list: { source: { url: string } | null }[] };
  };
  assert.equal(out.deep.list[0].source?.url, "https://x.test/a");
});

/* ── nothing unsupported reaches the screen ───────────────────────────────── */

test("a post with an invented client is taken off, not reworded", async () => {
  const { ctx } = fake({}, {
    words:
      "How we solved a complex commercial heating failure for Acme Corp last month, saving them " +
      "forty per cent on their annual bill and cutting their downtime to nothing at all this year.",
    shot: "A photo of the boiler before and after, taken on your phone.",
    why: "It shows what we can do.",
  });
  const { state } = await runToEnd(ctx);
  const kept = (state.posts ?? []).filter((p) => "words" in p);
  assert.equal(kept.length, 0, "an invented client reached the screen");
  assert.ok((state.dropped ?? []).length >= 1, "it was dropped without saying so");
});

test("a post citing a page we never read is taken off", async () => {
  const { ctx } = fake({}, { from: 99 });
  const { state, stage } = await runToEnd(ctx);
  assert.equal(stage, "failed", "a post with no source survived");
  assert.match(state.reason ?? "", /backed by your own pages/);
});

test("a post with no source and a post citing a page we never read give different reasons", () => {
  /**
   * Both were caught, by two checks, and only one of them was ever exercised:
   * taking the first one out left the second catching a post with no source at
   * all and telling the owner it "cites a page we did not read", which is a
   * different and untrue thing. The mutation came back green and that looked
   * like a redundant check. It was a missing assertion.
   */
  const known = knownFacts({ ...BUSINESS, services: [] });
  const pages = numberPages([{ url: "https://x.test/a", fetchedOn: "2026-09-16", what: "home" }]);
  const post = {
    date: "2026-09-17", week: 1, channel: "instagram" as const, angle: "the-ask" as const,
    purpose: "offer" as const,
    words: "A plain post about the prices we publish on our own page, nothing invented here at all.",
    shot: "A photo of the price list where you keep it.",
    why: "Because they ask.",
  };

  assert.match(unsafe({ ...post, source: null }, pages, known) ?? "", /nothing on your own site/);
  assert.match(
    unsafe({ ...post, source: { url: "https://other.test", fetchedOn: "2026-09-16" } }, pages, known) ?? "",
    /a page we did not read/,
  );
  assert.equal(unsafe({ ...post, source: pages[0] }, pages, known), null, "a good post was refused");
});

test("what the reader is told about a drop is in their words, not ours", async () => {
  const { ctx } = fake({}, { words: GOOD_POST.words + " You are overdue a post." });
  const { state } = await runToEnd(ctx);
  for (const d of state.dropped ?? []) {
    assert.doesNotMatch(d.why, /guard|stage|schema|token|page \d/i, `machinery reached the screen: ${d.why}`);
  }
});

/* ── the document ─────────────────────────────────────────────────────────── */

test("a hollow document is refused rather than stored", () => {
  assert.match(hollow(null) ?? "", /no plan/);
  const shaped = buildBody({
    recommendation: { cadence: "weekly", because: [{ from: "our-arithmetic", text: "x" }] } as never,
    cadence: "weekly",
    channels: ["instagram"],
    slots: [{ date: "2026-09-17", week: 1, channel: "instagram", angle: "the-ask", purpose: "offer" }],
    pages: [{ url: "https://x.test", fetchedOn: "2026-09-16", what: "" }],
  } as RunState);
  assert.match(hollow(shaped) ?? "", /laid out but nothing was written/);
});

test("a document that is fine is not refused", async () => {
  const { ctx } = fake();
  const { state } = await runToEnd(ctx);
  const body = buildBody(state);
  assert.equal(hollow(body), null, hollow(body) ?? "");
});

test("every reason for the cadence carries where it came from", async () => {
  const { ctx } = fake();
  const { state } = await runToEnd(ctx);
  for (const r of state.recommendation?.because ?? []) {
    assert.ok(r.from, `"${r.text}" has nothing behind it`);
  }
});

/* ── the contract ─────────────────────────────────────────────────────────── */

test("the runner provides the whole contract and never throws", async () => {
  assert.equal(contentSocialPlanner.slug, "content-social-planner");
  for (const key of ["advance", "buildBody", "hollow", "title"] as const) {
    assert.equal(typeof contentSocialPlanner[key], "function", `${key} is missing`);
  }
  // A stage it has never heard of must fail the run, not throw at the engine.
  const { ctx } = fake();
  const step = await contentSocialPlanner.advance("nonsense" as never, {} as never, BUSINESS, ctx);
  assert.ok(step.stage, "it threw instead of failing");
});

test("a website that will not open fails politely", async () => {
  const { ctx } = fake();
  const { stage, state } = await runToEnd(ctx, { ...BUSINESS, website: "https://nothing.test" });
  assert.equal(stage, "failed");
  assert.match(state.reason ?? "", /could not open your website/);
  assert.doesNotMatch(state.reason ?? "", /fetch|ENOTFOUND|undefined|stage/i);
});

/* ── the small pieces ─────────────────────────────────────────────────────── */

test("the pages come from the site's own sitemap, best first", async () => {
  const { ctx } = fake();
  const raw = FIXTURE.pages.find((p) => new URL(p.url).pathname === "/")!;
  const home: ReadPage = { ...raw, fetchedOn: raw.fetchedAt.slice(0, 10) };
  const got = await worthReading("https://www.shrewsburybarber.co.uk", home, ctx);

  assert.ok(got.length, "the sitemap told us nothing");
  assert.ok(
    got.some((u) => u.includes("price-menu")),
    `the price list is not in ${JSON.stringify(got)}`,
  );
  assert.match(got[0], /price|menu|rate|cost/i, `${got[0]} was read before the prices`);
  for (const u of got) assert.match(u, /shrewsburybarber\.co\.uk/, `${u} is not their site`);
});

test("a site with no sitemap is guessed at, and only then", async () => {
  const { ctx, calls } = fake();
  const bare: ReadPage = {
    url: "https://nothing.test/", ok: true, title: null, text: "Words.",
    fetchedOn: "2026-09-16", note: "",
  };
  const got = await worthReading("https://nothing.test", bare, ctx);
  assert.ok(calls.read.some((u) => u.endsWith("/sitemap.xml")), "it never asked for a sitemap");
  assert.ok(got.some((u) => /price/.test(u)), "it did not fall back to guessing");
});

test("the channels come from their own words, because their links do not survive", () => {
  /* The real reader strips the footer, so the instagram.com address on this
     barber's home page is gone by the time we see it. The sentence is not. */
  const said = (text: string) =>
    channelsFor(BUSINESS, { read: [{ url: "u", ok: true, title: null, text, fetchedOn: "2026-09-16", note: "" }] } as RunState);

  assert.deepEqual(said("You can also contact us via social media through Facebook and Instagram."),
    ["instagram", "facebook"]);
  assert.deepEqual(said("We cut hair. Nothing here names a platform."), []);

  /* foundVia looks like the field for this and is not: its values are social,
     booking, trades, marketplace, unknown. Reading it as a channel list gives
     everybody no channels, which looks like working. */
  assert.deepEqual(
    channelsFor({ ...BUSINESS, foundVia: ["social", "booking"] },
      { read: [{ url: "u", ok: true, title: null, text: "We are on TikTok.", fetchedOn: "2026-09-16", note: "" }] } as RunState),
    ["tiktok"],
  );
});

test("a YouTube post gets a title, because an upload without one cannot be published", () => {
  const cap = CHANNEL.youtube.titleChars!;
  const long = "We have been cutting hair on this street for a very long time indeed and we know every head in it.";
  const t = firstLine(long, cap);
  assert.ok(t.length <= cap);
  assert.ok(long.startsWith(t));
  assert.equal(long[t.length], " ", "it cut through a word");
});
