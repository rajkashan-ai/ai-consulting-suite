/**
 * Markup to readable words.
 *
 * In its own file because it is pure, and because everything downstream reads
 * it. A page that came out as navigation soup would have produced a confident
 * battlecard built on a menu, and nothing could test it while it lived beside a
 * database client that plain Node cannot import.
 */

export function titleOf(html: string): string | null {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? decode(m[1]).trim().slice(0, 200) || null : null;
}

/**
 * Markup to readable text. Script, style, nav and footer come out first: a nav
 * repeated on 24 pages is 24 copies of the same words, and it crowds out the
 * page's own content inside the size limit.
 */
export function visibleText(html: string, base?: string): string {
  return decode(
    html
      .replace(/<(script|style|noscript|svg|template)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(nav|footer|header)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      /**
       * A link keeps its address, beside the words it belongs to.
       *
       * They were being thrown away with the rest of the markup, so a listing
       * naming sixty-six barbers gave us sixty-six names and nowhere to go.
       * Nothing about any competitor came from their own page: a whole
       * battlecard rested on two listings.
       *
       * Written inline as "text <url>" rather than collected into a separate
       * list, because matching a url back to a name afterwards is guesswork,
       * and putting one shop's prices against another shop is worse than having
       * no prices at all.
       */
      .replace(
        /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
        (_all, href: string, inner: string) => {
          const words = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          if (!words) return " ";
          const full = absolute(href, base);
          // Round brackets, not angle ones. Written as <url> first, which the
          // very next line strips because it removes everything that looks like
          // a tag, and <https://...> looks exactly like one.
          return full ? ` ${words} (${full}) ` : ` ${words} `;
        },
      )
      // Block level tags become line breaks, so a price list stays a list
      // instead of collapsing into one unreadable sentence.
      .replace(/<\/?(p|div|br|li|tr|h[1-6]|section|article)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim();
}

/**
 * A relative link made absolute, or null if it is not worth following.
 *
 * Anchors, javascript:, mailto: and tel: are dropped: none of them is a page,
 * and a mailto is somebody's email address, which is the one thing we go out of
 * our way not to keep.
 */
function absolute(href: string, base?: string): string | null {
  const h = href.trim();
  if (!h || h.startsWith("#")) return null;
  if (/^(javascript|mailto|tel|data):/i.test(h)) return null;
  try {
    return base ? new URL(h, base).href : new URL(h).href;
  } catch {
    return null;
  }
}

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;/g, "'")
    .replace(/&pound;/g, "£")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}
