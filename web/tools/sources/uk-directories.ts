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
  /**
   * A whole group, or named trades, or both.
   *
   * It was groups only until 2026-09-16, and that made the file lie. Compare My
   * Move covers removals and conveyancing; tagged "home-services" it claimed
   * price coverage for twenty six trades including plumbers. Gudog covers dog
   * walking; tagged "pets" it claimed to cover vets. A group is the right unit
   * for Booksy and the wrong one for most of the rest.
   *
   * Empty means every trade: the floor under all of them.
   */
  covers: (Group | string)[];
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
const GEMINI =
  "Gemini research pass, 2026-09-16, each name then tested by us before it was added";
const CHATGPT = "ChatGPT research pass, 2026-09-16, each name then tested by us";
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
/**
 * Covers every trade, rather than a named few.
 *
 * An empty `covers` used to mean this, and also meant "covers none of our
 * trades" on the two dog-walking sites, so the published report had them
 * claiming all 100. One list cannot carry two opposite meanings: this says
 * "everything" out loud and leaves empty to mean empty.
 */
export const EVERY = "every-trade";

export const GENERAL: Directory[] = [
  {
    name: "Yell",
    host: "yell.com",
    covers: [EVERY],
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
    covers: [EVERY],
    carries: ["names", "ratings"],
    source: BIRDEYE,
    reachable: { state: "blocked", checked: CHECKED, how: "Returns 'You are blocked'" },
  },
  {
    name: "Cylex UK",
    host: "cylex-uk.co.uk",
    covers: [EVERY],
    carries: ["names"],
    source: BIRDEYE,
    reachable: { state: "blocked", checked: CHECKED, how: "Cloudflare challenge on robots.txt" },
  },
  {
    name: "FreeIndex",
    host: "freeindex.co.uk",
    covers: [EVERY],
    carries: ["names", "ratings", "reviewCount"],
    source: BIRDEYE,
    reachable: { state: "yes", checked: CHECKED },
    note: "The only one of the four big general directories that let us read robots.txt.",
  },
  {
    name: "Bark",
    host: "bark.com",
    covers: [EVERY],
    carries: ["names", "ratings", "reviewCount"],
    source: BIRDEYE,
    reachable: { state: "untested" },
  },
  {
    name: "Trustpilot UK",
    host: "uk.trustpilot.com",
    covers: [EVERY],
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
    reachable: { state: "yes", checked: "2026-09-18" },
    note:
      "Read on 2026-09-18: robots allows /places/, and the St Albans hair salon " +
      "list printed a ladies' cut and blow dry price for four salons. The one " +
      "place we have found that carries women's salon prices: Booksy's hair " +
      "salon category for the same town is barbers almost throughout.",
  },
  {
    name: "AutoTrader UK",
    host: "autotrader.co.uk",
    // Car prices, which are the right number for a dealer and the wrong one
    // for a garage selling servicing.
    covers: ["car-sales", "dealership"],
    carries: ["names", "prices"],
    source: BIRDEYE,
    reachable: { state: "untested" },
    note: "Prices are of cars, not of the garage's services. Read with care.",
  },
  {
    name: "RAC Approved Garages",
    host: "rac.co.uk",
    covers: ["garage", "servicing"],
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
    name: "OnTheMarket",
    host: "onthemarket.com",
    covers: ["property"],
    carries: ["names"],
    source: BIRDEYE,
    reachable: { state: "untested" },
  },
  // ---------------------------------------------------------------------
  // Added 2026-09-16 from two research passes. Every host below was fetched
  // before it was written down; the ones that refused us are recorded as
  // blocked rather than quietly dropped, so nobody suggests them again.
  // ---------------------------------------------------------------------
  {
    name: "WhoCanFixMyCar",
    host: "whocanfixmycar.com",
    covers: ["garage", "servicing"],
    carries: ["names", "ratings", "reviewCount", "prices", "services"],
    source: GEMINI,
    reachable: { state: "yes", checked: CHECKED },
    note:
      "Servicing and MOT prices, which is what a garage actually sells. " +
      "AutoTrader's prices are of cars and were always the wrong number.",
  },
  {
    name: "Servicing Stop",
    host: "servicingstop.co.uk",
    covers: ["garage", "servicing"],
    carries: ["names", "prices", "services"],
    source: GEMINI,
    reachable: { state: "yes", checked: CHECKED },
  },
  {
    name: "BookMyGarage",
    host: "bookmygarage.com",
    covers: ["garage", "servicing"],
    carries: ["names", "ratings", "prices"],
    source: GEMINI,
    reachable: { state: "blocked", checked: CHECKED, how: "429 on robots.txt" },
  },
  {
    name: "Compare My Move",
    host: "comparemymove.com",
    // Removals and conveyancing. Not plumbing, not building, not roofing.
    covers: ["removals", "conveyancer", "solicitor"],
    carries: ["names", "ratings", "reviewCount", "prices"],
    source: GEMINI,
    reachable: { state: "yes", checked: CHECKED },
    note: "Conveyancing quotes, and removals. The only price source legal has.",
  },
  {
    name: "reallymoving",
    host: "reallymoving.com",
    covers: ["removals", "conveyancer", "solicitor"],
    carries: ["names", "ratings", "prices"],
    source: GEMINI,
    reachable: { state: "yes", checked: CHECKED },
  },
  {
    name: "The Law Superstore",
    host: "thelawsuperstore.co.uk",
    covers: ["conveyancer", "solicitor"],
    carries: ["names", "ratings", "prices"],
    source: GEMINI,
    reachable: { state: "yes", checked: CHECKED },
  },
  {
    name: "Direct2Florist",
    host: "direct2florist.co.uk",
    covers: ["florist"],
    carries: ["names", "ratings", "reviewCount", "prices"],
    source: GEMINI,
    reachable: { state: "yes", checked: CHECKED },
    note: "Local independent florists by town, with product prices.",
  },
  {
    name: "Poptop",
    host: "poptop.uk.com",
    covers: ["photographer", "events", "caterer"],
    carries: ["names", "ratings", "reviewCount", "prices"],
    source: GEMINI,
    reachable: { state: "yes", checked: CHECKED },
    note: "Photographers and event suppliers, with package prices.",
  },
  {
    name: "Add to Event",
    host: "addtoevent.co.uk",
    covers: ["photographer", "events", "caterer"],
    carries: ["names", "ratings", "reviewCount", "prices"],
    source: GEMINI,
    reachable: { state: "yes", checked: CHECKED },
  },
  {
    name: "Daynurseries",
    host: "daynurseries.co.uk",
    covers: ["childcare", "childminder", "pre-school"],
    carries: ["names", "ratings", "reviewCount"],
    source: GEMINI,
    reachable: { state: "yes", checked: CHECKED },
    note: "Nurseries by town. Fees are rarely public: most ask you to ring.",
  },
  {
    name: "Childcare.co.uk",
    host: "childcare.co.uk",
    covers: ["childcare", "childminder", "pre-school"],
    carries: ["names", "ratings", "reviewCount"],
    source: GEMINI,
    reachable: { state: "yes", checked: CHECKED },
  },
  {
    name: "Unbiased",
    host: "unbiased.co.uk",
    covers: ["accountant", "accountancy", "mortgage-broker"],
    carries: ["names", "ratings", "reviewCount"],
    source: GEMINI,
    reachable: { state: "yes", checked: CHECKED },
    note: "Accountants, mortgage brokers, financial advisers. No fees: they are bespoke.",
  },
  {
    name: "VouchedFor",
    host: "vouchedfor.co.uk",
    covers: ["accountant", "accountancy", "mortgage-broker"],
    carries: ["names", "ratings", "reviewCount"],
    source: GEMINI,
    reachable: { state: "yes", checked: CHECKED },
  },
  {
    name: "Creativepool",
    host: "creativepool.com",
    covers: ["marketing-agency", "branding"],
    carries: ["names"],
    source: GEMINI,
    reachable: { state: "yes", checked: CHECKED },
    note: "Marketing and design agencies. Thin: names, little else.",
  },
  {
    name: "Clutch",
    host: "clutch.co",
    covers: ["it-support", "marketing-agency", "branding", "recruiter", "staffing", "consultant"],
    carries: ["names", "ratings", "reviewCount"],
    source: GEMINI,
    reachable: { state: "blocked", checked: CHECKED, how: "403 on robots.txt" },
  },
  {
    name: "MyBuilder",
    host: "mybuilder.com",
    covers: ["home-services"],
    carries: ["names", "ratings", "reviewCount"],
    source: GEMINI,
    reachable: { state: "yes", checked: CHECKED },
  },
  {
    name: "Deliveroo",
    host: "deliveroo.co.uk",
    covers: ["cafe", "restaurant", "takeaway", "kebab", "pizza", "bakery"],
    carries: ["names", "ratings", "reviewCount", "prices", "services"],
    source: CHATGPT,
    reachable: { state: "yes", checked: CHECKED },
    note: "Menu prices. The only wide price source food has.",
  },
  {
    name: "DesignMyNight",
    host: "designmynight.com",
    covers: ["restaurant", "bistro", "eatery", "pub-bar", "events"],
    carries: ["names", "ratings", "reviewCount", "prices"],
    source: CHATGPT,
    reachable: { state: "yes", checked: CHECKED },
  },
  {
    name: "TheFork",
    host: "thefork.co.uk",
    covers: ["restaurant", "bistro", "eatery", "pub-bar"],
    carries: ["names", "ratings", "reviewCount", "prices"],
    source: CHATGPT,
    reachable: { state: "yes", checked: CHECKED },
  },
  {
    name: "ResDiary",
    host: "resdiary.com",
    covers: ["restaurant", "bistro", "eatery", "pub-bar"],
    carries: ["names", "prices"],
    source: CHATGPT,
    reachable: { state: "yes", checked: CHECKED },
  },
  {
    name: "Food Standards Agency",
    host: "api.ratings.food.gov.uk",
    covers: ["food-and-drink"],
    carries: ["names"],
    source: OURS,
    reachable: { state: "yes", checked: CHECKED },
    note:
      "Official, open, no key, and it found Proto Artisan Bakery by name and " +
      "postcode in one call. Every food business in the UK. Identity only: no " +
      "prices, no reviews, so it pairs with Deliveroo rather than replacing it.",
  },
  {
    name: "Tutorful",
    host: "tutorful.co.uk",
    covers: ["tuition", "tutor"],
    carries: ["names", "ratings", "reviewCount", "prices"],
    source: CHATGPT,
    reachable: { state: "yes", checked: CHECKED },
    note: "Hourly rates, openly listed.",
  },
  {
    name: "ClassForKids",
    host: "classforkids.co.uk",
    // Children's clubs and activities. Not nurseries, not driving lessons.
    covers: ["tuition", "tutor"],
    carries: ["names", "prices"],
    source: CHATGPT,
    reachable: { state: "yes", checked: CHECKED },
  },
  {
    name: "ClassPass",
    host: "classpass.com",
    covers: ["fitness"],
    carries: ["names", "ratings", "reviewCount", "prices", "services"],
    source: CHATGPT,
    reachable: { state: "yes", checked: CHECKED },
  },
  {
    name: "Mindbody",
    host: "mindbody.io",
    covers: ["fitness"],
    carries: ["names", "ratings", "prices", "services"],
    source: CHATGPT,
    reachable: { state: "yes", checked: CHECKED },
  },
  {
    name: "Hussle",
    host: "hussle.com",
    covers: ["fitness"],
    carries: ["names", "ratings", "reviewCount", "prices"],
    source: CHATGPT,
    reachable: { state: "yes", checked: CHECKED },
  },
  {
    name: "BorrowMyDoggy",
    host: "borrowmydoggy.com",
    /**
     * Dog walking and sitting, which is not one of our trades at all. Our pets
     * group is vet, pet-groomer and kennels, and this covers none of them.
     * Kept because the trade may be worth adding; covering nothing today is the
     * honest entry, and it is why pets has no price source.
     */
    covers: [],
    carries: ["names", "prices"],
    source: CHATGPT,
    reachable: { state: "yes", checked: CHECKED },
    note: "Walking and sitting only. Nothing here for a vet or a kennel.",
  },
  {
    name: "Gudog",
    host: "gudog.co.uk",
    // Dog walking and boarding by individuals, not licensed kennels.
    covers: [],
    carries: ["names", "ratings", "reviewCount", "prices"],
    source: CHATGPT,
    reachable: { state: "yes", checked: CHECKED },
  },
  {
    name: "Pets4Homes",
    host: "pets4homes.co.uk",
    covers: [],
    carries: ["names"],
    source: GEMINI,
    reachable: { state: "yes", checked: CHECKED },
  },
  {
    name: "Psychology Today",
    host: "psychologytoday.com",
    // Therapists only. Not accountants, IT, marketing or recruitment.
    covers: ["counselling", "psychotherapist", "therapist"],
    carries: ["names", "prices"],
    source: CHATGPT,
    reachable: { state: "yes", checked: CHECKED },
    note: "Therapists and counsellors, often with a session fee.",
  },
  {
    name: "Eventbrite",
    host: "eventbrite.co.uk",
    covers: ["events"],
    carries: ["names", "prices"],
    source: CHATGPT,
    reachable: { state: "yes", checked: CHECKED },
  },
  {
    name: "Tagvenue",
    host: "tagvenue.com",
    covers: ["events"],
    carries: ["names", "ratings", "reviewCount", "prices"],
    source: CHATGPT,
    reachable: { state: "yes", checked: CHECKED },
  },
  {
    name: "Just Eat",
    host: "just-eat.co.uk",
    covers: ["cafe", "restaurant", "takeaway", "kebab", "pizza", "bakery"],
    carries: ["names", "ratings", "reviewCount", "prices"],
    source: CHATGPT,
    reachable: { state: "blocked", checked: CHECKED, how: "403 on robots.txt" },
  },
  {
    name: "Uber Eats",
    host: "ubereats.com",
    covers: ["cafe", "restaurant", "takeaway", "kebab", "pizza", "bakery"],
    carries: ["names", "ratings", "prices"],
    source: CHATGPT,
    reachable: { state: "blocked", checked: CHECKED, how: "403 on robots.txt" },
  },
  {
    name: "Rover",
    host: "rover.com",
    covers: [],
    carries: ["names", "ratings", "reviewCount", "prices"],
    source: CHATGPT,
    reachable: { state: "blocked", checked: CHECKED, how: "403 on robots.txt" },
  },
  {
    name: "Superprof",
    host: "superprof.co.uk",
    covers: ["tuition", "tutor"],
    carries: ["names", "ratings", "prices"],
    source: CHATGPT,
    reachable: { state: "blocked", checked: CHECKED, how: "403 on robots.txt" },
  },
  {
    name: "Fever",
    host: "fever.com",
    covers: ["events"],
    carries: ["names", "prices"],
    source: CHATGPT,
    reachable: { state: "blocked", checked: CHECKED, how: "403 on robots.txt" },
  },
  {
    name: "Zoopla",
    host: "zoopla.co.uk",
    covers: ["property"],
    carries: ["names"],
    source: BIRDEYE,
    reachable: { state: "blocked", checked: CHECKED, how: "403 on robots.txt" },
  },
];

