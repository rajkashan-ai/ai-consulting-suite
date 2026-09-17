/**
 * Reading the reviews, not counting them.
 *
 * WHY THIS EXISTS
 * The tool had 4,799 reviews across five competitors and read none of them. It
 * read the count. Competitive-intelligence practice is blunt about the cost:
 * reviews are where you see what customers love, what frustrates them, and what
 * makes them switch, and none of that is in a number.
 *
 * It also fixed the weakest thing about our output. Every action came from a
 * published fact: who is on Booksy, who has reviews. Not one came from why
 * anybody actually chose. That question is the whole of win/loss analysis, and
 * for a business with no sales team the reviews are the only place it is
 * answerable for free.
 *
 * WHAT THE FIRST REAL READ FOUND
 * Nine reviews across three Shrewsbury barbers, 14 September 2026. Four of the
 * nine name an individual barber. For this trade the loyalty is to a person and
 * not to a shop, which is a strategic fact no review count could ever show.
 *
 * THE RULE THAT GOVERNS ALL OF IT
 * A theme may say that customers name their barber, and how often. It may never
 * reproduce which names. UK GDPR: "it was public" is not a lawful basis, and the
 * battlecard is a document the customer exports and forwards.
 */

export interface Review {
  /** ISO date. */
  on: string;
  /** 1 to 5, or null where the platform showed none. */
  rating: number | null;
  body: string;
}

/* ── Getting them off the page ────────────────────────────────────────────── */

/**
 * Booksy publishes schema.org Review objects with a body, a rating and a date.
 * We already fetch these pages for prices, and robots.txt allows a venue page.
 */
export function parseReviews(html: string): Review[] {
  const out: Review[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(/"@type":"Review"[\s\S]{0,1600}?(?=,\{"@type"|\])/g)) {
    const chunk = m[0];
    const body = /"reviewBody"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(chunk);
    const on = /"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})/.exec(chunk);
    const rating = /"ratingValue"\s*:\s*"?([\d.]+)"?/.exec(chunk);
    if (!body || !on) continue;

    const text = decode(body[1]).trim();
    if (!text) continue;                     // a star with no words tells us nothing
    const key = `${on[1]}|${text}`;
    if (seen.has(key)) continue;             // the same review rendered twice
    seen.add(key);

    out.push({ on: on[1], rating: rating ? Number(rating[1]) : null, body: text });
  }
  return out;
}

/**
 * Review text arrives double-encoded: a curly apostrophe comes through as
 * "Iâ€™ve". Left alone it reaches the screen as mojibake in a quote we are
 * presenting as somebody's exact words.
 */
function decode(raw: string): string {
  let s = raw;
  try {
    s = JSON.parse(`"${raw.replace(/"/g, '\\"')}"`);
  } catch { /* keep the raw text rather than lose the review */ }
  try {
    const bytes = Uint8Array.from([...s].map(c => c.charCodeAt(0) & 0xff));
    const fixed = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (!/[�]/.test(fixed)) s = fixed;
  } catch { /* it was not mis-encoded */ }
  return s.replace(/\s+/g, ' ');
}

/* ── Who gets named (UK GDPR) ─────────────────────────────────────────────── */

/** Words that begin a sentence and are not somebody's name. */
const NOT_A_NAME = new Set([
  'The', 'A', 'An', 'I', 'My', 'We', 'He', 'She', 'They', 'It', 'This', 'That',
  'Very', 'Great', 'Good', 'Best', 'Top', 'Been', 'Always', 'Friendly', 'Highly',
  'Excellent', 'Lovely', 'Thank', 'Thanks', 'Would', 'Will', 'Have', 'Had',
  'Amazing', 'Brilliant', 'Fantastic', 'Perfect', 'Nice', 'Really', 'Super',
]);

/**
 * Does this review name a person?
 *
 * Deliberately crude and deliberately over-inclusive: a false positive costs a
 * redaction, a false negative puts a real name into a document the customer
 * forwards to their own clients.
 */
