/**
 * Which pages a site actually has, asked rather than guessed.
 *
 * WHY
 * Finding a business's prices meant guessing paths: /prices, /pricing,
 * /services, /about, /contact. The Barber Shop Shrewsbury publishes a full
 * price list at /price-menu, so every guess missed, the sign-up recorded no
 * prices at all, and the price-overlap part of competitor ranking had nothing
 * to work with.
 *
 * A sitemap is a site telling us its own pages. Guessing is what you do when
 * there isn't one.
 */

/** Words in a path that mean this page is worth reading for a small business. */
const WORTH_READING =
  /price|pricing|menu|service|treatment|product|rate|book|about|contact|find|hour|open/i;

/** One level of nesting: a sitemap index pointing at other sitemaps. */
const MAX_FOLLOW = 3;

export type Reader = (url: string) => Promise<{ ok: boolean; text: string }>;

/**
 * Pages from the sitemap, the most useful first, excluding the home page.
 *
 * Returns an empty list when there is no sitemap, which is the signal to fall
 * back to guessing. Never throws: a missing or broken sitemap is a fact about
 * the site, not a reason to fail a sign-up.
 */
export async function pagesFrom(
  origin: string,
  read: Reader,
  want = 3,
): Promise<string[]> {
  const found = new Set<string>();

  try {
    const root = await read(`${origin}/sitemap.xml`);
    if (!root.ok) return [];

    const locations = locs(root.text);
    const nested = locations.filter((u) => /\.xml(\?|$)/i.test(u)).slice(0, MAX_FOLLOW);
    const direct = locations.filter((u) => !/\.xml(\?|$)/i.test(u));

    for (const u of direct) found.add(u);

    for (const child of nested) {
      const page = await read(child);
      if (page.ok) for (const u of locs(page.text)) {
        if (!/\.xml(\?|$)/i.test(u)) found.add(u);
      }
    }
  } catch {
    /**
     * No sitemap, or we could not read one. Deliberately the same answer,
     * because the caller treats both the same way: it falls back to reading the
     * homepage and following links, which works either way.
     *
     * Said out loud because the two are not the same thing, and if the fallback
     * ever stops being adequate this is the line to change first.
     */
    return [];
  }

  const home = origin.replace(/\/+$/, "");
  return [...found]
    .filter((u) => u.replace(/\/+$/, "") !== home)
    .filter((u) => sameSite(u, origin))
    // A price list is worth more than a blog post, so the useful ones first.
    .sort((a, b) => Number(WORTH_READING.test(b)) - Number(WORTH_READING.test(a)))
    .slice(0, want);
}

/**
 * The addresses in a sitemap, whether or not the tags survived.
 *
 * The reader hands back a page's visible words, so `<loc>https://x</loc>`
 * arrives as `https://x` with the tags already gone. Looking only for the tag
 * found nothing every time, the sitemap looked empty, and it fell back to
 * guessing paths as though the site had no sitemap at all.
 *
 * Both forms are accepted, because it should not matter which end of the pipe
 * this is called from.
 */
function locs(xml: string): string[] {
  const tagged = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
  if (tagged.length) return tagged;
  return [...xml.matchAll(/https?:\/\/[^\s<>"')]+/gi)].map((m) => m[0]);
}

function sameSite(url: string, origin: string): boolean {
  try {
    return new URL(url).hostname.replace(/^www\./, "") ===
      new URL(origin).hostname.replace(/^www\./, "");
  } catch {
    // Unparseable, so not provably the same site, so we do not follow it.
    // Expected, and the cautious answer is the correct one here.
    return false;
  }
}
