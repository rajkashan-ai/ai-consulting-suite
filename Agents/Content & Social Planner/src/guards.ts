/**
 * The rules that must never break, made checkable.
 *
 * CLAUDE.md section 6 lists what this tool must never do, and section 4 holds
 * the one rule that governs it. A rule written in prose is a hope. Each one
 * below is the same rule as a function that returns what it found, so a test
 * can fail on it.
 *
 * Every function returns a list. Empty means clean.
 *
 * `findFeedbackPrompts` and `findBuildDetail` are the same two rules the
 * Competitor Tracker enforces, deliberately copied rather than imported: the
 * two tools are separate packages today. **When a third tool needs them they
 * move to `Agents/_shared/`**, or three copies start drifting.
 */
import type { Channel, KnownFacts, Plan, Post } from './types.ts';
import { CHANNEL, isWritten } from './types.ts';

/* ── Never put a claim in their mouth that they have not given us (§4) ────── */

export type ClaimKind =
  | 'years' | 'count' | 'percentage' | 'saving' | 'price'
  | 'credential' | 'award' | 'named-client' | 'review-quote';

export interface InventedClaim { kind: ClaimKind; text: string }

/**
 * Everything is normalised before a pattern touches it.
 *
 * "Gas-Safe" and "Gas Safe" are the same claim. So are "award-winning" with an
 * ordinary hyphen and with U+2011, and "Gas\u200bSafe" with a zero-width space
 * in the middle. A word list that only knows one spelling is a word list an
 * owner gets past by accident, never mind on purpose.
 *
 * The Cyrillic fold covers the seven letters that are drawn identically to
 * Latin ones. It is not a full confusables map: text genuinely written in
 * Russian or Greek still gets none of this, which is the same gap
 * `tests/README.md` records for other languages.
 */
const CONFUSABLE: Record<string, string> = {
  '\u0430': 'a', '\u0435': 'e', '\u043e': 'o', '\u0440': 'p', '\u0441': 'c', '\u0443': 'y', '\u0445': 'x',
  '\u0410': 'A', '\u0415': 'E', '\u041e': 'O', '\u0420': 'P', '\u0421': 'C', '\u0423': 'Y', '\u0425': 'X',
};

/** For word-list lookups only. Never shown to anyone: it mangles real text. */
function flatten(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\u200b-\u200f\u2060\ufeff\u00ad]/g, '')          // zero-width and soft hyphens
    .replace(/[\u0400-\u04ff]/g, ch => CONFUSABLE[ch] ?? ch)
    .replace(/[\u2010-\u2015\u2212]/g, '-')                     // every dash that is not a hyphen
    .toLowerCase()
    .replace(/[^a-z0-9£$€%+&]+/g, ' ')                          // hyphen, comma and full stop all become a space
    .trim();
}

/** Only a sentence that speaks as the business can put a claim in their mouth. */
const SPEAKS_AS_US = /\b(?:we|we've|we're|our|ours|us|i|i've|i'm|my|mine)\b/i;

const YEARS = /\b(\d{1,3})\s*(?:\+|plus)?\s*years?\b/gi;
/** "twenty years" is the same claim as "20 years", and it is how people write it. */
const WORDS_TO_NUMBER: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, 'a hundred': 100, hundreds: 100,
};
const WORD_NUMBER = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|a hundred|hundreds)[- ]?(?:odd |plus )?years?\b/gi;
/**
 * "22 years" is a claim about them. "a boiler lasts 12 years" is about boilers.
 *
 * Nothing in a regular expression knows which, so three things stand in for it:
 * the sentence speaks as the business, it uses an experience word, or it is
 * already listing other claims about them. "15 years, 3,000 customers and a
 * five-star rating" says "we" nowhere and names no experience word, and it is
 * plainly a CV, which is what the third test is for.
 */
const EXPERIENCE = /\b(?:experience|trading|in business|doing this|going|serving|established|since|been)\b/i;
const COUNT = /\b(?:over|more than|nearly|almost|upwards of)?\s*(\d[\d,]{0,9})\s*\+?\s*(?:happy|satisfied|local)?\s*(?:customers|clients|jobs|projects|installs|installations|fittings|cuts|heads|reviews|ratings|followers|subscribers|members|people|families|businesses|complaints|enquiries|bookings|appointments|orders|sales|referrals|years running)\b/gi;
const PERCENT = /\b\d+(?:\.\d+)?\s*(?:%|per ?cent)/gi;
/** The currency is as often a word as a symbol, and "200 pounds" reads friendlier. */
const SAVING = /\b(?:save|saves|saved|saving|savings? of|knocked|cut(?:ting)? (?:it|that|the bill))\b[^.!?]{0,40}?(?:[£$€]\s?\d[\d,.]*|\d[\d,.]*\s*(?:pounds|quid|dollars|euros|grand|k\b))/gi;
const MONEY = /[£$€]\s?\d[\d,]*(?:\.\d{2})?/g;

