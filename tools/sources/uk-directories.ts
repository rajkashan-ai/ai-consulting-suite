/**
 * Where UK businesses of each trade are actually listed.
 *
 * WHY THIS FILE EXISTS
 * The playbook learns where a trade is listed by succeeding once and
 * remembering. That works for barbers, who are on Booksy, and deadlocks for
 * everything else: a bakery arrived with an empty playbook, we searched
 * everything, and the run picked Williams Sonoma and Uber Eats as competitors.
 * It also learned nothing, because it learns only from a listing it found, so
 * the next bakery would have started equally blind.
 *
 * This is the seed that breaks the deadlock. Every row carries where the claim
 * came from and when it was checked, so it is evidence rather than my judgement,
 * and so a stale row is visible as stale rather than silently wrong.
 *
 * WHAT IS DELIBERATELY NOT HERE
 * Businesses. This says where to look for a trade, never who was found. Nobody's
 * data is stored, nothing goes out of date weekly, and there is no licensing
 * question. See CLAUDE.md 1.4b.
 *
 * HOW IT GROWS
 * Directories and trades are separate lists joined by `covers`, so adding a
 * trade does not restate a directory's facts and correcting a directory
 * corrects it everywhere at once. `reachable` is a tested fact with a date, not
 * an assumption: three of the four largest UK directories turned out to block
 * us at the door, which no amount of reading about them would have shown.
 */

/** A trade group, so one directory covers many trades without repeating itself. */
export type Group =
  | "home-services"
  | "wellness"
  | "hair-and-beauty"
  | "automotive"
  | "healthcare"
  | "dental"
  | "legal"
  | "property"
  | "food-and-drink"
  | "professional"
  | "pets"
  | "education"
  | "retail-and-events"
  | "fitness";

export type Reachable =
  /** We fetched it and got a page. */
  | { state: "yes"; checked: string }
  /** It refused us. Never worked around: CLAUDE.md 1.5. */
  | { state: "blocked"; checked: string; how: string }
  /** Nobody has tried yet. The honest default. */
  | { state: "untested" };

export type Directory = {
  /** What a person calls it. */
  name: string;
  /** Matched against a url, so no scheme and no www. */
  host: string;
  /** Empty means it covers every trade: the floor under all of them. */
  covers: Group[];
  /**
   * Whether a listing page here names several businesses with something
   * comparable beside them. A directory that only carries a name and a phone
   * number cannot fill a grid, and is worth less than its rank suggests.
   */
  carries: ("names" | "ratings" | "reviewCount" | "prices" | "services")[];
  /** Where the claim that this matters for these trades came from. */
  source: string;
  reachable: Reachable;
  /** Anything a future reader would otherwise have to rediscover. */
  note?: string;
};

const CHECKED = "2026-09-16";
const BIRDEYE =
  "birdeye.com/blog/local-business-directories-uk/ — UK directories by industry, read 2026-09-16";
const OURS = "Our own runs";

/**
 * The floor. These apply to every trade, including the ones with no specialist
 * directory at all, which is most of ours.
 *
 * Three of the four biggest are blocked, found by asking them rather than by
 * reading about them. That is the single most useful fact in this file: without
 * it the obvious plan is to build discovery on Yell, which cannot work.
 */
export const GENERAL: Directory[] = [
  {
    name: "Yell",
    host: "yell.com",
    covers: [],
    carries: ["names", "ratings", "reviewCount"],
    source: BIRDEYE,
    reachable: { state: "blocked", checked: CHECKED, how: "Cloudflare challenge on robots.txt" },
    note:
      "Exactly the data a grid needs, for every UK trade, and we cannot reach it. " +
      "If access is ever arranged this becomes the universal floor and most of " +
      "the specialists below stop mattering.",
  },
  {
    name: "Thomson Local",
    host: "thomsonlocal.com",
    covers: [],
    carries: ["names", "ratings"],
    source: BIRDEYE,
    reachable: { state: "blocked", checked: CHECKED, how: "Returns 'You are blocked'" },
  },
  {
    name: "Cylex UK",
    host: "cylex-uk.co.uk",
    covers: [],
    carries: ["names"],
    source: BIRDEYE,
    reachable: { state: "blocked", checked: CHECKED, how: "Cloudflare challenge on robots.txt" },
  },
  {
    name: "FreeIndex",
    host: "freeindex.co.uk",
    covers: [],
    carries: ["names", "ratings", "reviewCount"],
    source: BIRDEYE,
    reachable: { state: "yes", checked: CHECKED },
    note: "The only one of the four big general directories that let us read robots.txt.",
  },
  {
    name: "Bark",
    host: "bark.com",
    covers: [],
    carries: ["names", "ratings", "reviewCount"],
    source: BIRDEYE,
    reachable: { state: "untested" },
  },
  {
    name: "Trustpilot UK",
    host: "uk.trustpilot.com",
    covers: [],
    carries: ["names", "ratings", "reviewCount"],
    source: BIRDEYE,
    reachable: { state: "untested" },
    note: "Reviews without a trade listing: good for a named business, poor for discovery.",
  },
];

