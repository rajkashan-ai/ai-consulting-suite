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
export function visibleText(html: string): string {
  return decode(
    html
      .replace(/<(script|style|noscript|svg|template)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(nav|footer|header)[^>]*>[\s\S]*?<\/\1>/gi, " ")
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
