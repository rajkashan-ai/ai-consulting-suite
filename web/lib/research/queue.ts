/**
 * One request at a time per site, and no waiting between sites.
 *
 * CLAUDE.md 1.5 rule 4 is owed to each site, not to the web. Two requests to a
 * Shrewsbury barber's shared hosting at once can slow it down or take it off
 * the air, and that is a real harm to the business we are researching. Two
 * requests to two different sites harm nobody and there is no reason to make
 * one wait for the other.
 *
 * In its own file, with no `server-only` guard, because it holds no secret and
 * this is the guarantee that most needs a test. It was living inside fetch.ts,
 * where nothing could reach it, while the caller quietly serialised everything
 * anyway and made the whole thing moot.
 */

const chains = new Map<string, Promise<unknown>>();

export function queued<T>(host: string, job: () => Promise<T>): Promise<T> {
  const previous = chains.get(host) ?? Promise.resolve();
  const next = previous.then(job, job);
  // Keep the chain, drop the value, and never let one failure poison the queue
  // for every later request to that host.
  chains.set(
    host,
    next.catch(() => undefined),
  );
  return next;
}

/** Tests only. Without it one test's chains leak into the next. */
export function forgetQueues(): void {
  chains.clear();
}
