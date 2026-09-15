import { test } from "node:test";
import assert from "node:assert/strict";
import { titleOf, visibleText } from "../lib/research/text.ts";

/**
 * Turning a page into words. Everything downstream reads this and nothing
 * tested it, so a page that came out as navigation soup would have produced a
 * confident battlecard built on a menu.
 */

test("a price list survives as separate lines, not one sentence", () => {
  const html = `<ul><li>Clipper cut &pound;8</li><li>Classic cut &pound;15</li></ul>`;
  const out = visibleText(html);
  assert.match(out, /Clipper cut £8/);
  assert.match(out, /Classic cut £15/);
  assert.ok(out.includes("\n"), "a list must not collapse into one line");
});

test("navigation is removed, because it is the same words on every page", () => {
  // Twenty-four pages of the same menu would crowd the page's own content out
  // of the size limit, and the size limit is what stops us keeping a copy of
  // somebody's website.
  const html = `<nav>Home About Contact</nav><p>We cut hair</p><footer>Cookies</footer>`;
  const out = visibleText(html);
  assert.match(out, /We cut hair/);
  assert.ok(!out.includes("Cookies"), "footer removed");
  assert.ok(!out.includes("About"), "nav removed");
});

test("script and style never reach the words", () => {
  const html = `<style>.a{color:red}</style><script>var x=1</script><p>Open Monday</p>`;
  const out = visibleText(html);
  assert.equal(out, "Open Monday");
});

test("the entities a British price list is full of", () => {
  const out = visibleText("<p>Cut &amp; beard &pound;20 &ndash; Tue&rsquo;s special</p>");
  assert.match(out, /Cut & beard £20/);
  assert.match(out, /Tue's special/);
});

test("a title is found and trimmed, and a missing one is null", () => {
  assert.equal(titleOf("<title>  HINCES Barber  </title>"), "HINCES Barber");
  assert.equal(titleOf("<html><body>no title</body></html>"), null);
  assert.equal(titleOf("<title></title>"), null);
});

test("blank lines do not run away", () => {
  const out = visibleText("<div></div><div></div><p>One</p><div></div><p>Two</p>");
  assert.ok(!/\n\n\n/.test(out), "never more than one blank line");
});

test("a page of nothing comes back as nothing, not as whitespace", () => {
  assert.equal(visibleText("<html><head></head><body></body></html>"), "");
});

test("a link keeps its address, beside the words it belongs to", () => {
  // The bug that meant no competitor's own page was ever read: a listing naming
  // sixty-six barbers gave sixty-six names and nowhere to go.
  const out = visibleText(
    `<p><a href="/venue/hinces">HINCES Barber</a> 5.0 from 2,461 reviews</p>`,
    "https://booksy.com/en-gb/s/barber/1227928_shrewsbury",
  );
  assert.match(out, /HINCES Barber \(https:\/\/booksy\.com\/venue\/hinces\)/);
  assert.match(out, /2,461 reviews/);
});

test("an absolute link is left as it is", () => {
  const out = visibleText(`<a href="https://hinces.co.uk/prices">Prices</a>`, "https://x.com");
  assert.match(out, /Prices \(https:\/\/hinces\.co\.uk\/prices\)/);
});

test("things that are not pages are dropped", () => {
  // A mailto is somebody's email address, which is the one thing we go out of
  // our way not to keep.
  for (const href of ["#top", "javascript:void(0)", "mailto:a@b.co", "tel:07700900123"]) {
    const out = visibleText(`<a href="${href}">Click</a>`, "https://x.com");
    assert.equal(out, "Click", href);
  }
});

test("a link with no words in it does not leave a bare address", () => {
  const out = visibleText(`<p>Before<a href="/x"><img></a>After</p>`, "https://x.com");
  assert.ok(!out.includes("(https"), "an icon link is not content");
});

test("a broken href does not take the whole page down", () => {
  assert.doesNotThrow(() => visibleText(`<a href="ht tp://:::">Bad</a>`, "https://x.com"));
});

test("without a base, a relative link is dropped rather than guessed at", () => {
  const out = visibleText(`<a href="/venue/x">Name</a>`);
  assert.equal(out, "Name");
});
