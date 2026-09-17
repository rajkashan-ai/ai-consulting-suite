/**
 * The rules that must never break, made checkable.
 *
 * CLAUDE.md section 5 lists what this tool must never do. A rule written in
 * prose is a hope. Each one below is the same rule as a function that returns
 * the violations it found, so a test can fail on it.
 *
 * Every function returns a list. Empty means clean.
 */
import type { Action, Battlecard, Claim, Competitor } from './types.ts';
import { AREAS } from './types.ts';

/* ── Never claim to know a competitor's traffic (section 5.1) ─────────────── */

const TRAFFIC_PHRASES = [
  'traffic', 'visitors per month', 'monthly visitors',
  'estimated visits', 'page views', 'pageviews', 'unique visitors',
  // 'conversion' bare fired on "the conversion of the back room into a third
  // chair". 'conversion rate' and 'convert at' carry the analytics sense on
  // their own, so the bare noun bought nothing and cost a false positive.
  'bounce rate', 'conversion rate', 'convert at',
  'click-through', 'clickthrough', 'search volume',
  // A local business's version of the same invented number.
  'footfall', 'walk-ins per', 'customers per week', 'customers per month',
];

/**
 * The context-sensitive ones, where the word alone does not settle it.
 *
 * 'sessions' sat in the list above bare until 15 September and fired on
 * "barbering sessions for apprentices". In web analytics a session is a visit;
 * in a barber's or salon's own price list it is an appointment, and a guard
 * that flags a competitor's service name is one that gets switched off.
 *
 * Narrowing it to a fixed set of periods was the first attempt, and an existing
 * test caught it immediately on "12,000 sessions a quarter" — a real invented
 * figure the narrower list let through. Enumerating periods is the wrong shape.
 * What makes it an analytics claim is a count or a rate attached to it, so that
 * is what the pattern looks for.
 */
const TRAFFIC_PATTERNS: [string, RegExp][] = [
  ['sessions', /\b\d[\d,.]*\s+sessions\b|\bsessions\s+(?:a|per|each)\s+\w+|\b(?:web|site|website)\s+sessions\b/],
  /**
   * 'visitors per month' and 'monthly visitors' were listed as fixed phrases,
   * so "about 4,000 visitors a month to their site" walked straight through and
   * was stored on a real card. Enumerating the ways to write a period is the
   * mistake the sessions pattern already records: what makes it a traffic claim
   * is a count or a period attached to the word, so match that instead.
   */
  ['visitors', /\b\d[\d,.]*\s+(?:unique\s+)?visitors\b|\bvisitors\s+(?:a|per|each)\s+\w+/],
  /**
   * What anyone spends on advertising. Nothing in the list covered it at all,
   * in any phrasing, although "what anyone is advertising" is one of the things
   * UI/CLAUDE.md says must never appear. An amount, or the budget named.
   */
  ['ad spend', /\bad\s?spend\b|\badvertising\s+(?:budget|spend)\b|\bspend(?:s|ing)?\b[^.]{0,40}\bon\s+(?:ads|adverts|advertising)\b|\b(?:ads|adverts|advertising)\s+budget\b/],
  // "First impressions of the shop matter more than the price" is not an ad
  // metric. Word boundaries do not separate these two: it is the same word in
  // both senses, and only a count or an advertising context tells them apart.
  ['impressions', /\b\d[\d,.]*\s+impressions\b|\b(?:ad|ads|advert|adverts|campaign|campaigns)\s+\w*\s*impressions\b|\bimpressions\s+(?:a|per|each)\s+\w+/],
];
/**
 * A search result is not a ranking.
 *
 * Search visibility answers "who comes up for this", not "what position are you
 * on Google". Those are different claims, and the second is the same class of
 * invention as a traffic figure: a number nobody gave us, put in front of
 * someone who will act on it.
 */
