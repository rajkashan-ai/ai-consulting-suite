/**
 * The list the owner chooses from, and what their choice means.
 *
 * WHY THIS EXISTS
 * Picking the right five out of fifty eight, from names and urls, is a
 * precision problem we lost all of 2026-09-17 to. BARBONE reads as a salon and
 * is a barber. "Sofia Shakir MUA" reads as nothing and is a make-up artist.
 * Two businesses in Melbourne passed a town test because there is a St Albans
 * there too.
 *
 * And one case no filter can ever win. Fresha's own record for Rob's Cuts says
 * "Women's Haircut, Locs, Children's Haircut". Raj, who looked at their
 * shopfront: men and boys only. The source is wrong, so every rule built on the
 * source is wrong with it.
 *
 * Showing a longer list and letting the owner choose turns precision into
 * recall: instead of picking exactly the right five, we only have to put the
 * right five somewhere in a list they can scan. A salon owner recognises a
 * barber in a second.
 *
 * Nothing here talks to a database or a model. It is arithmetic on rows we
 * already have, so it can be tested without either.
 */
import type { Found } from "./rank.ts";
import { tradeFromUrl, whoFor } from "./sift.ts";
import { ALL, matchTrade } from "../categories.ts";

/**
 * How many we offer.
 *
 * Measured, not chosen. One real St Albans listing gave 58 candidates, of which
 * 20 were plausible women's hair salons once their own price lists were read.
 * A list of 15 would have dropped at least five real ones and our ranking would
 * have decided which five the owner never saw, which is the fault this whole
 * screen exists to remove.
 */
export const SHORTLIST = 24;

/**
 * How many are on screen before they ask for more.
 *
 * Raj, on 24: "feels too high". He is right about the screen and the
 * measurement is right about the market, so both hold: ten to scan, the rest
 * one click away. Cutting the list to ten instead would put our ranking back in
 * charge of which real competitors they never see, which is the fault this
 * screen exists to remove.
 *
 * Revealing costs nothing. All 24 are already on the page.
 */
export const SHOWN_FIRST = 10;

/** The most they may type in themselves, beyond what we found. */
export const OWN_LIMIT = 2;

/** The fewest a comparison can be built from. Matches the run's own rule. */
export const FEWEST = 2;

/** How many they are asked to end up with. */
export const PICK = 5;

/**
 * Long enough for somebody on holiday, short enough that a run does not sit
 * unfinished for ever. A run nobody answers proceeds with our own five rather
 * than producing nothing: a tool that needs a click before it does anything
 * will sit unclicked.
 */
export const HOURS_TO_CHOOSE = 48;

export type Offer = {
  name: string;
  /** Street or district as printed. Never a full postcode. */
  area: string | null;
  /** What the listing says they sell. The most useful line for recognising. */
  services: string[];
  rating: number | null;
  reviews: number | null;
  price: number | null;
  /** Their page, where the listing printed a link. Null is common. */
  url: string | null;
  miles: number | null;
  /** We could not establish the trade from anything but a name. Shown as such,
   *  rather than dropped or quietly included. */
  unsure: boolean;
  /** True for the ones we would have chosen ourselves, so agreeing is one click. */
  ours: boolean;
  /** What we make of them, in an owner's words. Null when we cannot say. */
  reads: string | null;
  /** The listing we read them off, as a host, so our reading can be weighed. */
  from: string | null;
};

/**
 * What we make of a business, in words an owner can disagree with.
 *
 * Two separate readings joined: the trade, from the platform's own url or from
 * the trading name, and who the price list is written for, from the services.
 * Either can be missing and often is.
 *
 * Written plainly on purpose. "hairdresser / women" is our machinery showing;
 * "Hair salon, women" is a claim somebody can look at and say no to, which is
 * the entire point of putting it in front of them.
 */
export function readsAs(row: {
  name: string;
  url?: string | null;
  services?: string[];
}): string | null {
  const trade = tradeFromUrl(row.url) ?? matchTrade(row.name);
  const label = trade ? (ALL.find((c) => c.id === trade)?.label ?? null) : null;
  const who = whoFor(row.services);

  // "Barber" already says who it is for. Saying "Barber, men" is the same fact
  // twice, which is exactly what Nielsen 8 is about.
  if (label && trade === "barber") return label;
  if (label && who) return `${label}, ${who}`;
  if (label) return label;
  if (who === "men") return "Men's cuts and shaves";
  if (who === "women") return "Women's hair";
  return null;
}

