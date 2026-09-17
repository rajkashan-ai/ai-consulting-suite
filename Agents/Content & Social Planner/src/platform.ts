/**
 * EVERY FACT ABOUT SOMEBODY ELSE'S PRODUCT, IN ONE PLACE, WITH A DATE ON IT.
 *
 * WHY THIS FILE EXISTS
 * These numbers do not vary by customer. A barber and a dog groomer get the
 * same character caps and the same pixel sizes, so fetching or re-deciding them
 * per run is waste. What they do vary by is the date: Meta moved Instagram
 * oEmbed to needing no token in June 2026, TikTok's caption cap has moved twice,
 * and Amazon publishes its ad sizes on a page it edits. So "a constant" is the
 * wrong word for them. They are **facts with an expiry**, and the expiry is what
 * has to be visible.
 *
 * Before this, they were spread across six places: `types.ts`, two copies of
 * FORMATS in two HTML files, regexes in `extract.js`, a paragraph of prose in
 * `render.js` that goes on a customer's screen, and comments in `oembed.ts` and
 * `tracking.ts`. Exactly one of the six carried a date. A fact on a customer
 * screen with no source and no date is the thing CLAUDE.md 1 forbids, and we
 * shipped one: Meta's account rules were shown under TikTok.
 *
 * THE RULE
 * Every entry carries `source` and `checked`. Where we have not actually
 * verified it, `checked` is null and `why` says so, rather than a date that
 * implies someone looked. `tests/platform.test.ts` fails when a dated fact goes
 * stale and lists the unverified ones so they cannot be forgotten quietly.
 *
 * WHAT DOES NOT BELONG HERE
 * Anything about a customer. Their prices, services, channels, phone number and
 * voice are read from their own site on every run, because those change without
 * telling us and a stale one loses them a customer.
 */

export interface Fact<T> {
  value: T;
  /** Where it came from. A URL, or how it was proved. */
  source: string;
  /** ISO date it was last confirmed, or null where nobody has confirmed it. */
  checked: string | null;
  /** Only where checked is null, or where the sources disagree. */
  why?: string;
}

const f = <T>(value: T, source: string, checked: string | null, why?: string): Fact<T> =>
  ({ value, source, checked, ...(why ? { why } : {}) });

/* ── How long a post may be, per channel ──────────────────────────────────── */

/**
 * `capChars` is a conservative floor under the platform's published limit, so a
 * post cannot be rejected even if the limit moved since we looked. The word
 * targets beside them in `types.ts` are our own editorial choice, not a fact
 * about anyone's product, so they are not in here.
 */
export const CAPS = {
  instagram: f(2000, 'Instagram published caption limit', null,
    'Set as a conservative floor when the tool was built. Nobody has confirmed the published number. build-notes.md flags it.'),
  facebook: f(2000, 'Facebook published caption limit', null,
    'Same as Instagram, and unconfirmed for the same reason.'),
  linkedin: f(2800, 'LinkedIn published post limit', null,
    'Unconfirmed. build-notes.md flags it.'),
  'google-business': f(1400, 'Google Business Profile published post limit', null,
    'Unconfirmed. build-notes.md flags it.'),
  tiktok: f(2000, 'Caption limit reported as 2,200 by some sources and 4,000 by others', '2026-09-15',
    'The sources disagree. The lower figure is used, less a floor: a cap set too low never produces an unpostable caption and a cap set too high does.'),
  youtube: f(4500, 'YouTube description limit, published as 5,000 characters', '2026-09-15'),
} as const;

/** Where the platform will not accept a post without a title of its own. */
export const TITLES = {
  youtube: f(90, 'YouTube title limit, published as 100 characters', '2026-09-15',
    'Ten under the published limit, so a title cannot be rejected if the limit moves.'),
} as const;

/* ── How an account is linked from a website ──────────────────────────────── */

/**
 * Detection reads these off the customer's own page. The shapes are the
 * platform's, not the customer's, which is why they live here: YouTube alone
 * has four live URL forms and all four are still in use on real sites.
 */
export const ACCOUNT_URLS = {
  instagram: f(/instagram\.com\/([A-Za-z0-9_.]{2,30})/i, 'Observed on live sites', '2026-09-15'),
  facebook: f(/facebook\.com\/([A-Za-z0-9_.\-]{2,60})/i, 'Observed on live sites', '2026-09-15'),
  linkedin: f(/linkedin\.com\/(?:company|in)\/([A-Za-z0-9_.\-]{2,60})/i, 'Observed on live sites', '2026-09-15'),
  tiktok: f(/tiktok\.com\/@([A-Za-z0-9_.]{2,30})/i, 'Read off gymshark.com, which links all five', '2026-09-15'),
  youtube: f(/youtube\.com\/(?:@|c\/|channel\/|user\/)([A-Za-z0-9_.\-]{2,60})/i,
    'Read off gymshark.com. Four forms, all still live', '2026-09-15'),
} as const;

/** Handles that are not handles: a page identifier the platform generated. */
export const NOT_A_HANDLE = f(/^(profile|pages|people)(\.php)?$/i,
  'facebook.com/profile.php?id=… is a real page with no readable name', '2026-09-15');

/* ── What connecting an account actually involves ─────────────────────────── */