const CREDENTIAL_WORDS = [
  'accredited', 'accreditation', 'certified', 'certification', 'qualified',
  'registered with', 'member of', 'approved installer', 'approved contractor',
  'gas safe', 'niceic', 'napit', 'oftec', 'checkatrade approved', 'trustmark',
  'city & guilds', 'city and guilds', 'nvq', 'iso 9001', 'iso 27001', 'cipd',
  'fully insured', 'dbs checked', 'crb checked', 'chartered', 'licensed',
  'time served', 'apprentice trained', 'vetted', 'police checked',
];
const AWARD_WORDS = [
  'award', 'award-winning', 'award winning', 'winner', 'runner-up', 'shortlisted',
  /* 'best in' is gone: "he is the best in the chair on a busy Saturday" is
     colour, not a claim of an award. "voted best" carries the real thing. */
  'voted best', 'number one', 'five star', '5 star',
  'top rated', 'highly rated', 'rated excellent', 'finalist', 'nominated',
];

/** Company suffixes are the one high-precision way to spot a named client. */
/**
 * `Corp` was not on this list, so the one sentence CLAUDE.md §4 names as the
 * thing that must never be written was the one sentence that got through.
 * Found on 14 September by an independent pass. Add to it rather than trust it.
 */
const CLIENT_BY_SUFFIX = /\b([A-Z][\w&'’-]*(?:\s+[A-Z][\w&'’-]*){0,3}\s+(?:Ltd|Limited|LLP|PLC|Group|Holdings|Inc|Corp|Corporation|Co|LLC|GmbH|BV|NV|SA|AG|AB|Oy|Pty|Associates|Partners|Partnership|Trust|Foundation|Institute|Academy|& Sons|& Daughters|& Co))\b/g;
const CLIENT_BY_LEAD_IN = /\b(?:our client|a client of ours|we worked with|worked with|we did (?:it )?for|carried out for)\s+([A-Z][\w&'’-]*(?:\s+[A-Z][\w&'’-]*){0,3})/g;