const RANK_CLAIM =
  /\b(?:rank|ranked|ranks|ranking|position|positioned|placed)\b[^.]{0,40}\b(?:\d+|first|second|third|fourth|fifth|ninth|top)\b|(?:#\s?\d+|\b\d+(?:st|nd|rd|th)\b)[^.]{0,40}\b(?:google|bing|search results|serp)\b/i;

export function findRankClaims(text: string): boolean {
  return RANK_CLAIM.test(text);
}



/**
 * We cannot see it, nobody can without buying panel data, and we did not buy it.
 * The one allowed use is saying we do not have it, so a sentence that denies the
 * data is not a violation.
 */
/** Whole words only. `indexOf` matched inside longer ones: "obsessions" and
 *  "barbering sessions" both contained "sessions" and were reported as invented
 *  traffic figures. A barber sells sessions. findBuildDetail in this same file
 *  had used \b since the day it was written, so the file disagreed with itself.
 *
 *  NOT CURRENTLY EXERCISED BY A TEST, and that is recorded rather than hidden:
 *  removing the \b here is 0 red. The two phrases that had substring collisions,
 *  'sessions' and 'impressions', both moved to TRAFFIC_PATTERNS, so nothing left
 *  in TRAFFIC_PHRASES collides with a longer word in this trade's vocabulary.
 *  The boundary stays because the next phrase added might, and a defensive fix
 *  reading 0 red is not the same as a fix that does nothing. */
const wordMatch = (phrase: string) =>
  new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');

const DENIAL = /(cannot|can't|do not|don't|never|no one|nobody|not) (see|know|have|offer|buy|bought|sell|ask|want|collect)/;

export function findTrafficClaims(text: string): string[] {
  const lower = text.toLowerCase();
  const hit = (re: RegExp) => {
    for (const m of lower.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))) {
      if (!DENIAL.test(sentenceAround(lower, m.index))) return true;
    }
    return false;
  };
  return [
    ...TRAFFIC_PHRASES.filter(p => hit(wordMatch(p))),
    ...TRAFFIC_PATTERNS.filter(([, re]) => hit(re)).map(([name]) => name),
  ];
}

function sentenceAround(text: string, index: number): string {
  const start = Math.max(0, text.lastIndexOf('.', index) + 1);
  const end = text.indexOf('.', index);
  return text.slice(start, end === -1 ? text.length : end);
}

/* ── Never put a feedback prompt inside a deliverable (section 5.2) ───────── */

const FEEDBACK_PHRASES = [
  'how did this output land', 'was this any use', 'was this helpful',
  'feedback', 'rate this', 'thumbs up', 'let us know what you think',
];

/** The battlecard gets exported and forwarded. Feedback lives in the app around it. */
/**
 * Whole words, and a denial is not a prompt.
 *
 * Both fixes were already sitting in findTrafficClaims and had never been
 * carried across. A fix to one guard is a question about every other guard of
 * the same shape, and that question had not been asked here.
 */
export function findFeedbackPrompts(exported: string): string[] {
  const lower = exported.toLowerCase();
  return FEEDBACK_PHRASES.filter(phrase => {
    for (const m of lower.matchAll(wordMatch(phrase))) {
      if (!DENIAL.test(sentenceAround(lower, m.index))) return true;
    }
    return false;
  });
}

/* ── Never invent a price, a promise or a review (section 5.3) ────────────── */

/** A claim we state must say where it came from and when. */
export function findUnsourcedClaims(competitors: Competitor[]): Claim[] {
  const bad: Claim[] = [];
  for (const c of competitors) {
    for (const claims of Object.values(c.claims)) {
      for (const claim of claims ?? []) {
        // "We could not see it" is a complete, honest answer and needs no source.
        if (claim.value === null) continue;
        if (claim.source === null) bad.push(claim);
        else if (!claim.source.url || !claim.source.fetchedOn) bad.push(claim);
      }
    }
  }
  return bad;
}

/** A fetch date in the future means the date was generated, not read. */
export function findImpossibleDates(competitors: Competitor[], now: Date): Claim[] {
  const bad: Claim[] = [];
  for (const c of competitors) {
    for (const claims of Object.values(c.claims)) {
      for (const claim of claims ?? []) {
        if (!claim.source) continue;
        const when = new Date(claim.source.fetchedOn);
        if (Number.isNaN(when.getTime()) || when.getTime() > now.getTime()) bad.push(claim);
      }
    }
  }
  return bad;
}

export const STALE_AFTER_DAYS = 30;

/** Older than thirty days still ships, but the export has to say so. */
export function findStaleClaims(competitors: Competitor[], now: Date): Claim[] {
  const cutoff = now.getTime() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  const stale: Claim[] = [];
  for (const c of competitors) {
    for (const claims of Object.values(c.claims)) {
      for (const claim of claims ?? []) {
        if (claim.source && new Date(claim.source.fetchedOn).getTime() < cutoff) stale.push(claim);
      }
    }
  }
  return stale;
}