/**
 * This is prose that appears on a customer's screen, so it is a claim and needs
 * a source like any other. It was one paragraph shown under every channel and
 * it described Meta's rules, which meant a TikTok user was told they needed a
 * Facebook page.
 */
export const CONNECT = {
  meta: f(
    'Connecting signs you in and asks you to approve four things. We can then see the posts already on your account and how each one did. <strong>We cannot post as you, read your messages, or see who follows you.</strong> It needs a business or creator account joined to a Facebook page, which is free to switch to. The sign-in lasts 60 days and then asks again.',
    'Meta permissions and long-lived token behaviour, written up in tracking.md', '2026-09-15'),
  none: f(
    'We cannot connect this one yet, so we cannot show you how a post did here. You can still paste the link and we will keep the count.',
    'Our own build state, not a claim about their product', '2026-09-15'),
} as const;

/** Reading a published caption back, with no token and no app review. */
export const OEMBED = f('https://graph.facebook.com/v21.0/instagram_oembed',
  'Called with no token on 15 September 2026: it answers "the parameter url is required", not "an access token is required"', '2026-09-15');

/* ── Image sizes ──────────────────────────────────────────────────────────── */

/**
 * The register the resizer is built from. `who` is what the size is for, and it
 * is on the screen because "Full screen 1080 x 1920" does not tell an owner it
 * is the Story, the Reel and TikTok.
 *
 * Amazon square is 1200 x 1200, which is the LinkedIn feed exactly, and Amazon
 * wide is two pixels off the link preview. Both keep Amazon's published numbers
 * rather than being folded in, because a size that is nearly right is what a
 * validator rejects and nobody can debug. The screen says when a selection
 * produces identical files.
 */
export interface ImageSize { id: string; name: string; w: number; h: number; who: string; on?: boolean }

const SOCIAL = 'Platform published feed and story sizes, listed in image-sizes.md';
const AMAZON = 'advertising.amazon.com/resources/ad-specs/ecommerce, the three responsive sizing images';

export const IMAGE_SIZES: Fact<ImageSize>[] = [
  f({ id: 'square', name: 'Square feed', w: 1080, h: 1080, who: 'Instagram and Facebook feed', on: true }, SOCIAL, '2026-09-15'),
  f({ id: 'vertical', name: 'Vertical feed', w: 1080, h: 1350, who: 'Instagram and Facebook feed, takes more of the screen', on: true }, SOCIAL, '2026-09-15'),
  f({ id: 'full', name: 'Full screen', w: 1080, h: 1920, who: 'Instagram Story and Reel, Facebook Story, TikTok, YouTube Shorts', on: true }, SOCIAL, '2026-09-15'),
  f({ id: 'link', name: 'Link preview', w: 1200, h: 630, who: 'Facebook and LinkedIn shared links' }, SOCIAL, '2026-09-15'),
  f({ id: 'lifeed', name: 'LinkedIn feed', w: 1200, h: 1200, who: 'LinkedIn image post' }, SOCIAL, '2026-09-15'),
  f({ id: 'amzsq', name: 'Amazon square', w: 1200, h: 1200, who: 'Amazon ad, the square placement' }, AMAZON, '2026-09-15'),
  f({ id: 'amztall', name: 'Amazon tall', w: 900, h: 1600, who: 'Amazon ad, the tall placement' }, AMAZON, '2026-09-15'),
  f({ id: 'amzwide', name: 'Amazon wide', w: 1200, h: 628, who: 'Amazon ad, the wide placement' }, AMAZON, '2026-09-15'),
];

/* ── The gate ─────────────────────────────────────────────────────────────── */

/** How long a checked fact is trusted before it has to be looked at again. */
export const STALE_AFTER_DAYS = 90;

/** Every fact in this file, flattened, so nothing can be added without a date. */
export function everyFact(): { name: string; fact: Fact<unknown> }[] {
  const out: { name: string; fact: Fact<unknown> }[] = [];
  const add = (prefix: string, group: Record<string, Fact<unknown>>) => {
    for (const [k, v] of Object.entries(group)) out.push({ name: `${prefix}.${k}`, fact: v });
  };
  add('caps', CAPS as unknown as Record<string, Fact<unknown>>);
  add('titles', TITLES as unknown as Record<string, Fact<unknown>>);
  add('accountUrls', ACCOUNT_URLS as unknown as Record<string, Fact<unknown>>);
  add('connect', CONNECT as unknown as Record<string, Fact<unknown>>);
  out.push({ name: 'notAHandle', fact: NOT_A_HANDLE });
  out.push({ name: 'oembed', fact: OEMBED });
  IMAGE_SIZES.forEach((s) => out.push({ name: `imageSizes.${s.value.id}`, fact: s }));
  return out;
}

/** The ones nobody has confirmed. Named, so they cannot be forgotten quietly. */
export function unverified(): string[] {
  return everyFact().filter((x) => x.fact.checked === null).map((x) => x.name);
}

/** Dated facts older than `days`, worst first. */
export function stale(days = STALE_AFTER_DAYS, now = new Date()): { name: string; age: number }[] {
  return everyFact()
    .filter((x) => x.fact.checked !== null)
    .map((x) => ({ name: x.name, age: Math.floor((+now - +new Date(x.fact.checked!)) / 86400000) }))
    .filter((x) => x.age > days)
    .sort((a, b) => b.age - a.age);
}