/** The specialists, per group. Roughly half our trades have one. */
export const SPECIALIST: Directory[] = [
  {
    name: "Checkatrade",
    host: "checkatrade.com",
    covers: ["home-services"],
    carries: ["names", "ratings", "reviewCount"],
    source: BIRDEYE,
    reachable: { state: "blocked", checked: "2026-09-15", how: "403 to our reader, seen on a run" },
    note: "Found by a real run, not by reading. Kept here so nobody plans around it again.",
  },
  {
    name: "Rated People",
    host: "ratedpeople.com",
    covers: ["home-services"],
    carries: ["names", "ratings", "reviewCount"],
    source: BIRDEYE,
    reachable: { state: "untested" },
  },
  {
    name: "TrustATrader",
    host: "trustatrader.com",
    covers: ["home-services"],
    carries: ["names", "ratings", "reviewCount"],
    source: BIRDEYE,
    reachable: { state: "untested" },
  },
  {
    name: "Booksy",
    host: "booksy.com",
    covers: ["hair-and-beauty", "wellness"],
    carries: ["names", "ratings", "reviewCount", "prices", "services"],
    source: OURS,
    reachable: { state: "yes", checked: CHECKED },
    note:
      "The best source we have found for anything. One page gave prices, ratings " +
      "and review counts for every barber in a town. Prices are the rare part: " +
      "almost nothing else carries them.",
  },
  {
    name: "Fresha",
    host: "fresha.com",
    covers: ["hair-and-beauty", "wellness"],
    carries: ["names", "ratings", "reviewCount", "prices", "services"],
    source: BIRDEYE,
    reachable: { state: "yes", checked: CHECKED },
  },
  {
    name: "Treatwell",
    host: "treatwell.co.uk",
    covers: ["hair-and-beauty", "wellness"],
    carries: ["names", "ratings", "reviewCount", "prices", "services"],
    source: BIRDEYE,
    reachable: { state: "untested" },
  },
  {
    name: "AutoTrader UK",
    host: "autotrader.co.uk",
    covers: ["automotive"],
    carries: ["names", "prices"],
    source: BIRDEYE,
    reachable: { state: "untested" },
    note: "Prices are of cars, not of the garage's services. Read with care.",
  },
  {
    name: "RAC Approved Garages",
    host: "rac.co.uk",
    covers: ["automotive"],
    carries: ["names", "ratings"],
    source: BIRDEYE,
    reachable: { state: "untested" },
  },
  {
    name: "Doctify",
    host: "doctify.com",
    covers: ["healthcare"],
    carries: ["names", "ratings", "reviewCount"],
    source: BIRDEYE,
    reachable: { state: "untested" },
  },
  {
    name: "Care Quality Commission",
    host: "cqc.org.uk",
    covers: ["healthcare", "dental"],
    carries: ["names"],
    source: BIRDEYE,
    reachable: { state: "untested" },
    note: "A regulator's register. Complete and authoritative, and carries no ratings.",
  },
  {
    name: "NHS service search",
    host: "nhs.uk",
    covers: ["dental", "healthcare"],
    carries: ["names", "ratings"],
    source: BIRDEYE,
    reachable: { state: "untested" },
  },
  {
    name: "The Law Society",
    host: "solicitors.lawsociety.org.uk",
    covers: ["legal"],
    carries: ["names", "services"],
    source: BIRDEYE,
    reachable: { state: "untested" },
  },
  {
    name: "Solicitors Regulation Authority",
    host: "solicitors.sra.org.uk",
    covers: ["legal"],
    carries: ["names"],
    source: BIRDEYE,
    reachable: { state: "untested" },
  },
  {
    name: "Rightmove",
    host: "rightmove.co.uk",
    covers: ["property"],
    carries: ["names"],
    source: BIRDEYE,
    reachable: { state: "untested" },
  },
  {
    name: "Zoopla",
    host: "zoopla.co.uk",
    covers: ["property"],
    carries: ["names"],
    source: BIRDEYE,
    reachable: { state: "untested" },
  },
  {
    name: "OnTheMarket",
    host: "onthemarket.com",
    covers: ["property"],
    carries: ["names"],
    source: BIRDEYE,
    reachable: { state: "untested" },
  },
];