/* ── No build detail on a customer's screen (base-prompt.md) ──────────────── */

/**
 * Our plumbing is not their information.
 *
 * 14 September: the advertising gap shipped to the workspace explaining that
 * someone has to send Meta a passport and wait a week. A barber does not care.
 * Worse, it said the application "is being started", which was not true of
 * anything. Build detail invites a customer to worry about our problems, and a
 * status claim about our own work is the easiest false statement to write
 * because nobody checks it.
 *
 * The customer-facing reason for a gap is "we cannot see this yet". The real
 * reason lives in the build notes, where it belongs.
 */
const BUILD_WORDS = [
  'api', 'endpoint', 'token', 'access key', 'oauth', 'rate limit',
  'app review', 'business verification', 'identity check', 'id check', 'passport',
  'proof of address', 'developer account', 'robots.txt', 'scrape', 'crawler',
  'prompt', 'model', 'database', 'migration', 'schema', 'deploy', 'repo',
  'we have not applied', 'is being started', 'we are working on',
];

/** Text a customer reads. Anything here is a leak from the build into the product. */
export function findBuildDetail(customerFacing: string): string[] {
  const lower = customerFacing.toLowerCase();
  return BUILD_WORDS.filter(w => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lower));
}

/* ── A gap must carry its reason (base-prompt.md) ─────────────────────────── */

/**
 * "Not checked" on its own reads as a shrug, and the customer assumes there was
 * nothing to find. Raj, 14 September, on seeing "Nobody's advertising was
 * checked" at the foot of the barber card: why?
 *
 * So an empty cell has to say what is absent, or why we did not look. "No prices
 * published" is a finding. "Not checked" is a hole in the work.
 */
const BARE_GAP = /^(not checked|not counted|unknown|none|n\/a|no data|not available|missing|tbc|nothing|-|\u2014)\.?$/i;

export function findUnexplainedGaps(competitors: Competitor[]): Claim[] {
  const bad: Claim[] = [];
  for (const c of competitors) {
    for (const claims of Object.values(c.claims)) {
      for (const claim of claims ?? []) {
        if (claim.value !== null) continue;
        const text = claim.text.trim();
        if (BARE_GAP.test(text) || text.length < 12) bad.push(claim);
      }
    }
  }
  return bad;
}

/* ── Reviews give themes, never named individuals (section 4, UK GDPR) ────── */

/** "it was public" is not a lawful basis on its own. */
/**
 * Capitalised and not a person. "A review from Monday" is a date, and this
 * tool writes dates constantly. Kept deliberately short and literal: a
 * cleverer test for personhood would fail in ways nobody could predict, and
 * the cost of a miss here is a real name in an exported document.
 */
const NOT_A_PERSON = new Set([
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december',
  'booksy', 'fresha', 'google', 'instagram', 'facebook', 'nearcut', 'yelp',
]);

export function findNamedReviewers(text: string): string[] {
  const patterns = [
    // The keyword is case-tolerant, the NAME is not. This carried /i until
    // 15 September, which made [A-Z][a-z]+ match any lowercase word and turned
    // the whole capitalisation test off: "from the last", "customer would run"
    // and "client to review" were all reported as named individuals. Twelve
    // false positives on a clean screen, on the guard that exists for UK GDPR,
    // which is exactly how a guard stops being read. The /i was added earlier to
    // fix a real miss on "Reviewer Sarah"; spelling both cases of the keyword
    // keeps that fix without spending the capitalisation test to get it.
    /\b(?:[Rr]eviewer|[Cc]ustomer|[Cc]lient|[Pp]osted by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]*\.?)?)\b/g,
    // `from` was in the list above and was dropped on 15 September because it
    // fired on "from Shrewsbury". That removed three real violations with it:
    // "A review from Sarah" is exactly how this tool would phrase one, and it
    // sailed straight through a green suite. The false positive was never the
    // word `from`, it was `from` with no idea what preceded it. Narrow the
    // CONTEXT, not the keyword — which is the whole lesson of the sessions and
    // impressions cases, arriving a third time in a different guard.
    // NOT /i. Spelled both cases instead, for the second time in one session:
    // the flag makes [A-Z][a-z]+ match any word and switches the capitalisation
    // test off, so "review from the last thirty days" reads as a person called
    // "the last". I wrote this pattern with /i an hour after removing /i from
    // the pattern above it, and the test written for that first fix is what
    // caught it. A convenience flag that quietly disables an adjacent
    // assertion is worth spelling out longhand every time.
    /\b(?:[Rr]eview|[Rr]eviews|[Ff]eedback|[Cc]omment|[Cc]omments|[Tt]estimonial|[Tt]estimonials|[Rr]ating)\s+from\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]*\.?)?)\b/g,
    /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:wrote|said|left a review|complained|posted|reports)/g,
    /["“][^"”]{10,}["”]\s*[—-]\s*([A-Z][a-z]+)/g,
  ];
  const found: string[] = [];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const name = m[1];
      if (NOT_A_PERSON.has(name.split(/\s+/)[0].toLowerCase())) continue;
      found.push(name);
    }
  }
  return found;
}

