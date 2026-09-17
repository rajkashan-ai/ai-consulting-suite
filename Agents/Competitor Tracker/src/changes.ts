/**
 * What moved since last Monday.
 *
 * This is the thing the tool is named for, and the screen has been promising it
 * since 14 September while nothing could produce it. It needs two runs, which
 * needs a store, which is why the two were built together.
 *
 * The rule that shapes all of it: a change is only reportable when the same
 * fact was read on both runs. If a competitor was unreadable last week and
 * readable this week, their review count has not "gone up from nothing" — we
 * simply could not see it before. Reporting that as growth would be inventing a
 * movement out of our own blind spot, which is the same defect as a count with
 * no boundary.
 */

export interface CompetitorSnapshot {
  name: string;
  reviewCount?: number;
  rating?: number;
  headlinePrice?: number;
  /** Set when the business could not be read at all on that run. */
  unread?: boolean;
}

export interface RunSnapshot {
  ranAt: string;
  ownHeadlinePrice?: number;
  competitors: CompetitorSnapshot[];
}

export type Change =
  | { kind: 'reviews'; name: string; from: number; to: number; by: number }
  | { kind: 'price'; name: string; from: number; to: number; by: number }
  | { kind: 'rating'; name: string; from: number; to: number }
  | { kind: 'arrived'; name: string }
  | { kind: 'gone'; name: string }
  | { kind: 'now-readable'; name: string }
  | { kind: 'now-unreadable'; name: string };

const byName = (list: CompetitorSnapshot[]) =>
  new Map(list.map(c => [c.name.trim().toLowerCase(), c]));

/**
 * Compare two runs. Returns only movements that both runs could actually see.
 *
 * `null` for `before` means this is the first run, and the honest output is an
 * empty list with nothing to compare — not a list of everything as though it
 * had all just appeared.
 */
export function changesBetween(before: RunSnapshot | null, after: RunSnapshot): Change[] {
  if (!before) return [];
  const was = byName(before.competitors);
  const now = byName(after.competitors);
  const out: Change[] = [];

  for (const [key, b] of now) {
    const a = was.get(key);
    if (!a) { out.push({ kind: 'arrived', name: b.name }); continue; }

    // Readability changed. Said plainly, and never dressed as growth.
    if (a.unread && !b.unread) { out.push({ kind: 'now-readable', name: b.name }); continue; }
    if (!a.unread && b.unread) { out.push({ kind: 'now-unreadable', name: b.name }); continue; }
    if (a.unread && b.unread) continue;

    if (a.reviewCount !== undefined && b.reviewCount !== undefined && b.reviewCount !== a.reviewCount) {
      out.push({ kind: 'reviews', name: b.name, from: a.reviewCount, to: b.reviewCount,
                 by: b.reviewCount - a.reviewCount });
    }
    if (a.headlinePrice !== undefined && b.headlinePrice !== undefined && b.headlinePrice !== a.headlinePrice) {
      out.push({ kind: 'price', name: b.name, from: a.headlinePrice, to: b.headlinePrice,
                 by: b.headlinePrice - a.headlinePrice });
    }
    // A rating is published to one decimal place, so a change below that is
    // rounding, not movement.
    if (a.rating !== undefined && b.rating !== undefined && Math.abs(b.rating - a.rating) >= 0.1) {
      out.push({ kind: 'rating', name: b.name, from: a.rating, to: b.rating });
    }
  }

  for (const [key, a] of was) if (!now.has(key)) out.push({ kind: 'gone', name: a.name });
  return out;
}

/** One line a shop owner would read, per change. */
export function say(c: Change): string {
  switch (c.kind) {
    case 'reviews':
      return `${c.name} ${c.by > 0 ? 'gained' : 'lost'} ${Math.abs(c.by)} review${Math.abs(c.by) === 1 ? '' : 's'}, now ${c.to.toLocaleString('en-GB')}`;
    case 'price':
      return `${c.name} ${c.by > 0 ? 'put their price up' : 'cut their price'} from £${c.from} to £${c.to}`;
    case 'rating':
      return `${c.name} moved from ${c.from} to ${c.to}`;
    case 'arrived':
      return `${c.name} is new to your list this week`;
    case 'gone':
      return `${c.name} is no longer in your five`;
    case 'now-readable':
      return `We could read ${c.name} this week, having failed last week. Their numbers start from today rather than showing a jump`;
    case 'now-unreadable':
      return `${c.name} would not let us read them this week, so their numbers are last week's`;
  }
}

/** Nothing moved is a real answer, and a different one from "we did not look". */
export function summarise(changes: Change[], comparedTo: string | null): string {
  if (!comparedTo) return 'This is the first run, so there is nothing to compare it against yet.';
  if (!changes.length) return `Nothing moved since ${comparedTo.slice(0, 10)}.`;
  return `${changes.length} change${changes.length === 1 ? '' : 's'} since ${comparedTo.slice(0, 10)}.`;
}