export function namesAPerson(body: string): boolean {
  return findNames(body).length > 0;
}

export function findNames(body: string): string[] {
  const names: string[] = [];
  // A capitalised word that is not the first word of a sentence, or one that is
  // followed by a verb people use about a person.
  for (const m of body.matchAll(/(?:^|[^.!?]\s)([A-Z][a-z]{2,})\b/g)) {
    const w = m[1];
    if (NOT_A_NAME.has(w)) continue;
    names.push(w);
  }
  for (const m of body.matchAll(/\b([A-Z][a-z]{2,})\s+(?:did|does|has|cut|cuts|is|was|always)\b/g)) {
    if (!NOT_A_NAME.has(m[1]) && !names.includes(m[1])) names.push(m[1]);
  }
  return [...new Set(names)];
}

/** A quotable version, with every name taken out. */
export function redact(body: string): string {
  let out = body;
  for (const n of findNames(body)) {
    out = out.replace(new RegExp(`\\b${n}\\b`, 'g'), '[a barber]');
  }
  return out;
}

/* ── Themes ───────────────────────────────────────────────────────────────── */

export interface Theme {
  /** What customers keep saying, in our words. */
  says: string;
  /** How many of the reviews we read carry it. */
  count: number;
  /** Out of how many. A count with no denominator is not a finding. */
  outOf: number;
  /** Oldest and newest review carrying it. */
  from: string;
  to: string;
  /** Redacted quotes, at most two. */
  quotes: string[];
}

/** Below this, a repeated phrase is a coincidence rather than a theme. */
export const MIN_FOR_A_THEME = 2;

export type ThemeProblem =
  | { kind: 'too-few'; says: string; count: number }
  | { kind: 'no-denominator'; says: string }
  | { kind: 'names-a-person'; says: string; quote: string }
  | { kind: 'undated'; says: string };

/**
 * A theme is a claim about a named business in a document that gets forwarded.
 * It has to survive being read by that business.
 */
export function validateTheme(t: Theme): ThemeProblem[] {
  const p: ThemeProblem[] = [];
  if (t.count < MIN_FOR_A_THEME) p.push({ kind: 'too-few', says: t.says, count: t.count });
  if (!t.outOf || t.outOf < t.count) p.push({ kind: 'no-denominator', says: t.says });
  if (!t.from || !t.to) p.push({ kind: 'undated', says: t.says });
  for (const q of t.quotes) {
    if (namesAPerson(q)) p.push({ kind: 'names-a-person', says: t.says, quote: q });
  }
  return p;
}

/* ── The two signals that answer "why did they choose" ────────────────────── */

/**
 * Reviews that name an individual rather than the business.
 *
 * Where this is high, the competitor's advantage is a person, and a person can
 * be hired, can leave, and can be competed with. Where it is low, the advantage
 * is the shop. That distinction changes what an owner should do about it, and
 * a review count cannot show it.
 */
export function loyaltyIsToAPerson(reviews: Review[]): { named: number; outOf: number } {
  return { named: reviews.filter(r => namesAPerson(r.body)).length, outOf: reviews.length };
}

/**
 * Reviews that say the customer keeps coming back, or came from somewhere else.
 *
 * These are the closest thing a business with no sales team has to win/loss
 * data: the only public record of somebody choosing.
 */
const RETURNING = /\b(?:been (?:coming|going|getting)|for (?:years|months)|as usual|every time|again|regular|always come|keep coming)\b/i;
const SWITCHED = /\b(?:moved (?:from|over)|used to (?:go|use)|switched|changed from|left .{0,20}(?:barber|salon|shop)|first time)\b/i;

export function choiceSignals(reviews: Review[]) {
  return {
    returning: reviews.filter(r => RETURNING.test(r.body)).length,
    switched: reviews.filter(r => SWITCHED.test(r.body)).length,
    outOf: reviews.length,
  };
}
