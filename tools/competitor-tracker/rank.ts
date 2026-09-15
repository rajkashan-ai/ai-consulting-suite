/**
 * Which five of the seventy actually compete with you.
 *
 * Taking the first five off the listing is not an answer. Seventy barbers came
 * back for Shrewsbury and the run kept whichever the page happened to print
 * first, which is a ranking by the platform's own sort order and nothing to do
 * with this business.
 *
 * THE FACTORS, AND WHY EACH ONE EARNS ITS PLACE
 *
 *   Proximity      Weighted highest. A barber four hundred metres away is
 *                  competing for the same person walking past. One five miles
 *                  out is not, whatever else is true about them.
 *
 *   Review volume  How many customers they have actually served in public.
 *                  It is the closest thing to size we can see without asking.
 *                  Used on a log scale: the gap between 10 and 100 matters far
 *                  more than the gap between 2,400 and 2,500.
 *
 *   Recency        Reviewed in the last month means still trading and still
 *                  busy. A shop with 800 reviews and none since last year is a
 *                  different business from one with 800 and four this week.
 *
 *   Price overlap  Someone charging near your price competes for your customer.
 *                  At double or half, they are selling something else to
 *                  somebody else.
 *
 *   Rating         Weighted lowest on purpose. In the Shrewsbury test every
 *                  one of the five sat at 5.0, so it separated nobody. It is
 *                  kept because a genuine 3.8 among 5.0s is worth knowing.
 *
 * Anything we could not read scores zero for that factor rather than an assumed
 * average. A missing number is not a middling one, and quietly treating it as
 * one is how a business with no data outranks a business with bad data.
 */

export type Found = {
  name: string;
  /** Straight-line miles from the customer, where both postcodes resolved.
   *  Null is a real answer and scores zero, like any other missing number. */
  miles?: number | null;
  /** Null where the listing did not print it. Never guessed. */
  reviews: number | null;
  rating: number | null;
  /** Days since their newest review, where the listing shows a date. */
  reviewedDaysAgo: number | null;
  /** Street or district as printed, for comparing against the customer's. */
  area: string | null;
  /** Their headline price, as a number, where one is printed. */
  price: number | null;
  url: string | null;
};

export type You = {
  /** Street and district. Never a full postcode. */
  area: string | null;
  /** Their town, so it can be ignored when comparing: everyone is in it. */
  town?: string | null;
  price: number | null;
  /** How much being near counts, from where they said their customers are.
   *  Zero for a business selling nationally, where a competitor on the same
   *  street is a coincidence. */
  proximityWeight?: number;
};

export type Scored = Found & {
  score: number;
  /** Why they are on the list, in words a customer reads. */
  because: string;
};

const WEIGHT = {
  /** Replaced per business by proximityWeight(reach). A barber competes within
   *  half a mile, an agency competes with anyone in the country, and weighting
   *  them the same is right for neither. */
  proximity: 3.0,
  reviews: 2.0,
  recency: 1.5,
  priceOverlap: 1.5,
  rating: 0.5,
};

import { sayMiles } from "../../lib/research/distance.ts";

export function rank(found: Found[], you: You, take = 5): Scored[] {
  // The town is in nearly every address on the page, so matching on it makes
  // everybody near and the heaviest factor separates nobody. Ignored, so what
  // is left is the street and the district, which is the part that differs.
  const everywhere = you.town ? [you.town] : [];
  const mostReviews = Math.max(1, ...found.map((f) => f.reviews ?? 0));

  return found
    .map((f) => {
      const reasons: string[] = [];
      let score = 0;

      // Proximity. Without a distance we compare the words: the same street or
      // district is the strongest signal a listing gives us.
      /**
       * Distance in miles where we have it, words where we do not.
       *
       * Word matching was the only method and it matched nobody: two businesses
       * in a town almost never share a street name, so the heaviest factor in
       * the whole ranking contributed nothing to any run.
       *
       * Full marks next door, fading to nothing at three miles. Three because
       * that is roughly a town: past it, someone is choosing a different place
       * to go rather than the shop across the road.
       */
      const nearWeight = you.proximityWeight ?? WEIGHT.proximity;

      if (nearWeight > 0 && typeof f.miles === "number") {
        const closeness = Math.max(0, 1 - f.miles / 3);
        score += nearWeight * closeness;
        if (f.miles < 1.5) reasons.push(sayMiles(f.miles));
      } else if (nearWeight > 0 && sameArea(f.area, you.area, everywhere)) {
        // No postcode for one of them. The old method, kept because it is
        // better than nothing and it is the only thing left.
        score += nearWeight * 0.5;
        reasons.push(`near you, ${f.area}`);
      }

      // Review volume, on a log scale. 10 against 100 is a real difference;
      // 2,400 against 2,500 is not.
      if (f.reviews !== null && f.reviews > 0) {
        const share = Math.log10(1 + f.reviews) / Math.log10(1 + mostReviews);
        score += WEIGHT.reviews * share;
        reasons.push(`${f.reviews.toLocaleString()} reviews`);
      }

      // Recency. Thirty days is the line, and it fades from there.
      if (f.reviewedDaysAgo !== null) {
        const fresh = Math.max(0, 1 - f.reviewedDaysAgo / 90);
        score += WEIGHT.recency * fresh;
        if (f.reviewedDaysAgo <= 30) reasons.push("reviewed this month");
      }

      // Price overlap. Full marks at the same price, nothing at double or half.
      if (f.price !== null && you.price !== null && you.price > 0) {
        const ratio = f.price / you.price;
        const overlap = ratio >= 0.5 && ratio <= 2 ? 1 - Math.abs(1 - ratio) : 0;
        score += WEIGHT.priceOverlap * Math.max(0, overlap);
        if (overlap > 0.6) reasons.push(`charges about what you charge`);
      }

      if (f.rating !== null) score += WEIGHT.rating * (f.rating / 5);

      return {
        ...f,
        score: Math.round(score * 100) / 100,
        because: reasons.length ? reasons.join(", ") : "nothing published we could compare",
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, take);
}

/**
 * Same street, or same district.
 *
 * Words rather than distance, because a listing gives an address and not a
 * coordinate. Crude, and it is the strongest thing on the page. A postcode
 * district ("SY1") counts; a full postcode is never used, because that locates
 * a household and is personal data.
 */
export function sameArea(
  theirs: string | null,
  yours: string | null,
  ignore: string[] = [],
): boolean {
  if (!theirs || !yours) return false;

  // The town goes in here. It appears in nearly every address on the page, so
  // leaving it in makes every business in the town count as next door.
  const skip = new Set([
    ...STREET_NOISE,
    ...ignore.flatMap((w) => w.toLowerCase().split(/\s+/)),
  ]);

  const words = (s: string) =>
    new Set(
      s.toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !skip.has(w)),
    );
  const a = words(theirs);
  const b = words(yours);
  for (const w of a) if (b.has(w)) return true;
  return false;
}

/** Words in nearly every address, which would match everything. */
const STREET_NOISE = new Set([
  "road", "street", "lane", "avenue", "close", "way", "drive", "unit",
  "the", "and", "uk", "england", "ltd", "limited",
]);