const REVIEW_QUOTE = /["“][^"”]{15,}["”]/g;
const REVIEW_LEAD_IN = /\b(?:one|a|another) (?:customer|client|reviewer) (?:said|told us|wrote|left us|put it)\b/gi;

/**
 * Everything in a post that claims something about the business, and is not in
 * what the business gave us.
 *
 * The draft's own example was "How we solved a complex commercial heating
 * failure for Acme Corp". If they have not told us about Acme Corp, that post
 * does not get written, because the owner posts it under their own name.
 */
export function findInventedClaims(text: string, known: KnownFacts): InventedClaim[] {
  const found: InventedClaim[] = [];
  const add = (kind: ClaimKind, t: string) => { if (!found.some(f => f.kind === kind && f.text === t)) found.push({ kind, text: t }); };
  const knownPrices = Object.values(known.prices).map(normaliseMoney);
  const lower = text.toLowerCase();
  const flat = flatten(text);
  const tight = flat.replace(/ /g, '');
  /** There as written, after normalising, or with the spaces taken out. */
  const says = (phrase: string) => {
    const nf = flatten(phrase);
    if (nf === '') return lower.includes(phrase);
    return lower.includes(phrase) || flat.includes(nf) || tight.includes(nf.replace(/ /g, ''));
  };

  for (const re of [YEARS, WORD_NUMBER]) {
    for (const m of text.matchAll(re)) {
      // "eight weeks between cuts" is their trade. "22 years" is their CV.
      const sentence = sentenceAround(text, m.index!);
      if (!SPEAKS_AS_US.test(sentence) && !EXPERIENCE.test(sentence) && !readsAsACv(sentence)) continue;
      const n = WORDS_TO_NUMBER[m[1].toLowerCase()] ?? Number(m[1]);
      if (known.yearsTrading !== undefined && n === known.yearsTrading) continue;
      add('years', m[0].trim());
    }
  }

  /* Counted customers and percentages are never scoped to a first-person
     sentence. "Fifteen years, 3,000 customers and a five-star rating" says
     "we" nowhere and is entirely a claim about them, and a percentage anywhere
     in a post is a number we have no source for. */
  for (const m of text.matchAll(COUNT)) {
    const n = Number(m[1].replace(/,/g, ''));
    if (Object.values(known.counts).includes(n)) continue;
    add('count', m[0].trim());
  }

  for (const m of text.matchAll(PERCENT)) add('percentage', m[0]);

  for (const m of text.matchAll(SAVING)) add('saving', m[0].trim());

  /* A price we never read is as much an invention as a client we never had, and
     it is the one an owner gets held to at the counter. */
  for (const m of text.matchAll(MONEY)) {
    if (/saved|saving/i.test(sentenceAround(text, m.index!))) continue;   // already caught as a saving
    if (knownPrices.includes(normaliseMoney(m[0]))) continue;
    add('price', m[0]);
  }

  for (const word of CREDENTIAL_WORDS) {
    if (!says(word)) continue;
    if (known.accreditations.some(a => flatten(a).includes(flatten(word)))) continue;
    add('credential', word);
  }
  /* "Best in Shropshire three years running" went with 'best in', which had to
     go because of "best in the chair". The award is the place after it, so the
     pattern says so and keeps the capital. */
  /* Both cases spelled longhand, NOT the /i flag. With /i the `[A-Z][a-z]+`
     that requires a place name matches any word at all, and the pattern
     silently stops testing the thing it was written to test. That flag is the
     Competitor Tracker's headline finding on its own GDPR guard, made twice in
     one session, and it is the one to reach for and not take. */
  for (const m of text.matchAll(/\b[Bb]est in (?:town|the (?:area|county|region|city)|[A-Z][a-z]+)/g)) {
    if (!known.awards.some(a => flatten(a).includes('best in'))) add('award', m[0]);
  }
  for (const word of AWARD_WORDS) {
    if (!says(word)) continue;
    if (known.awards.some(a => flatten(a).includes(flatten(word)))) continue;
    add('award', word);
  }

  for (const re of [CLIENT_BY_SUFFIX, CLIENT_BY_LEAD_IN]) {
    for (const m of text.matchAll(re)) {
      const name = m[1].trim();
      if (known.namedClients.some(c => c.toLowerCase() === name.toLowerCase())) continue;
      add('named-client', name);
    }
  }

  for (const m of text.matchAll(REVIEW_QUOTE)) {
    const quote = m[0].slice(1, -1);
    if (known.reviewThemes.some(r => r.includes(quote) || quote.includes(r))) continue;
    add('review-quote', m[0]);
  }
  for (const m of text.matchAll(REVIEW_LEAD_IN)) add('review-quote', m[0]);

  return found;
}

/** A sentence already listing counts, credentials or awards is a CV, not a fact. */
function readsAsACv(sentence: string): boolean {
  const lower = sentence.toLowerCase();
  return new RegExp(COUNT.source, 'i').test(sentence)
    || CREDENTIAL_WORDS.some(w => lower.includes(w))
    || AWARD_WORDS.some(w => lower.includes(w));
}

function normaliseMoney(s: string): string { return s.replace(/\s|,/g, '').replace(/\.00$/, ''); }

function sentenceAround(text: string, index: number): string {
  const start = Math.max(0, Math.max(text.lastIndexOf('.', index), text.lastIndexOf('\n', index), text.lastIndexOf('!', index), text.lastIndexOf('?', index)) + 1);
  const rest = text.slice(index).search(/[.!?\n]/);
  return text.slice(start, rest === -1 ? text.length : index + rest);
}

/* ── Never assume they are local (§6.3) ───────────────────────────────────── */

const LOCAL_WORDS = [
  'local', 'locally', 'in the area', 'in your area', 'your area', 'round here',
  'nearby', 'near you', 'close to you', 'on your doorstep', 'your neighbourhood',
  'in town', 'in your town', 'just down the road', 'up the road', 'on your street',
];

/** Wrong for a studio competing nationally, and it reads as a stock phrase anyway. */
export function findLocalAssumptions(text: string, known: KnownFacts): string[] {
  if (known.servesAnArea) return [];
  const lower = text.toLowerCase();
  const flat = flatten(text);
  return LOCAL_WORDS.filter(w => lower.includes(w) || flat.includes(flatten(w)));
}

/* ── Never write a post that needs a photo they cannot take (§6.4) ────────── */

const IMPOSSIBLE_SHOT = [
  'drone', 'aerial', 'studio', 'professional photographer', 'photographer',
  'videographer', 'film crew', 'stock photo', 'stock image', 'graphic designer',
  'model', 'actor', 'time-lapse', 'timelapse', 'lighting rig', 'green screen',
  'hire a', 'commission a', 'illustrator', 'ai-generated', 'ai generated',
];

export type ShotProblem =
  | { kind: 'missing' } | { kind: 'not-one-line' } | { kind: 'needs'; what: string };

/** It has to be something possible on their phone this week. */
export function checkShot(post: Post): ShotProblem[] {
  const shot = post.shot?.trim() ?? '';
  if (!shot) return [{ kind: 'missing' }];
  const problems: ShotProblem[] = [];
  if (shot.includes('\n') || shot.length > 200) problems.push({ kind: 'not-one-line' });
  const lower = shot.toLowerCase();
  for (const w of IMPOSSIBLE_SHOT) if (lower.includes(w)) problems.push({ kind: 'needs', what: w });
  return problems;
}

/* ── Written for its channel, not written once and pasted three times (§3) ── */

export type LengthProblem =
  | { kind: 'too-short'; words: number; want: number }
  | { kind: 'too-long'; words: number; want: number }
  | { kind: 'over-cap'; chars: number; cap: number };

export function checkLength(post: Post): LengthProblem[] {
  const spec = CHANNEL[post.channel];
  const words = countWords(post.words ?? '');
  const problems: LengthProblem[] = [];
  if (words < spec.words[0]) problems.push({ kind: 'too-short', words, want: spec.words[0] });
  if (words > spec.words[1]) problems.push({ kind: 'too-long', words, want: spec.words[1] });
  /* `post.words` is optional on an unwritten slot, so the guard reads it twice
     through `?? ''` and then once without. It was invisible until the web app
     imported this file and typechecked it. Read it once. */
  const chars = (post.words ?? '').length;
  if (chars > spec.capChars) problems.push({ kind: 'over-cap', chars, cap: spec.capChars });
  return problems;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Two posts with the same opening line is how a month starts reading as one post. */
export function findRepeatedOpenings(posts: Post[]): string[] {
  const seen = new Map<string, number>();
  for (const p of posts) {
    const opening = (p.words ?? '').trim().split(/[.!?\n]/)[0].toLowerCase().trim();
    if (!opening) continue;
    seen.set(opening, (seen.get(opening) ?? 0) + 1);
  }
  return [...seen].filter(([, n]) => n > 1).map(([o]) => o);
}

/* ── Gaps: where a post needs something only they can supply (§4) ─────────── */

/**
 * Zero characters or more, not one or more.
 *
 * With `+` the completely empty "[]" was not a gap at all: not listed, not
 * flagged, and absent from "What to fill in". "[ ]" and "[TBC]" were both
 * caught. The one blank that got through was the blankest one.
 */
const GAP = /\[([^\]]*)\]/g;

export interface Gap { date: string; asks: string }

/** Every gap in the plan, in order, for the "What to fill in" section. */
export function listGaps(plan: Plan): Gap[] {
  const gaps: Gap[] = [];
  for (const post of plan.posts) {
    for (const m of (post.words ?? '').matchAll(GAP)) gaps.push({ date: post.date, asks: m[1].trim() });
  }
  return gaps;
}

/**
 * A gap has to tell them what to put in it.
 *
 * "[  ]" or "[TBC]" is a blank with brackets round it, and a blank is what this
 * tool exists to remove. "name the job you did last month" is an instruction.
 */
export function findEmptyGaps(plan: Plan): Gap[] {
  return listGaps(plan).filter(g => countWords(g.asks) < 3 || /^(tbc|todo|xxx|\.\.\.|insert|placeholder)$/i.test(g.asks));
}

/**
 * How many weeks of written posts a document covers.
 *
 * It decides whether a separate list of blanks is worth anything. On one week,
 * two posts, both blanks visible in amber and counted in a tile above them, a
 * third listing is the screen saying the same thing three times. Over a month
 * it is the only thing stopping a blank being scrolled past.
 */
export function weeksCovered(plan: Plan): number {
  return new Set(plan.posts.filter(isWritten).map(p => p.week ?? 1)).size;
}

/**
 * Nothing goes out with a blank in it, so every gap is listed again at the end.
 * Required only on a document covering more than one week: see `weeksCovered`.
 */
export function findUnlistedGaps(plan: Plan, exported: string): Gap[] {
  const at = exported.lastIndexOf('## What to fill in');
  // No heading at all means nothing is listed. Said here rather than left to
  // slice(-1), which reached the same answer by accident.
  if (at === -1) return listGaps(plan);
  const end = exported.slice(at);
  return listGaps(plan).filter(g => !end.includes(g.asks));
}

/* ── Never mark a post overdue, late or missed (§6.7) ─────────────────────── */

/**
 * A day is a recommendation, not a deadline.
 *
 * Raj, 15 September: the dates are recommendations too, they can post the day
 * after if they need to. So a plan that nags is the failure. The screen says
 * what is next, never what is due, and a slipped day is not an event.
 */
/* 'late' on its own is out, and a word boundary was not enough to save it:
   "we are open late on Thursday" is opening hours. That is the same shape as a
   'session' meaning an appointment in a barber's shop rather than a visit in
   analytics. What makes it nagging is late AGAINST something, so the phrases
   say so. */
const OVERDUE_WORDS = [
  /* "three days late" and "a week late" went with bare 'late'. A duration in
     front of it is exactly what makes it a deadline rather than opening hours. */
  'overdue', 'is late', 'was late', 'running late', 'too late',
  'day late', 'days late', 'week late', 'weeks late', 'month late',
  'missed', 'behind schedule', 'falling behind', 'you should have',
  'you have not posted', "you haven't posted", 'catch up', 'catching up', 'due today',
  'was due', 'deadline', 'still outstanding', 'skipped',
];

export function findOverdueLanguage(customerFacing: string): string[] {
  const found: string[] = [];
  for (const word of OVERDUE_WORDS) {
    /* Whole words only. `includes` matched "late" inside "every later week",
       which is the screen explaining that a change applies from next week. */
    const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    for (const m of customerFacing.matchAll(re)) {
      /* And a denial is the sentence that prevents the problem, not an
         instance of it: "Nothing here is overdue" is the line we want on the
         screen. Same fix as findOverclaimedAccess, which had it a day earlier
         and was never carried across to here. */
      if (DENIED.test(clauseBefore(customerFacing, m.index!))) continue;
      found.push(word);
      break;
    }
  }
  return found;
}

/** A sentence that says a thing is not so. */
const DENIED = /\b(?:not|never|nothing|no|cannot|can't|do not|don't|will not|won't|neither)\b/i;

/**
 * What comes before the match, in its own clause.
 *
 * Scoping the denial to the whole sentence was too generous: "You have not
 * posted since June, time to catch up" is nagging, and the negation there is
 * part of the accusation rather than a denial of it. Two things fix it. The
 * clause stops at the nearest comma, so a later clause is judged on its own.
 * And the matched phrase itself is excluded, so "you have not posted" cannot
 * use its own "not" to excuse itself.
 *
 * "Nothing here is overdue" still passes: the negation sits before the word, in
 * the same clause, and is not part of it.
 */
function clauseBefore(text: string, index: number): string {
  const start = Math.max(0, ...['.', ',', ';', ':', '!', '?', '\n'].map(c => text.lastIndexOf(c, index - 1) + 1));
  return text.slice(start, index);
}

/**
 * A post tied to something in the world stops making sense once it has gone.
 *
 * This is what replaced "never date a post in the past". The date moving is
 * fine; half term being over is not. Only a post that named an occasion can
 * fail this, which is why the occasion is data rather than something a regular
 * expression has to find in the prose.
 */
export function findPastOccasions(plan: Plan, now: Date): { date: string; occasion: string }[] {
  const bad: { date: string; occasion: string }[] = [];
  for (const post of plan.posts) {
    if (!post.occasion) continue;
    const ends = Date.parse(post.occasion.endsOn);
    if (Number.isNaN(ends) || ends < now.getTime()) bad.push({ date: post.date, occasion: post.occasion.name });
  }
  return bad;
}

/* ── Never put a feedback prompt inside the plan (§6.2) ───────────────────── */

const FEEDBACK_PHRASES = [
  'how did this output land', 'was this any use', 'was this helpful',
  'was this useful', 'how did we do', 'rate this', 'thumbs up',
  /* Bare 'feedback' is gone. "Your feedback is what tells us what to do more
     of" is a barber asking his own customers, which is a perfectly good post,
     and this rule is about OUR furniture reaching their document. The named
     phrases below carry the rule without the collision. */
  /* Narrow the context, not the keyword. Dropping bare 'feedback' to save
     "your feedback is what tells us what to do more of" also dropped "Leave
     feedback below", which is our own furniture. It is the verb that makes it a
     prompt, not the noun. */
  'feedback on this', 'your feedback helps', 'give us feedback',
  'leave feedback', 'send feedback', 'share feedback', 'feedback below',
  'let us know what you think', 'tell us what you think', 'what did you think',
  'too salesy', 'not how i talk', '\u{1f44d}', '\u{1f44e}',
];

/** The plan gets exported and pasted. Feedback lives in the app around it. */
export function findFeedbackPrompts(exported: string): string[] {
  const lower = exported.toLowerCase();
  const flat = flatten(exported);
  // The emoji survive `lower` and are stripped by `flatten`, so both are needed.
  return FEEDBACK_PHRASES.filter(p => {
    const nf = flatten(p);
    return lower.includes(p) || (nf !== '' && flat.includes(nf));
  });
}

/* ── No build detail on a customer's screen (base-prompt.md) ──────────────── */

const BUILD_WORDS = [
  'api', 'endpoint', 'token', 'oauth', 'rate limit', 'robots.txt', 'scrape',
  'prompt', 'model', 'database', 'migration', 'schema', 'deploy', 'repo',
  'multimodal', 'pipeline', 'regenerate', 'cascade', 'voice note',
  'we have not applied', 'is being started', 'we are working on',
  /* Our own vocabulary. §3a says the angle is never explained to the customer,
     and it was the one term the list did not hold. The bare words "angle" and
     "purpose" are deliberately NOT here: "straight on, no angle" is a real shot
     instruction in a barber's plan. The slugs are what a leak actually looks
     like. Same lesson as the Tracker's "cut is a noun in a barber's shop". */
  'cadence', 'most-days', 'twice-weekly', 'purpose:', 'angle:',
  'how-it-works', 'what-it-costs', 'the-mistake', 'before-after', 'asked-a-lot',
  'this-week', 'not-for-you', 'the-timing', 'ask-them', 'the-ask',
];

export function findBuildDetail(customerFacing: string): string[] {
  const lower = customerFacing.toLowerCase();
  return BUILD_WORDS.filter(w => new RegExp(wordish(w)).test(lower));
}

/**
 * A word boundary only exists next to a word character.
 *
 * `\bpurpose:\b` matches nothing at all, ever, because the character after the
 * colon is never a word character. The same defect as `%\b` in the percentage
 * rule, found in a second place by the same pass. So the boundary is added only
 * at an edge that can carry one.
 */
function wordish(phrase: string): string {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const open = /^\w/.test(phrase) ? '\\b' : '';
  const close = /\w$/.test(phrase) ? '\\b' : '';
  return `${open}${escaped}${close}`;
}

/* ── One pass over a whole plan ───────────────────────────────────────────── */

export function validatePlan(plan: Plan, known: KnownFacts, exported: string, now = new Date()) {
  /* Only written posts carry words. Since 15 September the words arrive a week
     at a time, so running the claim and length guards over an unwritten slot
     reports every one of them as too short: a bug about our own schedule
     dressed up as a bug in the writing. */
  const perPost = plan.posts.filter(isWritten).map(post => ({
    date: post.date,
    invented: findInventedClaims(`${post.words}\n${post.shot}\n${post.why}`, known),
    local: findLocalAssumptions(post.words!, known),
    shot: checkShot(post),
    length: checkLength(post),
  }));
  return {
    perPost,
    repeatedOpenings: findRepeatedOpenings(plan.posts.filter(isWritten)),
    emptyGaps: findEmptyGaps(plan),
    // On a single week the amber chip marks it and the tile counts it, which is
    // twice. A third listing is what got cut.
    unlistedGaps: weeksCovered(plan) > 1 ? findUnlistedGaps(plan, exported) : [],
    feedback: findFeedbackPrompts(exported),
    buildDetail: findBuildDetail(exported),
    // Wired on 15 September. Both were written, tested and called by nothing,
    // which a unit test cannot see: it proves a guard works, never that it runs.
    overdue: findOverdueLanguage(exported),
    pastOccasions: findPastOccasions(plan, now),
  };
}

export type { Channel };
