import { nameWords, normaliseName } from "../../../Agents/Competitor Tracker/src/normalise.ts";
import { matchTrade } from "../categories.ts";

/**
 * Throwing out what should never have been on the list.
 *
 * Three things went wrong on the first real run, and all three cost a slot out
 * of five, which is a quarter of the whole comparison each time.
 */

/**
 * The customer is not their own competitor.
 *
 * They ranked top of their own list at score 4, because proximity matched their
 * own address perfectly, which it always will. refreshSet drops them later, so
 * nothing wrong reached the screen: the damage was that the slot was spent and
 * only four real competitors were ever considered.
 */
export function notYou<T extends { name: string }>(rows: T[], you: string | null): T[] {
  if (!you) return rows;

  const mine = nameWords(you);

  // A name we cannot read is not a licence to empty the list. This used to be a
  // plain `includes`, and every string contains the empty string, so a customer
  // whose name normalised to nothing lost every competitor they had.
  if (!mine.length) return rows;

  return rows.filter((r) => {
    const theirs = nameWords(r.name);
    return theirs.length > 0 && !sameShop(mine, theirs);
  });
}

/**
 * Is this the customer's own shop under a slightly different name?
 *
 * This was "is one name inside the other", which reads fine and quietly
 * deleted real competitors. A barber trading as "Cuts" lost both "Cuts Above"
 * and "Precision Cuts": two of their five slots, no warning, and then a message
 * saying we could only find three barbers in their town.
 *
 * Whole words, and one name has to START the other. "The Barber Shop" and "The
 * Barber Shop Shrewsbury" are one shop with a town added. "Cuts" and "Precision
 * Cuts" are not, and a rule built on "contains" cannot tell those apart.
 *
 * A single word only matches exactly. "Cuts" starts "Cuts Above" on a word
 * boundary, and one common word is not enough to delete somebody's competitor
 * on. The cost of being careful here is that a customer called "Hinces" may see
 * "Hinces Barber" in their own list, which is one wasted slot they can see and
 * refreshSet drops later anyway. The cost of being clever is a rival deleted
 * silently. Those are not the same size.
 *
 * What would settle it properly is the website, not the name: we already know
 * the customer's url. Worth doing, and bigger than this fix.
 */
function sameShop(mine: string[], theirs: string[]): boolean {
  const [short, long] = mine.length <= theirs.length ? [mine, theirs] : [theirs, mine];

  if (short.length === 0) return false;
  if (short.length === 1) return long.length === 1 && short[0] === long[0];

  return short.every((word, i) => long[i] === word);
}

/**
 * One shop, one entry.
 *
 * "HINCES Barber" came from the customer and "HINCES" came from the listing,
 * and both sat in the five. The agent's own sameBusiness compares normalised
 * names for equality, which is right for what it was written for and misses
 * this: one name contains the other.
 *
 * The longer name is kept. "HINCES Barber" tells a reader more than "HINCES",
 * and if either is going to be matched against a page it is the fuller one.
 */
export function oneEach<T extends { name: string }>(rows: T[]): T[] {
  const kept: T[] = [];
  for (const row of rows) {
    const name = normaliseName(row.name);
    if (!name) continue;

    const i = kept.findIndex((k) => {
      const other = normaliseName(k.name);
      return other === name || other.includes(name) || name.includes(other);
    });

    if (i === -1) {
      kept.push(row);
      continue;
    }
    if (row.name.length > kept[i].name.length) kept[i] = row;
  }
  return kept;
}

/**
 * A beauty clinic is not a barber.
 *
 * "Golden Scissors Hair And Beauty Clinique" came off a barber listing and took
 * a slot. Booking platforms group nearby trades on one page, so the listing is
 * not proof of the trade.
 *
 * Only dropped when the name confidently reads as a DIFFERENT category. A name
 * that matches nothing is kept: plenty of real businesses are called something
 * that gives no clue, and refusing those would lose more than it saves.
 */
export function rightTrade<T extends { name: string }>(rows: T[], trade: string | null): T[] {
  if (!trade) return rows;
  return rows.filter((r) => {
    const looks = matchTrade(r.name);
    return looks === null || looks === trade;
  });
}

/** All three, in the order that wastes the least work. */
export function sift<T extends { name: string }>(
  rows: T[],
  opts: { you: string | null; trade: string | null },
): T[] {
  return oneEach(rightTrade(notYou(rows, opts.you), opts.trade));
}
