/**
 * The shape of a battlecard, as CLAUDE.md sections 3 and 3a define it.
 *
 * Everything here is deliberately boring data. The prose a tool writes is graded
 * by evals; this file is the part we can check with a plain equality test, and
 * it is where every rule that must never break is made checkable.
 */

/** The four things we research. CLAUDE.md section 3a. */
export type Area = 'pricing' | 'channels' | 'reviews' | 'blindspots';

export const AREAS: readonly Area[] = ['pricing', 'channels', 'reviews', 'blindspots'];

/** Where one fact came from, and when we read it. Never optional. */
export interface Source {
  url: string;
  /** ISO date, the day we fetched it. */
  fetchedOn: string;
}

/**
 * One fact about one business.
 *
 * `value` is separate from `text` on purpose. A claim can be written and still
 * rest on a hole: "The Fade Inn has 9,065 followers" is a number, but the same
 * field for our own customer was never counted. `value: null` means we looked
 * and could not see it, and that is what stops an action being built on it.
 */
export interface Claim {
  text: string;
  /** null when we could not read it. An unread field is a finding, not a failure. */
  value: string | number | null;
  /** null only when `value` is null. A fact we state must say where it came from. */
  source: Source | null;
}

export interface Competitor {
  name: string;
  /** true when the customer named them. Those survive every weekly run, for ever. */
  addedByCustomer: boolean;
  claims: Partial<Record<Area, Claim[]>>;
}

/** One of the three things to do about it. CLAUDE.md section 3a. */
export interface Action {
  /**
   * 1, 2, 3. Assigned by us, not by the model.
   *
   * It used to be whatever the model returned, ordered by an unprompted
   * judgement of "strongest", which nothing defined and nothing checked. It is
   * now the order of `gap.theyDo`, largest first: how many of the businesses
   * compared already do this and the owner does not. That is a number off the
   * grid, so the order is evidence rather than opinion, and the same card
   * always ranks the same way.
   */
  rank: number;
  /**
   * How many of the businesses compared already do this thing.
   *
   * The size of the hole this action fills, taken from the comparison. Four of
   * five doing something is a different proposition from one of five, and
   * until now the page said neither.
   */
  gap?: { theyDo: number; outOf: number };
  /** One line on how doing it is supposed to bring in more enquiries. */
  effect?: string;
  /** Which weakness this attacks. Shown above the heading. */
  area: Area;
  headline: string;
  why: string;
  /** What it is based on. At least one claim, and every one of them sourced. */
  evidence: Claim[];
  /**
   * A price move we cannot justify without knowing their costs. Carried as a
   * deferral inside the evidence, never as the action itself.
   */
  deferred?: string;
}

export interface Battlecard {
  business: string;
  /** ISO timestamp of the run that produced this. */
  ranAt: string;
  competitors: Competitor[];
  actions: Action[];
  /** Everything we read, for the export's Sources block. */
  sources: Source[];
  /** Named businesses we could not read, and why. Kept, never dropped. */
  unreadable: { name: string; reason: FetchFailure }[];
}

export type FetchFailure =
  | 'forbidden'      // 403, as Checkatrade returns
  | 'not-found'      // 404, or the domain does not resolve
  | 'timeout'
  | 'robots-disallowed'
  | 'empty-body'     // 200 with nothing in it, as the Meta Ad Library gave us
  | 'needs-login'
  | 'cost-cap';
