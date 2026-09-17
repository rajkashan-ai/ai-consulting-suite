/**
 * WHERE THE COMPETITORS ARE, BY TRADE — measured, not assumed.
 *
 * "Gold standard for any given company" is a claim about generalising, and on
 * 15 September the whole evidence base was one barber. Testing a second trade
 * broke it immediately, and the reason is not our code: it is that different
 * trades keep their businesses in completely different places.
 *
 * A search for barbers in a town returns venue pages we can read. The same
 * search for plumbers returns directories and nothing else — no independent
 * business websites at all in the first page of results — and three of the four
 * directories refuse us outright.
 *
 * Measured 15 September 2026, one request each, real responses:
 *
 *   booksy.com      venue page   200   585 KB    barbers, salons
 *   fresha.com      venue page   200   468 KB    barbers, salons
 *   trustatrader    listing      200   167 KB    trades
 *   checkatrade     listing      403   refused   trades
 *   yell.com        listing      403   refused   trades, general
 *   192.com         listing      403   refused   general
 *
 * The point of this file is that the tool should know which route applies
 * before it starts, and say so when none does — rather than running a barber's
 * playbook against a plumber, finding nothing, and reporting an empty result as
 * though the plumber had no competitors.
 */

export type MarketShape = 'platform-led' | 'directory-led' | 'website-led' | 'social-only';

export interface Route {
  host: string;
  /** Measured, with the date. Re-check before trusting; a 403 can become a 200. */
  access: 'readable' | 'forbidden' | 'not-tested';
  checkedOn: string;
  gives: string[];
}

export const ROUTES: Record<string, Route> = {
  booksy:       { host: 'booksy.com',       access: 'readable',  checkedOn: '2026-09-15', gives: ['prices', 'review count', 'rating', 'review dates'] },
  fresha:       { host: 'fresha.com',       access: 'readable',  checkedOn: '2026-09-15', gives: ['prices', 'listing presence'] },
  trustatrader: { host: 'trustatrader.com', access: 'readable',  checkedOn: '2026-09-15', gives: ['review count', 'trade category'] },
  checkatrade:  { host: 'checkatrade.com',  access: 'forbidden', checkedOn: '2026-09-15', gives: [] },
  yell:         { host: 'yell.com',         access: 'forbidden', checkedOn: '2026-09-15', gives: [] },
  oneNineTwo:   { host: '192.com',          access: 'forbidden', checkedOn: '2026-09-15', gives: [] },
};

/** Which shape a trade's market takes. Only the first two are evidenced; the
 *  rest are named so an unknown trade is handled as unknown, not as a barber. */
const SHAPE_BY_TRADE: Record<string, MarketShape> = {
  barber: 'platform-led', hairdresser: 'platform-led', 'nail salon': 'platform-led',
  beautician: 'platform-led', tattooist: 'platform-led',
  plumber: 'directory-led', electrician: 'directory-led', builder: 'directory-led',
};

export interface RoutePlan {
  shape: MarketShape | 'unknown';
  usable: Route[];
  blocked: Route[];
  /** Empty when the run can go ahead. Otherwise the reason it cannot. */
  cannotProceed: string | null;
}

/**
 * What can actually be read for this trade, before a single request is made.
 *
 * An unknown trade returns `unknown` with no usable route, which is deliberate:
 * finding nothing because we looked in the wrong place is indistinguishable, on
 * the screen, from a business with no competitors. One of those is a finding and
 * the other is a bug, and the customer cannot tell them apart.
 */
export function planFor(trade: string): RoutePlan {
  const shape = SHAPE_BY_TRADE[trade.toLowerCase().trim()] ?? 'unknown';
  const forShape: Record<MarketShape, string[]> = {
    'platform-led': ['booksy', 'fresha'],
    'directory-led': ['trustatrader', 'checkatrade', 'yell'],
    'website-led': [],
    'social-only': [],
  };
  const keys = shape === 'unknown' ? [] : forShape[shape];
  const routes = keys.map(k => ROUTES[k]).filter(Boolean);
  const usable = routes.filter(r => r.access === 'readable');
  const blocked = routes.filter(r => r.access === 'forbidden');

  let cannotProceed: string | null = null;
  if (shape === 'unknown') {
    cannotProceed = `We have not worked out where ${trade}s list themselves, so we would be guessing.`;
  } else if (!usable.length) {
    cannotProceed = `Every source we know for ${trade}s refuses us: ${blocked.map(b => b.host).join(', ')}.`;
  }
  return { shape, usable, blocked, cannotProceed };
}


/**
 * THE JOB A TRADE IS ACTUALLY ABOUT.
 *
 * A price comparison needs one service compared on both menus, and picking it
 * by rule fails in every direction. Anchoring on the customer's dearest service
 * compared beard sculpting. Anchoring on the most widely shared picked a
 * two-job service and inflated every competitor by £5. Preferring plain ones
 * then anchored on a beard trim. Three heuristics, three wrong answers, because
 * the question is not answerable from price or popularity.
 *
 * Which job a trade is about is domain knowledge. A barber is about a haircut.
 * It is short, it is checkable, and it is written down rather than inferred.
 * An unlisted trade returns null, and a run then compares nothing rather than
 * comparing the wrong thing — which is the same rule as the rest of this file.
 */
const CORE_SERVICE: Record<string, string[]> = {
  barber: ['cut', 'haircut'],
  hairdresser: ['cut', 'haircut', 'blow'],
  'nail salon': ['manicure', 'nails'],
  beautician: ['facial', 'treatment'],
  tattooist: ['tattoo'],
  plumber: ['boiler', 'callout', 'call'],
  electrician: ['inspection', 'callout', 'call'],
  builder: ['survey', 'quote'],
};

export function coreServiceWords(trade: string): string[] | null {
  return CORE_SERVICE[trade.toLowerCase().trim()] ?? null;
}
