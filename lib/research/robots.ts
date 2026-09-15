/**
 * robots.txt, parsed properly.
 *
 * No `server-only` guard here, unlike its neighbours. There is nothing secret
 * in this file, and the guard made the matching rules impossible to test
 * outside Next. The rules below are the ones with legal weight, so being able
 * to test them matters more than a guard that was protecting nothing.
 *
 * CLAUDE.md 1.5 rule 1: robots.txt is the gate. Disallowed means we do not
 * fetch it. Not "we fetch it and feel bad", and not "we fetch it because the
 * rule looked like it was aimed at someone else".
 *
 * Written out rather than pulled from a package because the matching rules have
 * two details that most small parsers get wrong, and both of them decide
 * whether we are allowed to read a page:
 *
 *   - Groups are selected by the most specific matching user-agent, and once a
 *     named group matches, the `*` group does not apply at all.
 *   - Within the chosen group the longest matching path wins, and Allow beats
 *     Disallow when both are the same length. A site that disallows /search but
 *     allows /search/public means both, and a naive parser blocks the second.
 */

const CACHE = new Map<string, { rules: Rules; at: number }>();
const CACHE_FOR = 60 * 60 * 1000; // an hour. robots.txt does not move often

export type Rules = {
  /** Null means the file was missing, which permits everything. */
  groups: { allow: string[]; deny: string[] } | null;
  crawlDelayMs: number;
  /**
   * False when we could not reach the site at all.
   *
   * Both cases stop us fetching, but they are not the same thing and must not
   * be reported as the same thing. "Their robots.txt asks us not to" told Raj
   * a site had refused us when the domain did not exist. He would have gone
   * looking at the wrong problem, and worse, he would have believed a fact
   * about somebody else's website that was not true.
   */
  reachable: boolean;
};

export type RobotsVerdict = {
  allowed: boolean;
  crawlDelayMs: number;
  /** Why, in words we can show a customer. */
  reason: string;
};

export async function robotsFor(
  origin: string,
  userAgent: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Rules> {
  const hit = CACHE.get(origin);
  if (hit && Date.now() - hit.at < CACHE_FOR) return hit.rules;

  let rules: Rules = { groups: null, crawlDelayMs: 0, reachable: true };
  try {
    const response = await fetchImpl(`${origin}/robots.txt`, {
      headers: { "user-agent": userAgent },
      signal: AbortSignal.timeout(10_000),
    });

    // 4xx means there is no robots.txt, which permits everything.
    // 5xx means the site is broken, and the standard says treat that as a full
    // disallow rather than assume permission from a server that is failing.
    if (response.status >= 500) {
      rules = { groups: { allow: [], deny: ["/"] }, crawlDelayMs: 0, reachable: true };
    } else if (response.ok) {
      rules = parse(await response.text(), userAgent);
    }
  } catch {
    // We never reached the site. No answer is not a yes, so nothing is fetched,
    // but this is "we could not get there" and not "they said no".
    rules = { groups: { allow: [], deny: ["/"] }, crawlDelayMs: 0, reachable: false };
  }

  CACHE.set(origin, { rules, at: Date.now() });
  return rules;
}

export function parse(text: string, userAgent: string): Rules {
  const ua = userAgent.toLowerCase();
  // token before the slash, eg "HighIntentLabsBot/1.0 (+url)" -> highintentlabsbot
  const ourToken = ua.split("/")[0].trim();

  type Group = { agents: string[]; allow: string[]; deny: string[]; delay: number };
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastLineWasAgent = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;

    const at = line.indexOf(":");
    if (at === -1) continue;
    const field = line.slice(0, at).trim().toLowerCase();
    const value = line.slice(at + 1).trim();

    if (field === "user-agent") {
      // Consecutive user-agent lines share one group of rules.
      if (!current || !lastLineWasAgent) {
        current = { agents: [], allow: [], deny: [], delay: 0 };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastLineWasAgent = true;
      continue;
    }

    lastLineWasAgent = false;
    if (!current) continue;

    if (field === "disallow") {
      // An empty Disallow means "nothing is disallowed", not "block /".
      if (value) current.deny.push(value);
    } else if (field === "allow") {
      if (value) current.allow.push(value);
    } else if (field === "crawl-delay") {
      const seconds = Number.parseFloat(value);
      if (Number.isFinite(seconds) && seconds > 0) current.delay = seconds;
    }
  }

  // Most specific wins: our own name first, then a prefix of it, then *.
  const named = groups.find((g) =>
    g.agents.some((a) => a !== "*" && (ourToken === a || ourToken.startsWith(a))),
  );
  const star = groups.find((g) => g.agents.includes("*"));
  const chosen = named ?? star;

  if (!chosen) return { groups: null, crawlDelayMs: 0, reachable: true };
  return {
    groups: { allow: chosen.allow, deny: chosen.deny },
    crawlDelayMs: Math.round(chosen.delay * 1000),
    reachable: true,
  };
}

export function mayFetch(rules: Rules, pathAndQuery: string): boolean {
  if (!rules.groups) return true;

  const best = (patterns: string[]) =>
    patterns.reduce(
      (longest, p) => (matches(p, pathAndQuery) && p.length > longest ? p.length : longest),
      -1,
    );

  const allow = best(rules.groups.allow);
  const deny = best(rules.groups.deny);

  if (deny === -1) return true;
  // Equal length is a tie, and a tie goes to Allow. That is the standard, and
  // it is the difference between reading a site's public pages and refusing to.
  return allow >= deny;
}

/** robots.txt patterns support * for any run of characters and $ for end. */
function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;

  const source =
    "^" +
    body
      .split("*")
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*") +
    (anchored ? "$" : "");

  try {
    return new RegExp(source).test(path);
  } catch {
    return false;
  }
}
