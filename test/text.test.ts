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
