/**
 * The network layer. The thing that did not exist.
 *
 * Until 15 September `src/` contained zero fetch calls: every module was a pure
 * function over data somebody else had already collected, and nobody collected
 * it. This is the smallest honest version of the missing half — it fetches, it
 * obeys the robots rules that were already written, and it reports failures in
 * the shape the rest of the code already understands.
 *
 * It stays separate from profile.ts and the parsers so those remain pure and
 * testable without a network, which is how everything else here is built.
 */
import { mayFetch, rulesFor } from './fetch-policy.ts';
import type { FetchFailure } from './types.ts';

export interface Fetched { url: string; html: string; readOn: string }
export type FetchResult = Fetched | { url: string; failed: FetchFailure; detail?: string };

export const isFetched = (r: FetchResult): r is Fetched => 'html' in r;

/** A real browser string. A bare Node fetch is refused or served a stub by many
 *  sites, which reads as "no data" when it is actually "no manners". */
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/125.0 Safari/537.36';

/** HTTP status to the failure vocabulary the rest of the code already uses, so
 *  a 403 from Checkatrade and a robots refusal arrive in the same shape. */
function statusToFailure(status: number): FetchFailure {
  if (status === 403 || status === 401) return 'forbidden';
  if (status === 404) return 'not-found';
  return 'empty-body';
}

export async function fetchPage(
  url: string,
  robots: { disallowed: string[] } = { disallowed: [] },
  impl: typeof fetch = fetch,
  timeoutMs = 15000,
): Promise<FetchResult> {
  // Asked before the request is made, never after. A page we may not read is
  // not fetched-and-discarded, it is never requested.
  //
  // The argument is normalised rather than trusted. A caller passing `{}` — the
  // obvious mistake, and one I made in the first test for this — reached
  // mayFetch and threw "robots.disallowed is not iterable" from inside the
  // policy check, which is the worst place for a crash: the guard that decides
  // whether we may read a page failed open into an exception rather than a
  // refusal.
  // The host decides, not the caller. Passing rules in is still allowed — the
  // tests use it to force a refusal — but the host's own rules are merged in so
  // a caller cannot weaken them by supplying a laxer set, deliberately or by
  // handing over the wrong site's policy.
  const supplied = Array.isArray(robots?.disallowed) ? robots.disallowed : [];
  const rules = { disallowed: [...new Set([...rulesFor(url).disallowed, ...supplied])] };
  const verdict = mayFetch(url, rules);
  // `refusal`, not `because`. The field was read wrong on the first write and
  // the detail silently came back undefined, so a robots refusal reported no
  // reason at all.
  if (!verdict.allowed) return { url, failed: 'robots-disallowed', detail: (verdict as { refusal?: string }).refusal };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await impl(url, { redirect: 'follow', signal: ac.signal, headers: { 'user-agent': UA } });
    if (!res.ok) return { url, failed: statusToFailure(res.status), detail: `HTTP ${res.status}` };
    const html = await res.text();
    if (!html.trim()) return { url, failed: 'empty-body' };
    return { url, html, readOn: new Date().toISOString().slice(0, 10) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { url, failed: /abort/i.test(msg) ? 'timeout' : 'not-found', detail: msg };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Several pages at once, because a run reads six businesses and doing that in
 * series is six round trips of waiting. Failures come back in the same array as
 * successes: a business we could not read is a finding, never a gap in the list.
 */
export async function fetchAll(
  urls: string[],
  robots: { disallowed: string[] } = { disallowed: [] },
  impl: typeof fetch = fetch,
): Promise<FetchResult[]> {
  return Promise.all(urls.map(u => fetchPage(u, robots, impl)));
}