/**
 * Where no price comparison is possible, and why. Confirmed by two independent
 * research passes on 2026-09-16, not assumed.
 *
 * This is the most useful list in the file, because it stops the next person
 * spending an afternoon looking for something that does not exist. In each case
 * the reason is how the trade prices its work, not a hole in our searching.
 *
 * A run for one of these groups still compares reviews, coverage and what each
 * business publishes. It must say plainly that price is not comparable here,
 * rather than leaving an empty column that reads as a failure.
 */
export const NO_PUBLIC_PRICES: { group: Group; why: string }[] = [
  {
    group: "home-services",
    why:
      "Every UK trade directory works on quote for the job. Checkatrade, " +
      "MyBuilder, Rated People, TrustATrader and Bark all publish names, " +
      "ratings and review counts, and none publishes a rate or a call-out fee. " +
      "26 trades, the largest group we have. Removals is the one exception: " +
      "Compare My Move and reallymoving quote it, because a move is a priceable " +
      "job and a leaking pipe is not.",
  },
  {
    group: "pets",
    why:
      "Nothing for any of our three. Dog walking and sitting have marketplace " +
      "prices on BorrowMyDoggy and Gudog, but walking is not a trade we offer: " +
      "ours are vet, pet-groomer and kennels. Veterinary treatment is priced " +
      "after a consultation, and no UK directory indexes kennel rates.",
  },
  {
    group: "healthcare",
    why:
      "No UK marketplace aggregates independent physios, chiropractors or " +
      "opticians with treatment prices. Chains publish their own fee cards; " +
      "independents do not.",
  },
  {
    group: "dental",
    why: "Same as healthcare. CQC and NHS carry names and inspections, never fees.",
  },
  {
    group: "property",
    why:
      "Rightmove and OnTheMarket list properties, not agents' fees. Agency " +
      "commission is negotiated and unpublished.",
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

  // Named trades first, then the trade's group, then the floor. A source that
  // names this exact trade knows more about it than one covering the group.
  const named = SPECIALIST.filter((d) => trade && d.covers.includes(trade)).filter(open);
  const byGroup = SPECIALIST.filter(
    (d) => group && d.covers.includes(group) && !named.includes(d),
  ).filter(open);

  return [...named, ...byGroup, ...GENERAL.filter(open)];
}

/**
 * Hosts we have fetched and been refused by.
 *
 * Exported because the trade tiers are not the only way a host reaches a run.
 * The owner's own answer supplies hosts too, and "a marketplace or directory"
 * maps to Yell, which returns a Cloudflare challenge. Searching it spends one
 * of the searches we pay for to learn nothing.
 *
 * Never worked around, per CLAUDE.md 1.5. Left out, not retried.
 */
/**
 * Every platform that publishes prices for this trade, and that we can reach.
 *
 * 2026-09-18, and the rule behind it: never conclude a price is unpublished
 * until every industry-equivalent platform has been asked. A single site check
 * answers only whether that site prints a price.
 *
 * A Cut Above is the case. Booksy and Fresha were searched, and the honest
 * answer from those two is that no comparable salon in St Albans publishes
 * anything: Booksy's hair-salon category for that town is barbers almost
 * throughout, and the five Fresha entries are unclaimed stubs that say so on
 * the page. Treatwell prints a ladies' cut and blow dry for four St Albans
 * salons. We stopped at two platforms and reported the answer the first two
 * gave as though it were the answer.
 *
 * Returned in the list's own order, so the best-read platform is asked first
 * and the caller decides how many it can afford.
 */
export function pricedSourcesFor(trade: string | null): Directory[] {
  return sourcesFor(trade).filter(
    (d) => d.carries.includes("prices") && d.reachable.state !== "blocked",
  );
}

export function blockedHosts(): string[] {
  return [...GENERAL, ...SPECIALIST]
    .filter((d) => d.reachable.state === "blocked")
    .map((d) => d.host.toLowerCase().replace(/^www\./, ""));
}

/** Every trade this source claims, whether it named them or named their group. */
export function tradesCovered(d: Directory): string[] {
  const all = Object.keys(TRADE_GROUP);
  if (d.covers.includes(EVERY)) return all;
  return all.filter((t) => d.covers.includes(t) || d.covers.includes(TRADE_GROUP[t]));
}

/**
 * One row per trade, for checking by somebody who did not build this.
 *
 * Deliberately flat and dull: trade, whether its price can be compared, by
 * what, and on whose word. Everything needed to disagree with it.
 */
export function asRows() {
  const noPrices = new Set(NO_PUBLIC_PRICES.map((n) => n.group));

  return Object.keys(TRADE_GROUP).sort().map((trade) => {
    const open = sourcesFor(trade).filter((d) => !d.covers.includes(EVERY));
    const priced = open.filter((d) => d.carries.includes("prices"));
    const group = TRADE_GROUP[trade];

    return {
      trade,
      group,
      canComparePrices: priced.length > 0,
      priceSources: priced.map((d) => d.name),
      otherSources: open.filter((d) => !d.carries.includes("prices")).map((d) => d.name),
      groupHasNoPublicPrices: noPrices.has(group),
      sourceOfClaim: [...new Set(priced.map((d) => d.source.split(",")[0]))],
    };
  });
}

/**
 * Which trades we can compare on price, and which we cannot.
 *
 * This used to count trades with any specialist at all, and by 2026-09-16 the
 * answer was all of them, which made the number useless. Every trade has
 * somewhere to look now. What separates them is whether anywhere publishes what
 * they charge, and for about forty trades nothing does: see NO_PUBLIC_PRICES.
 */
export function coverage() {
  const trades = Object.keys(TRADE_GROUP);
  const noPrices = new Set(NO_PUBLIC_PRICES.map((n) => n.group));

  const canPrice = trades.filter((t) => {
    const g = TRADE_GROUP[t];
    if (noPrices.has(g)) return false;
    return SPECIALIST.some(
      (d) => d.covers.includes(g) && d.carries.includes("prices") && d.reachable.state !== "blocked",
    );
  });

  return {
    trades: trades.length,
    withSpecialist: trades.filter((t) =>
      SPECIALIST.some((d) => d.covers.includes(TRADE_GROUP[t]) && d.reachable.state !== "blocked"),
    ).length,
    canComparePrices: canPrice.length,
    noPriceAnywhere: trades.filter((t) => !canPrice.includes(t)),
  };
}
