/**
 * Checking a competitor the customer named, before it takes one of the five.
 *
 * WHY
 * The list is capped at five and anyone the customer adds is permanent, so a
 * name we can find nothing about does not produce an empty row: it evicts a
 * competitor we could actually read and replaces it with blanks, every week,
 * for ever. That is the most expensive kind of empty cell in the tool.
 *
 * And a name is not a business. "The Fade Inn" matched an account with 9,065
 * followers that turned out to be a barber on Hollywood Boulevard. The tool had
 * that number on the wrong business for two days. Confirming what we found,
 * with an address, is what stops the customer inheriting that mistake.
 *
 * SO: check on the way in, not on the next weekly run. A customer who typed a
 * name is standing there, and is the only person who can tell us we found the
 * wrong shop.
 */
import type { Source } from './types.ts';

export interface Found {
  name: string;
  /** Whatever identifies it to a human: an address, a town, a domain. */
  where: string | null;
  sources: Source[];
}

export type CheckResult =
  /** One clear match. Show it and ask them to confirm it is the right business. */
  | { status: 'confirm'; found: Found }
  /** More than one business answers to this name. Never guess between them. */
  | { status: 'which-one'; options: Found[] }
  /** Nothing public at all. They may still keep it, knowing the row will be thin. */
  | { status: 'nothing-found'; name: string; looked: string[] }
  /** We could not complete the check. Different from finding nothing. */
  | { status: 'could-not-check'; name: string; because: string };

/** What a row needs before it is worth one of the five slots. */
export const USEFUL_IF_AT_LEAST = 1;

export function check(name: string, found: Found[], searchedSources: string[], failed?: string): CheckResult {
  if (failed) return { status: 'could-not-check', name, because: failed };
  const real = found.filter(f => f.sources.length >= USEFUL_IF_AT_LEAST);

  if (real.length === 0) return { status: 'nothing-found', name, looked: searchedSources };
  if (real.length > 1) return { status: 'which-one', options: real };
  return { status: 'confirm', found: real[0] };
}

/**
 * What the screen says. Written here rather than in the markup so the same
 * words appear wherever a competitor is added, and so they can be tested.
 */
export function say(r: CheckResult): { title: string; detail: string; canKeep: boolean } {
  switch (r.status) {
    case 'confirm':
      return {
        title: `Is this the right ${r.found.name}?`,
        detail: r.found.where
          ? `We found ${r.found.name}, ${r.found.where}.`
          : `We found ${r.found.name}, but nothing that says where they are.`,
        canKeep: true,
      };
    case 'which-one':
      return {
        title: `More than one business is called ${r.options[0].name}`,
        detail: `We found ${r.options.length}. Pick the one you meant, or none of them.`,
        canKeep: false,          // never guess between two real businesses
      };
    case 'nothing-found':
      return {
        title: `We cannot find anything about ${r.name}`,
        detail:
          `We looked at ${r.looked.join(', ')} and found no prices, no reviews and no website. ` +
          `You can still add them, and their row will stay empty until something appears.`,
        canKeep: true,
      };
    case 'could-not-check':
      return {
        title: `We could not check ${r.name} just now`,
        detail: `${r.because}. Add them and we will check on the next run.`,
        canKeep: true,
      };
  }
}

/**
 * A thin competitor is allowed, but the list is capped at five and they are
 * permanent, so the cost has to be said out loud before it is paid.
 */
export function costOfKeeping(setSize: number, max: number): string | null {
  if (setSize < max) return null;
  return `You already have ${max}, so this replaces one of them, and empty is what you will see in its place.`;
}
