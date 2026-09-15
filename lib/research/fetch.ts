import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { mayFetch, robotsFor } from "./robots";
import { queued } from "./queue";

/**
 * The only way this product reads a page on the web.
 *
 * Every rule in CLAUDE.md 1.5 that can be enforced by code is enforced here, so
 * no tool has to remember them and no tool can skip them. If you find yourself
 * calling fetch() anywhere else in this app, that is the bug.
 *
 *   1. robots.txt is the gate.                          robotsFor + mayFetch
 *   2. Logged out only.                                 no cookies are ever sent
 *   3. Identify ourselves, with a URL explaining who.    USER_AGENT
 *   4. One request at a time per site, with a pause.     the queue below
 *   5. Read and summarise, never store the page.         MAX_TEXT + the caller
 *   8. A way to block a domain permanently.              blocked_domains
 */

export const USER_AGENT =
  "HighIntentLabsBot/1.0 (+https://highintentlabs.com/bot; small business research)";

/** Rule 4. Slow enough that we are never the reason a small site struggles. */
const DEFAULT_GAP_MS = 1_500;

/** Enough of a page to understand it, short enough that we are not keeping a
 *  copy of somebody's website. Rule 5. */
const MAX_TEXT = 40_000;

const MAX_BYTES = 3_000_000;

export type Fetched = {
  url: string;
  domain: string;
  ok: boolean;
  status: number | null;
  /** Visible text, stripped and trimmed. Never markup, never the whole page. */
  text: string;
  title: string | null;
  fetchedAt: string;
  robotsOk: boolean;
  /** Plain English, safe to show a customer. "Blocked by their robots.txt". */
  note: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let blocked: Set<string> | null = null;
let blockedAt = 0;

/** Rule 8. Cached for a minute, so a takedown takes effect within a minute
 *  rather than at the next deploy. */
async function blockedDomains(): Promise<Set<string>> {
  if (blocked && Date.now() - blockedAt < 60_000) return blocked;
  try {
    const { data } = await createAdminClient()
      .from("blocked_domains")
      .select("domain");
    blocked = new Set((data ?? []).map((r) => r.domain.toLowerCase()));
    blockedAt = Date.now();
  } catch {
    // If we cannot read the list we do not know what is blocked. Refusing
    // everything would break the product; carrying on with the last known list
    // is the honest middle. An empty list only happens on the very first call.
    blocked ??= new Set();
  }
  return blocked;
}

export async function fetchPage(input: string): Promise<Fetched> {
  const at = new Date().toISOString();

  let url: URL;
  try {
    url = new URL(input.startsWith("http") ? input : `https://${input}`);
  } catch {
    return fail(input, input, at, "That is not a web address we can read.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return fail(url.href, url.hostname, at, "Only ordinary web pages.");
  }

  const domain = url.hostname.toLowerCase().replace(/^www\./, "");

  if ((await blockedDomains()).has(domain)) {
    return fail(url.href, domain, at, "We have been asked not to read this site.");
  }

  const rules = await robotsFor(url.origin, USER_AGENT);

  // Unreachable and refused both stop us, and they are different facts. Saying
  // a site refused us when the domain does not exist is a claim about somebody
  // else's website that happens to be false.
  if (!rules.reachable) {
    return fail(
      url.href,
      domain,
      at,
      `We could not reach ${domain}. Check the address is right and that the site is up.`,
    );
  }

  if (!mayFetch(rules, url.pathname + url.search)) {
    return {
      ...fail(url.href, domain, at, "Their robots.txt asks us not to read this page."),
      robotsOk: false,
    };
  }

  const gap = Math.max(rules.crawlDelayMs, DEFAULT_GAP_MS);

  // Queued on the domain with www stripped, not the raw hostname. They are the
  // same machine, and queueing them separately meant one spelling of a site
  // could be fetched while the other spelling was mid-request, which is exactly
  // the thing rule 4 exists to prevent.
  return queued(domain, async () => {
    await sleep(gap);
    try {
      const response = await fetch(url.href, {
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en-GB,en;q=0.9",
        },
        redirect: "follow",
        // Rule 2. No cookie is ever sent, so we can only ever see what a
        // stranger sees. Nothing behind a login, by construction.
        credentials: "omit",
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });

      if (!response.ok) {
        return {
          ...fail(url.href, domain, at, noteForStatus(response.status)),
          status: response.status,
        };
      }

      const type = response.headers.get("content-type") ?? "";
      if (!type.includes("html") && !type.includes("text")) {
        return {
          ...fail(url.href, domain, at, "That address is not a page we can read."),
          status: response.status,
        };
      }

      const html = (await response.text()).slice(0, MAX_BYTES);
      return {
        url: url.href,
        domain,
        ok: true,
        status: response.status,
        text: visibleText(html).slice(0, MAX_TEXT),
        title: titleOf(html),
        fetchedAt: at,
        robotsOk: true,
        note: "",
      };
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      return fail(
        url.href,
        domain,
        at,
        timedOut ? "Their site did not answer in time." : "We could not reach their site.",
      );
    }
  });
}

function noteForStatus(status: number): string {
  if (status === 404) return "That page is not there.";
  if (status === 403 || status === 401)
    return "Their site refused us. We do not work around a block.";
  if (status === 429) return "Their site asked us to slow down.";
  if (status >= 500) return "Their site is having trouble.";
  return `Their site answered ${status}.`;
}

function fail(url: string, domain: string, at: string, note: string): Fetched {
  return {
    url,
    domain,
    ok: false,
    status: null,
    text: "",
    title: null,
    fetchedAt: at,
    robotsOk: true,
    note,
  };
}

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
