import { test } from "node:test";
import assert from "node:assert/strict";
import { pagesFrom } from "../lib/research/sitemap.ts";

const reader = (pages: Record<string, string>) => async (url: string) =>
  pages[url] !== undefined ? { ok: true, text: pages[url] } : { ok: false, text: "" };

test("it finds the page the guesses always missed", async () => {
  // The real one. The Barber Shop Shrewsbury publishes a full price list at
  // /price-menu, and the code guessed /prices, /pricing and /services.
  const out = await pagesFrom(
    "https://www.shrewsburybarber.co.uk",
    reader({
      "https://www.shrewsburybarber.co.uk/sitemap.xml":
        "<sitemapindex><sitemap><loc>https://www.shrewsburybarber.co.uk/pages-sitemap.xml</loc></sitemap></sitemapindex>",
      "https://www.shrewsburybarber.co.uk/pages-sitemap.xml":
        "<urlset><url><loc>https://www.shrewsburybarber.co.uk/price-menu</loc></url>" +
        "<url><loc>https://www.shrewsburybarber.co.uk/products</loc></url>" +
        "<url><loc>https://www.shrewsburybarber.co.uk</loc></url></urlset>",
    }),
  );
  assert.ok(out.includes("https://www.shrewsburybarber.co.uk/price-menu"), out.join(", "));
});

test("the home page is not offered back to us", async () => {
  const out = await pagesFrom(
    "https://x.co.uk",
    reader({
      "https://x.co.uk/sitemap.xml":
        "<urlset><url><loc>https://x.co.uk</loc></url><url><loc>https://x.co.uk/prices</loc></url></urlset>",
    }),
  );
  assert.deepEqual(out, ["https://x.co.uk/prices"]);
});

test("a price list comes before a blog post", async () => {
  const out = await pagesFrom(
    "https://x.co.uk",
    reader({
      "https://x.co.uk/sitemap.xml":
        "<urlset>" +
        "<url><loc>https://x.co.uk/blog/why-we-love-hair</loc></url>" +
        "<url><loc>https://x.co.uk/price-menu</loc></url>" +
        "</urlset>",
    }),
    1,
  );
  assert.deepEqual(out, ["https://x.co.uk/price-menu"]);
});

test("no sitemap is an empty answer, not a failure", async () => {
  assert.deepEqual(await pagesFrom("https://x.co.uk", reader({})), []);
});

test("a broken sitemap does not take a sign-up down", async () => {
  const out = await pagesFrom(
    "https://x.co.uk",
    reader({ "https://x.co.uk/sitemap.xml": "this is not xml at all <<<" }),
  );
  assert.deepEqual(out, []);
});

test("another site's pages are not followed", async () => {
  const out = await pagesFrom(
    "https://x.co.uk",
    reader({
      "https://x.co.uk/sitemap.xml":
        "<urlset><url><loc>https://somewhere-else.com/prices</loc></url></urlset>",
    }),
  );
  assert.deepEqual(out, []);
});

test("it works on stripped text, not only on raw xml", () => {
  // The reader hands back a page's visible words, so the <loc> tags are already
  // gone by the time this sees them. Looking only for the tag found nothing
  // every time, and it silently fell back to guessing paths.
  return pagesFrom(
    "https://www.shrewsburybarber.co.uk",
    async (url) =>
      url.endsWith("/sitemap.xml")
        ? {
            ok: true,
            // Exactly what visibleText produces from a real sitemap index.
            text: "https://www.shrewsburybarber.co.uk/pages-sitemap.xml",
          }
        : {
            ok: true,
            text:
              "https://www.shrewsburybarber.co.uk/price-menu\n" +
              "https://www.shrewsburybarber.co.uk/products\n" +
              "https://www.shrewsburybarber.co.uk",
          },
  ).then((out) => {
    assert.ok(
      out.includes("https://www.shrewsburybarber.co.uk/price-menu"),
      `found: ${out.join(", ")}`,
    );
  });
});