/* ── The three actions (section 3a) ───────────────────────────────────────── */

export type ActionProblem =
  | { kind: 'wrong-count'; count: number }
  | { kind: 'ranks-not-1-2-3'; ranks: number[] }
  | { kind: 'no-area'; headline: string }
  | { kind: 'no-evidence'; headline: string }
  | { kind: 'unsourced-evidence'; headline: string }
  | { kind: 'rests-on-a-hole'; headline: string; claim: string }
  | { kind: 'prices-without-costs'; headline: string };

/**
 * `knownCosts` is whether the customer has told us what the work costs them to
 * deliver. Without it a price recommendation is the one output in this product
 * that could genuinely damage a business, so it is a deferral, never an action.
 */
export function validateActions(
  actions: Action[],
  options: { knownCosts: boolean } = { knownCosts: false },
): ActionProblem[] {
  const problems: ActionProblem[] = [];

  if (actions.length !== 3) problems.push({ kind: 'wrong-count', count: actions.length });

  const ranks = actions.map(a => a.rank).sort((x, y) => x - y);
  if (ranks.length !== 3 || ranks[0] !== 1 || ranks[1] !== 2 || ranks[2] !== 3) {
    problems.push({ kind: 'ranks-not-1-2-3', ranks });
  }

  for (const action of actions) {
    if (!AREAS.includes(action.area)) problems.push({ kind: 'no-area', headline: action.headline });

    if (!action.evidence || action.evidence.length === 0) {
      problems.push({ kind: 'no-evidence', headline: action.headline });
      continue;
    }

    // An action is only as good as the numbers under it.
    for (const claim of action.evidence) {
      if (claim.value === null) {
        // This is the Instagram case from 14 September: the biggest number in
        // the set, and our own side of it was never counted. A hypothesis built
        // on a field we did not read is not evidence-backed.
        problems.push({ kind: 'rests-on-a-hole', headline: action.headline, claim: claim.text });
      } else if (claim.source === null) {
        problems.push({ kind: 'unsourced-evidence', headline: action.headline });
      }
    }

    if (action.area === 'pricing' && !options.knownCosts && recommendsAPriceMove(action)) {
      problems.push({ kind: 'prices-without-costs', headline: action.headline });
    }
  }
  return problems;
}

/**
 * A price move can be written without the word "price": "raise your classic cut
 * to £20" is a price recommendation. So this looks for a verb of movement
 * followed by either a price word or a currency amount.
 *
 * "cut" and "drop" are deliberately NOT verbs here. In a barber's battlecard
 * "cut" is a haircut, and "classic cut £15" would fire on every row.
 */
const PRICE_MOVE =
  /\b(raise|raising|increase|increasing|put up|lower|lowering|reduce|reducing|charge more|charge less|match|move (?:it |them )?to|go to|bump)\b.{0,60}?(£|\$|€|\bprices?\b|\brates?\b|\bfees?\b)/i;

function recommendsAPriceMove(action: Action): boolean {
  return PRICE_MOVE.test(`${action.headline} ${action.why}`);
}

/**
 * Three actions cannot cover four areas and are not meant to. Two in one area is
 * allowed. This reports coverage so the interface can label it, and never fails.
 */
export function areasCovered(actions: Action[]) {
  const covered = new Set(actions.map(a => a.area));
  return { covered: [...covered], uncovered: AREAS.filter(a => !covered.has(a)) };
}