/**
 * Could we tell what this business is from anything but its trading name?
 *
 * The platform's own url is evidence. A name that matches a trade is weaker but
 * is something. Neither, and we say so on the screen instead of pretending.
 */
export const weKnowTheTrade = (row: { name: string; url?: string | null }): boolean =>
  tradeFromUrl(row.url) !== null || matchTrade(row.name) !== null;

/**
 * Build the list to show, ours first.
 *
 * `ranked` is what the ranking already produced, in its order. `rest` is
 * everything else that survived the filters. Ours are marked and come first so
 * an owner who agrees with us clicks once, and the rest are there so an owner
 * who does not is never stuck with our answer.
 */
export function offer(
  ranked: (Found & { miles?: number | null })[],
  rest: (Found & { miles?: number | null })[],
  limit = SHORTLIST,
): Offer[] {
  const seen = new Set<string>();
  const out: Offer[] = [];

  const add = (row: Found & { miles?: number | null }, ours: boolean) => {
    const key = row.name.trim().toLowerCase();
    if (!key || seen.has(key) || out.length >= limit) return;
    seen.add(key);
    out.push({
      name: row.name,
      area: row.area ?? null,
      services: (row.services ?? []).slice(0, 4),
      rating: row.rating ?? null,
      reviews: row.reviews ?? null,
      price: row.price ?? null,
      url: row.url ?? null,
      miles: row.miles ?? null,
      unsure: !weKnowTheTrade(row),
      ours,
      reads: readsAs(row),
      from: row.from ?? null,
    });
  };

  for (const row of ranked) add(row, true);
  for (const row of rest) add(row, false);
  return out;
}

/**
 * What the owner sent back, made safe.
 *
 * Never trusted: the names arrive from a browser, so anything not on the list
 * we offered is dropped rather than looked up. That is not politeness, it is
 * the boundary: a name we did not offer is a name we never checked the country
 * or the trade of, and it would go straight into a fetch queue.
 */
export function asChosen(sent: unknown, offered: Offer[]): string[] {
  if (!Array.isArray(sent)) return [];
  const allowed = new Map(offered.map((o) => [o.name.trim().toLowerCase(), o.name]));
  const out: string[] = [];
  for (const raw of sent) {
    if (typeof raw !== "string") continue;
    const hit = allowed.get(raw.trim().toLowerCase());
    if (hit && !out.includes(hit)) out.push(hit);
    if (out.length >= PICK) break;
  }
  return out;
}

/**
 * A name they typed in themselves, made safe.
 *
 * Held to a different rule from a ticked box, and safely so. A ticked name has
 * a url behind it and goes into a fetch queue, which is why nothing outside the
 * offer is accepted there. A typed name carries no url and never can: it
 * becomes a name in a comparison and nothing else, so there is nothing for a
 * bad one to reach.
 *
 * What is still checked is shape. A url pasted in here would read as a business
 * name on their own screen, and anything with markup in it is not somebody's
 * trading name.
 */
export function asTyped(sent: unknown, limit = OWN_LIMIT): string[] {
  if (!Array.isArray(sent)) return [];
  const out: string[] = [];
  for (const raw of sent) {
    if (typeof raw !== "string") continue;
    const name = raw.trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 60) continue;
    if (/https?:|www\.|[<>{}]/i.test(name)) continue;
    if (out.some((n) => n.toLowerCase() === name.toLowerCase())) continue;
    out.push(name);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Why a choice cannot be used yet, in the owner's words, or null.
 *
 * Counts what they typed as well as what they ticked. Somebody who knows
 * exactly who they compete with and types both names has answered the question,
 * and telling them to tick two of our suggestions instead would be the screen
 * arguing with the person it exists to ask.
 */
export function wrongWith(chosen: string[], typed: string[] = []): string | null {
  if (chosen.length + typed.length < FEWEST) {
    return `Choose at least ${FEWEST}. Comparing you against one business is not a comparison.`;
  }
  return null;
}

/**
 * Has the offer been waiting too long to wait any longer?
 *
 * Time is passed in rather than read, so a test does not have to age a real
 * row to see this fire. One did that once and destroyed the only record of how
 * long a successful run had taken.
 */
export function waitedLongEnough(offeredAt: string | null | undefined, now: Date): boolean {
  if (!offeredAt) return false;
  const then = Date.parse(offeredAt);
  if (Number.isNaN(then)) return false;   // an unreadable date is not a deadline
  return now.getTime() - then >= HOURS_TO_CHOOSE * 3_600_000;
}
