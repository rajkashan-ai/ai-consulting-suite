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
 * A name we cannot read matches nothing rather than everything. This used to
 * be a plain `includes`, and every string contains the empty string, so a
 * customer whose name normalised to nothing lost every competitor they had.
 * That is handled by the first line below rather than by an early return: an
 * early return was unreachable, and a guard that cannot be reached is a guard
 * whose removal no test notices.
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
/**
 * What the platform's own url says a business is, or null.
 *
 * Booksy writes the trade into the address it serves the page at:
 *
 *   booksy.com/en-gb/188243_sofia-shakir-mua_make-up_234686_st-albans
 *   booksy.com/en-gb/54777_picasso-cut-coffee_barber_234686_st-albans
 *
 * That is the platform stating the category itself, which beats guessing from
 * a trading name, and on 2026-09-17 we were throwing it away. A women's salon
 * was compared against a make-up artist and two barbers, and not one of the
 * three could be told from its name: "Sofia Shakir MUA", "Picasso Cut &
 * Coffee", "HOUSE of MISTR.".
 *
 * Null when the url says nothing, which is most of the web. Never a guess.
 */
export function tradeFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const last = url.split("?")[0].split("#")[0].replace(/\/+$/, "").split("/").pop() ?? "";
  // id_name_trade_cityid_city. Fewer parts than that and it is not this shape.
  const parts = last.split("_");
  if (parts.length < 5) return null;
  return matchTrade(parts[2].replace(/-/g, " ")) ?? matchTrade(parts[2]);
}

export function rightTrade<T extends { name: string; url?: string | null }>(
  rows: T[],
  trade: string | null,
): T[] {
  if (!trade) return rows;
  return rows.filter((r) => {
    // The platform first, because it knows. The name only when it does not.
    const looks = tradeFromUrl(r.url) ?? matchTrade(r.name);
    return looks === null || looks === trade;
  });
}

/** All three, in the order that wastes the least work. */
export function sift<T extends { name: string; url?: string | null; services?: string[] }>(
  rows: T[],
  opts: { you: string | null; trade: string | null; sells?: string[] },
): T[] {
  const kept = oneEach(rightTrade(notYou(rows, opts.you), opts.trade));
  // Last, because it is the most expensive question and the cheapest ones have
  // already emptied the list. Skipped when we do not know what the customer
  // sells, which is a fact about us, not a reason to refuse everybody.
  if (!opts.sells?.length) return kept;
  return kept.filter((r) => servesTheSamePeople(r.services, opts.sells!));
}

/**
 * Who serves the same customers.
 *
 * Raj, 2026-09-17, on two businesses that passed every name and category test:
 * "Barbone are barbers. Evident from their website. Rob's Cuts come up as
 * hairdressers, but only have men / boys as customers." Names lie, categories
 * lie. What a business lists for sale does not.
 *
 * THE FIRST VERSION OF THIS WAS WRONG AND PICKED NOBODY
 * It compared the words in the service names and kept anyone sharing one. That
 * passed the cases I made up and failed every real one: A Cut Above sells
 * "Ladies Cut & Finish" and Atelier sells "Women's Haircut", which is the same
 * offer with no word in common, so a genuine women's salon was refused and the
 * run produced nothing. Testing an idea against examples you wrote yourself is
 * testing your imagination.
 *
 * So: not word overlap, who they serve. Built from the eighty distinct service
 * names one real St Albans listing printed, which is a small and stable
 * vocabulary because it is how these shops write their own price lists.
 */
const FOR_MEN =
  /\b(men|mens|gents?|beard|boys|skin ?fade|skinfade|hot towel|head shave|u16s?)\b/i;

const FOR_WOMEN =
  /\b(women|womens|ladies|lady|bridal|balayage|highlights?|blow ?dry|weaves?|wig|extensions?|perm|keratin|locs|braiding|curly)\b/i;

/**
 * Men, women, or null for both and for neither.
 *
 * Null is the common answer and the safe one. "Standard Cut", "Normal Haircut"
 * and "Children's Haircut" say nothing about who walks in, and a shop selling
 * both men's and women's services is genuinely an alternative to either.
 */
export function whoFor(services: string[] | undefined): "men" | "women" | null {
  const all = (services ?? []).join(" | ");
  if (!all.trim()) return null;
  const men = FOR_MEN.test(all);
  const women = FOR_WOMEN.test(all);
  if (men === women) return null;   // both, or neither
  return men ? "men" : "women";
}

/**
 * Could their customers be your customers?
 *
 * True unless one is plainly for men and the other plainly for women. Silence
 * keeps them: most listings print nothing, and refusing on no evidence would
 * empty the comparison for every platform that does not publish services.
 */
export function servesTheSamePeople(
  theirs: string[] | undefined,
  yours: string[],
): boolean {
  const them = whoFor(theirs);
  const you = whoFor(yours);
  if (!them || !you) return true;
  return them === you;
}


/**
 * Does this name a business, or describe one?
 *
 * When a town has no listing page we can read, competitors come from search
 * results, and a search result's name is the page's own title. A title is
 * often a sentence about the trade rather than the name of a shop. On
 * 2026-09-17 a St Albans salon was offered these four as businesses:
 *
 *   Hairdressing Salon St Albans
 *   Hairdressers in St Albans
 *   Luxury hair salon in the heart of St Albans
 *   Hairdressing at TONI&GUY St. Albans
 *
 * Only the last names anybody. The first two are the trade and the town with
 * joining words, which is what a page title looks like and what a shop is
 * almost never called.
 *
 * So: take out the trade, the town and the filler, and see whether a name is
 * left. TONI&GUY survives. "Hairdressers in St Albans" leaves nothing at all,
 * and a business with no distinguishing word in its name is a description.
 *
 * Structural rather than a list of bad titles, which would only catch the
 * phrasings somebody already thought of. Deliberately generous: it asks for one
 * surviving word, not a good one, because refusing a real shop is worse than
 * offering a doubtful one on a screen built for the owner to correct.
 */
const JOINING = new Set([
  "the", "in", "at", "of", "and", "for", "near", "best", "top", "your", "our",
  "with", "by", "from", "to", "on", "a", "an", "salon", "salons", "studio",
  "shop", "ltd", "limited", "uk", "co", "com",
]);

export function namesABusiness(
  name: string,
  trade: string | null,
  town: string | null,
): boolean {
  const strip = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9&]+/g, " ").split(" ").filter(Boolean);

  const theirs = strip(name);
  if (!theirs.length) return false;

  const tradeWords = new Set([
    ...strip(trade ?? ""),
    // "hairdressing" against a trade of "hairdresser", "barbering" against
    // "barber". The stem is what the two share.
    ...strip(trade ?? "").map((w) => w.replace(/(er|ers|ing|s)$/, "")),
  ]);
  const townWords = new Set(strip(town ?? ""));

  const left = theirs.filter((w) => {
    if (JOINING.has(w) || townWords.has(w)) return false;
    const stem = w.replace(/(er|ers|ing|s)$/, "");
    return !tradeWords.has(w) && !tradeWords.has(stem) && !(stem.length > 2 && tradeWords.has(stem));
  });

  return left.length > 0;
}