/* ── One pass over a whole battlecard ─────────────────────────────────────── */

/**
 * A COUNT WHOSE BOUNDARY IS NOT NAMED READS AS A TOTAL.
 *
 * Found on 15 September from two directions at once. A user panel attacked
 * "0 of 4,799" as a fraction whose halves measure different populations, and
 * the Content & Social Planner hit the identical shape on its own screen: it
 * told a barber who has posted for years that he had "2 posts", counting only
 * the ones that went through the tool.
 *
 * Our version was worse, because the same screen now says in its own words that
 * Google is not checked. "You have none" is then a claim about every platform
 * in the world, made by something that read two of them. The shop may have
 * forty reviews on Google. Everything else this tool does is built on never
 * stating more than it read, and this was the one place it did.
 *
 * The fix is never to drop the number. It is to say where the number stops.
 */
/**
 * Count-shaped absolutes only.
 *
 * `nobody` and `no one` were in this list until 15 September and fired on
 * "Nobody publishes what a shop is known for" and "Nobody chooses a barber on
 * LinkedIn" — rationale for why we cannot check something, which is the tool
 * being honest rather than overclaiming. Whether such a statement is supportable
 * is a real question and it belongs to findUnsourcedClaims, not here.
 *
 * KNOWN LIMIT: "Nobody has reviewed you" would now be missed. The sentence this
 * tool actually writes for that is "You have none", which still fires.
 */
const ABSOLUTE = /\b(?:none|no reviews|not on any)\b/i;
/**
 * Any phrase that tells the reader where we stopped looking.
 *
 * Widened on 15 September after running the guard over the whole rendered
 * screen. It was firing on sentences that were already properly bounded —
 * "none of the five use it", "none found on any platform we could reach" —
 * because an explicit denominator is a boundary and the list did not say so.
 * Over-firing is not a safe failure here: the guard it sits beside,
 * findNamedReviewers, had twelve false positives on the same screen, and a
 * guard nobody reads protects nothing.
 *
 * KNOWN LIMIT, written down rather than engineered around: a table cell reading
 * "None found." is bounded by its column header, which is not in the sentence
 * and cannot be seen from here. This guard is for the prose of an export. Feed
 * it flattened table markup and it will report cells it cannot judge.
 */
const BOUNDED = new RegExp([
  String.raw`we c(?:an|ould) (?:read|see|reach|get at)`,
  String.raw`anywhere we`,
  String.raw`on booksy|on fresha|counted on|that we read`,
  String.raw`we have not checked`,
  String.raw`on any site we|on the sites we|on any platform we`,
  // "We looked at Booksy, Fresha and their own site, and found no reviews" is
  // the exemplary bounded form — it names every source before it reports the
  // absence — and it was being flagged because the list did not know the
  // phrasing. Found by scanning the page script, where 51 user-facing strings
  // had never been read by any guard.
  String.raw`we looked at|we read|we checked`,
  // An explicit denominator IS the boundary: "none of the five", "4 of 9".
  String.raw`of (?:the )?(?:\d+|two|three|four|five|six|seven|eight|nine|ten)\b`,
].join('|'), 'i');

export function findUnboundedCounts(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => ABSOLUTE.test(s) && !BOUNDED.test(s));
}

export function validateBattlecard(card: Battlecard, exported: string, now: Date, knownCosts = false) {
  return {
    traffic: findTrafficClaims(exported),
    // findRankClaims existed, was tested five times and was documented in
    // search-visibility.ts as "the guard", but was wired into nothing. The unit
    // tests called it directly, so they passed while the guard never ran on a
    // real battlecard. That is what the wiring test in battlecard.test.ts is for.
    rankClaims: findRankClaims(exported),
    unboundedCounts: findUnboundedCounts(exported),
    feedback: findFeedbackPrompts(exported),
    unsourced: findUnsourcedClaims(card.competitors),
    impossibleDates: findImpossibleDates(card.competitors, now),
    stale: findStaleClaims(card.competitors, now),
    namedReviewers: findNamedReviewers(exported),
    unexplainedGaps: findUnexplainedGaps(card.competitors),
    buildDetail: findBuildDetail(exported),
    actions: validateActions(card.actions, { knownCosts }),
    tooManyCompetitors: card.competitors.length > 5,
  };
}
