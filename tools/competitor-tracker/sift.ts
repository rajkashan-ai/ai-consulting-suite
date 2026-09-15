import { normaliseName } from "../../../Agents/Competitor Tracker/src/normalise.ts";
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
  const mine = normaliseName(you);
  return rows.filter((r) => {
    const theirs = normaliseName(r.name);
    return !(theirs === mine || theirs.includes(mine) || mine.includes(theirs));
  });
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