/**
 * Our trades, grouped. Slugs are the ones in categories.ts, so this file and
 * that one have to agree; a test checks that they do.
 *
 * A trade with no group is not a mistake. It means no UK directory specialises
 * in it that we have evidence for, so it falls back to the general floor and to
 * search. Food and drink, professional services, pets, education and retail are
 * all in that position, which is precisely where the bakery run failed.
 */
export const TRADE_GROUP: Record<string, Group> = {
  // Home services: the largest group, and the best served.
  plumber: "home-services", plumbing: "home-services",
  electrician: "home-services", builder: "home-services",
  construction: "home-services", roofer: "home-services", roofing: "home-services",
  carpenter: "home-services", joinery: "home-services",
  "painter-decorator": "home-services", decorator: "home-services",
  plasterer: "home-services", plastering: "home-services", rendering: "home-services",
  tiler: "home-services", flooring: "home-services",
  locksmith: "home-services", glazier: "home-services", "window-doors": "home-services",
  landscaper: "home-services", "tree-surgeon": "home-services", arborist: "home-services",
  cleaner: "home-services", "pest-control": "home-services",
  removals: "home-services", handyman: "home-services",

  // Hair and beauty, and the wellness that shares its booking platforms.
  barber: "hair-and-beauty", barbers: "hair-and-beauty", barbershop: "hair-and-beauty",
  hairdresser: "hair-and-beauty", stylist: "hair-and-beauty",
  "beauty-salon": "hair-and-beauty", beautician: "hair-and-beauty",
  "nail-salon": "hair-and-beauty", manicurist: "hair-and-beauty",
  aesthetics: "hair-and-beauty",
  "tattoo-studio": "hair-and-beauty", tattooist: "hair-and-beauty",
  "massage-spa": "wellness", masseuse: "wellness",

  // Automotive.
  garage: "automotive", servicing: "automotive",
  "car-sales": "automotive", dealership: "automotive", "car-valet": "automotive",

  physio: "healthcare", physiotherapy: "healthcare",
  chiropractor: "healthcare", osteopathy: "healthcare",
  optician: "healthcare", optometrist: "healthcare",

  dentist: "dental", orthodontist: "dental",

  solicitor: "legal", conveyancer: "legal",

  "estate-agent": "property", lettings: "property",

  // Below here: grouped for the future, with no specialist directory yet.
  cafe: "food-and-drink", bistro: "food-and-drink", eatery: "food-and-drink",
  restaurant: "food-and-drink", takeaway: "food-and-drink", kebab: "food-and-drink",
  pizza: "food-and-drink", "pub-bar": "food-and-drink",
  bakery: "food-and-drink", caterer: "food-and-drink",

  accountant: "professional", accountancy: "professional",
  "mortgage-broker": "professional", "it-support": "professional",
  "marketing-agency": "professional", branding: "professional",
  architect: "professional", architectural: "professional",
  recruiter: "professional", staffing: "professional",
  consultant: "professional",
  counselling: "professional", psychotherapist: "professional", therapist: "professional",

  vet: "pets", "pet-groomer": "pets", kennels: "pets",

  childcare: "education", childminder: "education", "pre-school": "education",
  tuition: "education", tutor: "education", "driving-instructor": "education",

  gym: "fitness", "personal-trainer": "fitness", pilates: "fitness",

  shop: "retail-and-events", store: "retail-and-events", boutique: "retail-and-events",
  convenience: "retail-and-events", florist: "retail-and-events",
  photographer: "retail-and-events", events: "retail-and-events",
};

/**
 * Where to look for this trade, best first.
 *
 * Specialists before the general floor, because a specialist carries prices and
 * services and a general directory carries a name and a star. Anything known to
 * block us is left out rather than tried and failed: a run that fetches a 403 has
 * spent time and told the owner nothing.
 */
export function sourcesFor(trade: string | null): Directory[] {
  const group = trade ? TRADE_GROUP[trade] : undefined;
  const open = (d: Directory) => d.reachable.state !== "blocked";

  return [
    ...SPECIALIST.filter((d) => group && d.covers.includes(group)).filter(open),
    ...GENERAL.filter(open),
  ];
}

/** Which trades we have a specialist for, and which fall back to search. */
export function coverage() {
  const trades = Object.keys(TRADE_GROUP);
  const withSpecialist = trades.filter((t) => {
    const g = TRADE_GROUP[t];
    return SPECIALIST.some((d) => d.covers.includes(g) && d.reachable.state !== "blocked");
  });
  return {
    trades: trades.length,
    withSpecialist: withSpecialist.length,
    fallingBackToSearch: trades.filter((t) => !withSpecialist.includes(t)),
  };
}
