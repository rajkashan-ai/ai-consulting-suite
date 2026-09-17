/**
 * The kinds of business this tool meets, and how much of them is public.
 *
 * REAL data is from the Shrewsbury barber run on 14 September 2026, read by hand
 * from booksy.com, fresha.com and the businesses' own sites. It is marked REAL.
 * Everything else is SYNTHETIC, uses example.com, and exists to make an edge case
 * happen. Nothing synthetic is ever presented as a fact about a real business.
 */
import type { Claim, Competitor } from '../../src/types.ts';

const on = (url: string, day = '2026-09-14') => ({ url, fetchedOn: day });

export const said = (text: string, value: string | number, url: string, day?: string): Claim =>
  ({ text, value, source: on(url, day) });

/** We looked and could not see it. The source is null because there is nothing to cite. */
export const couldNotSee = (text: string): Claim => ({ text, value: null, source: null });

const BOOKSY = 'https://booksy.com/en-gb/';

/* ── REAL: everything public. Own site, booking platform, socials, reviews ── */
export const RICH: Competitor = {
  name: 'HINCES', addedByCustomer: false,
  claims: {
    pricing: [said('Classic haircut £35', 35, BOOKSY + 'hinces')],
    reviews: [said('2,461 reviews at 5.0', 2461, BOOKSY + 'hinces')],
    channels: [said('2,537 Instagram followers', 2537, 'https://instagram.com/hincesuk')],
    blindspots: [said('Only their headline service is public', 'classic haircut', BOOKSY + 'hinces')],
  },
};

/* ── REAL: on a booking platform and nowhere else. No site, no socials ────── */
export const PLATFORM_ONLY: Competitor = {
  name: 'Barbering AJ', addedByCustomer: false,
  claims: {
    pricing: [said('Gents haircut £17', 17, BOOKSY + 'barbering-aj')],
    reviews: [said('351 reviews at 5.0', 351, BOOKSY + 'barbering-aj')],
    channels: [couldNotSee('No website or socials found')],
    blindspots: [said('Only their headline service is public', 'gents haircut', BOOKSY + 'barbering-aj')],
  },
};

/* ── REAL: a big social following, and our own side of it never counted ───── */
export const SOCIAL_HEAVY: Competitor = {
  name: 'The Fade Inn', addedByCustomer: false,
  claims: {
    pricing: [said('Skin fade / taper £20', 20, BOOKSY + 'the-fade-inn'),
              said('Cash only', 'cash only', BOOKSY + 'the-fade-inn')],
    reviews: [said('1,051 reviews at 5.0', 1051, BOOKSY + 'the-fade-inn')],
    channels: [said('9,065 Instagram followers', 9065, 'https://instagram.com/thefadeinn')],
  },
};

/* ── REAL: the customer. Full price menu, zero reviews, not on Booksy ─────── */
export const THE_CUSTOMER: Competitor = {
  name: 'The Barber Shop Shrewsbury', addedByCustomer: false,
  claims: {
    pricing: [said('Clipper cut £8', 8, 'https://shrewsburybarber.co.uk/prices'),
              said('Classic cut £15', 15, 'https://shrewsburybarber.co.uk/prices'),
              said('Cut & beard £20', 20, 'https://shrewsburybarber.co.uk/prices')],
    reviews: [couldNotSee('No public reviews found anywhere')],
    // The hole that killed an action on 14 September. They have an Instagram
    // account; nobody counted the followers. Read this before writing a channels action.
    channels: [said('Instagram @thebarbershopshrewsbury', 'present', 'https://shrewsburybarber.co.uk'),
               couldNotSee('Your own following was not counted. We count theirs, not yours')],
  },
};

/* ── SYNTHETIC: nobody publishes a price anywhere ─────────────────────────── */
export const NO_PRICES: Competitor = {
  name: 'Fixture Silent Ltd', addedByCustomer: false,
  claims: { pricing: [couldNotSee('No prices published')], reviews: [said('12 reviews at 4.6', 12, 'https://example.com/silent')] },
};

/* ── SYNTHETIC: sells nationally. A radius is meaningless ─────────────────── */
export const NOT_LOCAL: Competitor = {
  name: 'Fixture Remote Consulting', addedByCustomer: false,
  claims: {
    pricing: [said('From £2,400 per project', 'from 2400', 'https://example.com/remote/pricing')],
    channels: [said('Ranks for the same terms nationally', 'national', 'https://example.com/remote')],
  },
};

/* ── SYNTHETIC: a price range, not a point. Never round it to a number ────── */
export const RANGE_PRICING: Competitor = {
  name: 'Fixture Range Studio', addedByCustomer: false,
  claims: { pricing: [said('Cuts from £18', 'from 18', 'https://example.com/range')] },
};

/* ── SYNTHETIC: nothing public at all. A row, honestly empty ──────────────── */
export const INVISIBLE: Competitor = {
  name: 'Fixture Invisible Trading Co', addedByCustomer: false,
  claims: {
    pricing: [couldNotSee('No prices published')],
    reviews: [couldNotSee('No reviews found')],
    channels: [couldNotSee('No website or socials found')],
    blindspots: [couldNotSee('Nothing public to read anywhere we could reach')],
  },
};

/* ── SYNTHETIC: the customer named them, so they never drop off ───────────── */
export const CUSTOMER_NAMED: Competitor = {
  name: 'Fixture Down The Road', addedByCustomer: true, claims: {},
};

/** The real five, as the barber run found them. */
export const REAL_FIVE: Competitor[] = [
  RICH, SOCIAL_HEAVY,
  { name: 'NO.1 Barbers', addedByCustomer: false,
    claims: { pricing: [said('Haircut £18', 18, BOOKSY + 'no-1-barbers')],
              reviews: [said('607 reviews at 5.0', 607, BOOKSY + 'no-1-barbers')] } },
  PLATFORM_ONLY,
  { name: 'Fish Street Barbers', addedByCustomer: false,
    claims: { pricing: [said('Classic cut £25', 25, BOOKSY + 'fish-street')],
              reviews: [said('329 reviews at 5.0', 329, BOOKSY + 'fish-street')] } },
];

export const OWN_BUSINESS = 'The Barber Shop Shrewsbury';
