/**
 * Which action goes first, and why that one.
 *
 * It used to be whatever order the model returned. The schema said "strongest
 * first", nothing defined strongest, and nothing checked it. Raj asked what the
 * three suggestions were based on, and the honest answer was: evidence for the
 * claim, and opinion for the order.
 *
 * There is no cost, no effort and no revenue figure available to us, so we
 * cannot rank on return. What we do have, off the grid, is the size of the hole
 * each action fills: how many of the businesses compared already do this thing
 * and the owner does not. Four of five is a different proposition from one of
 * five, and the page said neither.
 *
 * That is not impact. It is a countable proxy for it, it comes from the
 * comparison rather than from a judgement, and the same card always ranks the
 * same way. Both of those are worth more here than a better guess would be.
 *
 * The count is checked against the grid before it is trusted, because a number
 * the model supplies about its own reasoning is exactly the kind of number that
 * drifts.
 */

export type Gap = { theyDo: number; outOf: number };

export type Rankable = {
  area?: string;
  headline?: string;
  gap?: Gap | null;
};

/** Why a gap cannot be used. Null when it can. */
export function gapFault(gap: Gap | null | undefined, competitors: number): string | null {
  if (!gap) return "no gap was counted";
  if (!Number.isInteger(gap.theyDo) || !Number.isInteger(gap.outOf)) return "the count is not whole";
  if (gap.outOf !== competitors) {
    return `counted out of ${gap.outOf} when ${competitors} were compared`;
  }
  if (gap.theyDo < 0 || gap.theyDo > gap.outOf) {
    return `${gap.theyDo} of ${gap.outOf} is not a count`;
  }
  return null;
}

/**
 * Order by the size of the gap, largest first, and number them 1, 2, 3.
 *
 * An action whose gap does not survive checking keeps its place in the list but
 * loses the gap, so it sorts last and the page says nothing about a hole it
 * cannot measure. It is not dropped: the advice may still be good, and three
 * actions is the shape of this product.
 *
 * Ties keep the order the model gave them, which is the only thing left to go
 * on and is at least stable.
 */
export function rankActions<T extends Rankable>(
  actions: T[],
  competitors: number,
): { actions: (T & { rank: number; gap?: Gap })[]; dropped: { headline: string; why: string }[] } {
  const dropped: { headline: string; why: string }[] = [];

  const checked = actions.map((a, i) => {
    const why = gapFault(a.gap, competitors);
    if (why) dropped.push({ headline: a.headline ?? "", why });
    return { action: a, gap: why ? null : (a.gap as Gap), order: i };
  });

  const sorted = [...checked].sort((a, b) => {
    const size = (b.gap?.theyDo ?? -1) - (a.gap?.theyDo ?? -1);
    return size !== 0 ? size : a.order - b.order;
  });

  return {
    actions: sorted.map((c, i) => {
      const { gap: _drop, ...rest } = c.action as T & { gap?: Gap | null };
      return {
        ...(rest as T),
        rank: i + 1,
        ...(c.gap ? { gap: c.gap } : {}),
      };
    }),
    dropped,
  };
}

/** "4 of the 5 we compared already do this." Said only when it was counted. */
export function gapReads(gap: Gap | undefined): string | null {
  if (!gap) return null;
  if (gap.theyDo === 0) return `None of the ${gap.outOf} we compared does this.`;
  if (gap.theyDo === gap.outOf) return `All ${gap.outOf} we compared already do this.`;
  return `${gap.theyDo} of the ${gap.outOf} we compared already do this.`;
}
