import { test } from "node:test";
import assert from "node:assert/strict";
import { mayFetch, parse } from "../lib/research/robots.ts";

const UA = "HighIntentLabsBot/1.0 (+https://highintentlabs.com/bot)";
const can = (txt: string, path: string) => mayFetch(parse(txt, UA), path);

// CLAUDE.md 1.5 rule 1 is the one rule here with legal weight. These are the
// cases where a careless parser gets it wrong, in both directions: fetching
// something we were told not to, and refusing something we were allowed.

test("no robots.txt permits everything", () => {
  assert.equal(can("", "/anything"), true);
});

test("a plain disallow is honoured", () => {
  assert.equal(can("User-agent: *\nDisallow: /private", "/private/page"), false);
  assert.equal(can("User-agent: *\nDisallow: /private", "/public"), true);
});

test("an empty Disallow means nothing is disallowed, not block everything", () => {
  assert.equal(can("User-agent: *\nDisallow:", "/anything"), true);
});

test("Allow beats Disallow when it is longer", () => {
  const txt = "User-agent: *\nDisallow: /search\nAllow: /search/public";
  assert.equal(can(txt, "/search/results"), false);
  assert.equal(can(txt, "/search/public/prices"), true);
});

test("a tie goes to Allow", () => {
  // The standard says so, and the difference is whether we read a site's
  // prices page or refuse to.
  const txt = "User-agent: *\nDisallow: /p\nAllow: /p";
  assert.equal(can(txt, "/prices"), true);
});

test("our own group wins, and then the star group does not apply", () => {
  const txt = [
    "User-agent: *",
    "Disallow: /",
    "",
    "User-agent: HighIntentLabsBot",
    "Disallow: /admin",
  ].join("\n");
  assert.equal(can(txt, "/prices"), true, "the star block must not still apply");
  assert.equal(can(txt, "/admin"), false);
});

test("a group aimed at someone else is ignored", () => {
  const txt = "User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow: /admin";
  assert.equal(can(txt, "/prices"), true);
  assert.equal(can(txt, "/admin"), false);
});

test("consecutive user-agent lines share one group", () => {
  const txt = "User-agent: AhrefsBot\nUser-agent: HighIntentLabsBot\nDisallow: /x";
  assert.equal(can(txt, "/x"), false);
});

test("wildcards and end anchors", () => {
  assert.equal(can("User-agent: *\nDisallow: /*.pdf$", "/a/b/report.pdf"), false);
  assert.equal(can("User-agent: *\nDisallow: /*.pdf$", "/a/report.pdf?x=1"), true);
  assert.equal(can("User-agent: *\nDisallow: /*/private", "/shop/private/x"), false);
});

test("comments and stray lines do not change the answer", () => {
  const txt = "# hello\nUser-agent: *   # everyone\nDisallow: /private # not this\nSitemap: /s.xml";
  assert.equal(can(txt, "/private"), false);
  assert.equal(can(txt, "/open"), true);
});

test("crawl-delay is read in seconds and used in milliseconds", () => {
  assert.equal(parse("User-agent: *\nCrawl-delay: 10", UA).crawlDelayMs, 10_000);
  assert.equal(parse("User-agent: *\nCrawl-delay: 0.5", UA).crawlDelayMs, 500);
});

test("case in the field name does not matter", () => {
  assert.equal(can("USER-AGENT: *\nDISALLOW: /x", "/x"), false);
});

test("a hostile pattern cannot crash the parser", () => {
  // A site controls this file. A pattern that throws when compiled must fail
  // closed and quietly, not take a research run down with it.
  assert.doesNotThrow(() => can("User-agent: *\nDisallow: /[", "/anything"));
});

test("a site we could never reach is not reported as a site that refused us", () => {
  // 15 September: /try said "Their robots.txt asks us not to read this page"
  // for a domain that does not resolve. Both stop the fetch, but one is a claim
  // about somebody else's website and it was false.
  assert.equal(parse("", UA).reachable, true);
  assert.equal(parse("User-agent: *\nDisallow: /", UA).reachable, true);
});
