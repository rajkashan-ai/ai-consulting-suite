/**
 * What we are allowed to fetch. Root CLAUDE.md section 1.5, and section 5.4 here.
 *
 * Checked by hand on 14 September 2026: Booksy disallows /search/ and Fresha
 * disallows /search*, while both allow a named venue's own page. So a booking
 * platform can tell us everything about a business we can already name, and can
 * never tell us who the competitors are. Discovery has to come from somewhere
 * else, and this function is what stops that rule being forgotten.
 */

export type Refusal =
  | 'robots-disallowed'
  | 'platform-search'     // discovery via a booking platform's search
  | 'needs-login'
  | 'private-address';    // an address only reachable from inside our network

export type FetchVerdict = { allowed: true } | { allowed: false; refusal: Refusal };

const PLATFORM_SEARCH = [
  /^https?:\/\/(www\.)?booksy\.com\/.*\/search\//i,
  /^https?:\/\/(www\.)?booksy\.com\/search\//i,
  /^https?:\/\/(www\.)?fresha\.com\/search/i,
];

const LOGIN_OR_PAYWALL = /\/(login|signin|sign-in|account|checkout|subscribe)\b/i;

/** Link-local, loopback and the RFC1918 ranges. A page asking us to fetch one is an attack. */
const PRIVATE_HOST =
  /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\]|metadata\.google\.internal)/i;

export function mayFetch(url: string, robots: { disallowed: string[] } = { disallowed: [] }): FetchVerdict {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { allowed: false, refusal: 'private-address' };
  }

  if (PRIVATE_HOST.test(parsed.hostname)) return { allowed: false, refusal: 'private-address' };
  if (PLATFORM_SEARCH.some(re => re.test(url))) return { allowed: false, refusal: 'platform-search' };
  if (LOGIN_OR_PAYWALL.test(parsed.pathname)) return { allowed: false, refusal: 'needs-login' };

  for (const rule of robots.disallowed) {
    if (matchesRobotsRule(parsed.pathname, rule)) return { allowed: false, refusal: 'robots-disallowed' };
  }
  return { allowed: true };
}

/** robots.txt wildcards: * is any run of characters, $ anchors the end. */
function matchesRobotsRule(path: string, rule: string): boolean {
  const anchored = rule.endsWith('$');
  const body = anchored ? rule.slice(0, -1) : rule;
  const re = new RegExp('^' + body.split('*').map(escape).join('.*') + (anchored ? '$' : ''));
  return re.test(path);
}

const escape = (s: string) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

/** The real rules, read 14 September 2026. Fixtures and tests use these, not invented ones. */
export const ROBOTS = {
  booksy: { disallowed: ['/search/', '/biz-app/', '/pro/', '/widget/', '/*/account/', '/book/id/'] },
  fresha: { disallowed: ['/search*', '/pba', '/invoice', '*booking/menu*', '*/gift-cards*'] },
  google: { disallowed: ['/search', '/maps/search', '/imgres', '/shopping'] },
  instagram: { disallowed: ['/'] },   // ClaudeBot is named with Disallow: /
  tiktok: { disallowed: ['/'] },
  linkedin: { disallowed: ['/'] },
};

/**
 * THE RULES ARE CHOSEN BY THE HOST, NOT BY THE CALLER.
 *
 * Found on 15 September while testing the fetcher: a Google search URL was
 * passed with Booksy's rules and the robots check passed happily. Google
 * disallows /search; Booksy does not. A policy check that reads another site's
 * policy is worse than no check at all, because the call site looks guarded and
 * the reviewer stops looking.
 *
 * An unknown host gets an empty rule set, which is the honest default: we have
 * not read its robots.txt, so we know of nothing disallowed. That is a gap, and
 * it is named here rather than hidden — a real build fetches and parses
 * robots.txt per host and caches it.
 */
export function rulesFor(url: string): { disallowed: string[] } {
  let host = '';
  try { host = new URL(url).hostname.toLowerCase(); } catch { return { disallowed: [] }; }
  for (const [key, rules] of Object.entries(ROBOTS)) {
    if (host === key + '.com' || host.endsWith('.' + key + '.com') ||
        host === 'www.' + key + '.com' || host.includes('.' + key + '.')) return rules;
  }
  return { disallowed: [] };
}
