/**
 * A week of research, kept on disk.
 *
 * One file per business, named after their website, holding the whole run and
 * the moment it was taken. `freshness.ts` already decides whether a run is due
 * — seven days, clock-skew guarded — so this only stores and retrieves; it does
 * not get a second opinion about time.
 *
 * Files rather than a database, deliberately: nothing to install, and when a
 * run looks wrong you can open the file and read it. That stops being the right
 * answer the moment two servers need the same data, and that is written here so
 * the limit is known rather than discovered.
 */
import { mkdir, readFile, writeFile, rename, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { decideRun, nextRunAt } from './freshness.ts';

export interface StoredRun<T = unknown> {
  /** The URL the run was asked for, before normalising. */
  input: string;
  /** ISO timestamp of when the run finished. */
  ranAt: string;
  run: T;
}

/**
 * One business, one name, however the URL was typed.
 *
 * "shrewsburybarber.co.uk", "https://www.shrewsburybarber.co.uk/" and
 * "HTTPS://ShrewsburyBarber.co.uk" are the same business, and storing them
 * under three names would run the research three times and compare a business
 * against itself a week later.
 */
export function keyFor(input: string): string {
  let host = input.trim().toLowerCase();
  try { host = new URL(host.startsWith('http') ? host : `https://${host}`).hostname; } catch { /* keep as typed */ }
  return host.replace(/^www\./, '').replace(/[^a-z0-9.-]/g, '_');
}

export class Store {
  /** A plain field, assigned in the body. `constructor(private dir: string)` is
   *  a TypeScript parameter property, and Node runs this TypeScript by stripping
   *  types rather than compiling it — a parameter property is not a type, it
   *  emits a real assignment, so stripping leaves a class with no field at all.
   *  It fails at load with ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX. No build step is
   *  the trade we made for no install; this is one of its edges. */
  readonly dir: string;
  constructor(dir: string) { this.dir = dir; }

  path(input: string) { return join(this.dir, `${keyFor(input)}.json`); }

  async save<T>(input: string, run: T, ranAt = new Date().toISOString()): Promise<StoredRun<T>> {
    await mkdir(this.dir, { recursive: true });
    const record: StoredRun<T> = { input, ranAt, run };
    // Written to a temporary name and moved into place. A crash halfway through
    // a direct write leaves a half-file that parses as nothing, and the next
    // load would treat a corrupt week as no week and re-run everything.
    const tmp = `${this.path(input)}.tmp`;
    await writeFile(tmp, JSON.stringify(record, null, 2), 'utf8');
    await rename(tmp, this.path(input));
    return record;
  }

  async load<T>(input: string): Promise<StoredRun<T> | null> {
    try {
      const raw = await readFile(this.path(input), 'utf8');
      const parsed = JSON.parse(raw) as StoredRun<T>;
      return typeof parsed?.ranAt === 'string' ? parsed : null;
    } catch {
      return null;      // missing or unreadable are the same answer: no week held
    }
  }

  /** Every business we hold, newest run first. */
  async list(): Promise<string[]> {
    try {
      return (await readdir(this.dir)).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
    } catch { return []; }
  }
}

export type Freshness =
  | { state: 'none'; why: string }
  | { state: 'fresh'; ranAt: string; nextRunAt: string; ageDays: number }
  | { state: 'stale'; ranAt: string; why: string };

/** Is what we hold still good, and when does it expire? */
export function freshnessOf(stored: StoredRun | null, now = new Date()): Freshness {
  if (!stored) return { state: 'none', why: 'no run has been stored for this business' };
  const decision = decideRun(stored.ranAt, now);
  const ageDays = Math.floor((now.getTime() - new Date(stored.ranAt).getTime()) / 86_400_000);
  return decision.allowed
    ? { state: 'stale', ranAt: stored.ranAt, why: decision.reason }
    : { state: 'fresh', ranAt: stored.ranAt, nextRunAt: nextRunAt(stored.ranAt), ageDays };
}
