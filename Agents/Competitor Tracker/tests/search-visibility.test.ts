/**
 * Who comes up when a customer searches.
 *
 * No network. Results are fixtures shaped like real ones, so the classifier and
 * the counting are tested without paying for a search.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchTerms, searchToolConfig, classify, measure, summarise, TERMS_PER_RUN, candidatesFromSearch, type SearchProfile, type SearchResult, isVenuePage, resultCountry } from '../src/search-visibility.ts';
import { findRankClaims, findTrafficClaims, findUnsourcedClaims } from '../src/guards.ts';

const BARBER: SearchProfile = {
  name: 'The Barber Shop Shrewsbury', trade: 'barber', town: 'Shrewsbury',
  region: 'Shropshire', country: 'GB', timezone: 'Europe/London',
  services: ['Classic cut', 'Beard trim', 'Cut & beard'],
  website: 'https://shrewsburybarber.co.uk',
};
const RIVALS = ['HINCES', 'The Fade Inn', 'NO.1 Barbers', 'Barbering AJ', 'Fish Street Barbers'];
const READ_ON = '2026-09-14';

/* ── Location. The thing that would have made every answer wrong ──────────── */

/**
 * Run bare on 14 September, "barber Shrewsbury" returned Shrewsbury
 * Pennsylvania and Shrewsbury Massachusetts ahead of the real one. A missing
 * user_location does not fail: it quietly answers about the wrong country.
 */
test('the tool config always carries a location', () => {
  const cfg = searchToolConfig(BARBER);
  assert.ok(cfg.user_location, 'no location: results would be American');
  assert.equal(cfg.user_location.type, 'approximate');
  assert.equal(cfg.user_location.country, 'GB');
  assert.equal(cfg.user_location.city, 'Shrewsbury');
});

test('a profile with only a town and a country still gets a location', () => {
  const thin = { ...BARBER, region: undefined, timezone: undefined };
  const cfg = searchToolConfig(thin);
  assert.equal(cfg.user_location.city, 'Shrewsbury');
  assert.equal(cfg.user_location.country, 'GB');
  assert.ok(!('region' in cfg.user_location), 'do not send an empty region');
});

test('the number of searches is capped, because every one is paid for', () => {
  assert.equal(searchToolConfig(BARBER).max_uses, TERMS_PER_RUN);
  assert.equal(searchToolConfig(BARBER, 2).max_uses, 2);
});

/* ── The terms ────────────────────────────────────────────────────────────── */

test('five terms, and they are what a customer would actually type', () => {
  const terms = buildSearchTerms(BARBER).map(t => t.term);
  assert.equal(terms.length, TERMS_PER_RUN);
  assert.deepEqual(terms, [
    'barber Shrewsbury', 'barber near me', 'best barber Shrewsbury',
    'classic cut Shrewsbury', 'beard trim Shrewsbury',
  ]);
});

test('every term says why it is there, so a wrong one can be corrected', () => {
  for (const t of buildSearchTerms(BARBER)) assert.ok(t.why.length > 10, t.term);
});

/**
 * Searching for yourself returns yourself, proves nothing, and burns one of the
 * five searches we pay for.
 */
test('no term is just the business searching for itself', () => {
  const vanity: SearchProfile = { ...BARBER, trade: 'The Barber Shop Shrewsbury' };
  for (const t of buildSearchTerms(vanity)) {
    assert.notEqual(t.term.toLowerCase(), 'the barber shop shrewsbury');
  }
});

test('a business with no services still gets the three trade terms', () => {
  const terms = buildSearchTerms({ ...BARBER, services: [] });
  assert.equal(terms.length, 3);
});

test('an ampersand in a service becomes a word people type', () => {
  const terms = buildSearchTerms({ ...BARBER, services: ['Cut & beard'] }).map(t => t.term);
  assert.ok(terms.includes('cut and beard Shrewsbury'));
});

/* ── Working out whose result it is ───────────────────────────────────────── */

const r = (url: string, title: string): SearchResult => ({ url, title });

test('their own domain is them', () => {
  assert.deepEqual(classify(r('https://shrewsburybarber.co.uk/prices', 'Prices'), BARBER, RIVALS), { kind: 'you' });
  assert.deepEqual(classify(r('https://www.shrewsburybarber.co.uk/', 'Home'), BARBER, RIVALS), { kind: 'you' });
});

test('a competitor is found by name, wherever the page lives', () => {
  const who = classify(r('https://booksy.com/en-gb/123_hinces', 'HINCES - Book Online'), BARBER, RIVALS);
  assert.deepEqual(who, { kind: 'competitor', name: 'HINCES' });
});

test('a booking platform page for nobody we track is a directory', () => {
  const who = classify(r('https://booksy.com/en-gb/search/barbers', 'Barbers in Shrewsbury'), BARBER, RIVALS);
  assert.deepEqual(who, { kind: 'directory', site: 'booksy.com' });
});

/**
 * The trade word is in almost every title. Matching on it would make every
 * result look like every competitor.
 */
test('the trade word alone never identifies a business', () => {
  const who = classify(r('https://example.com/blog', 'The best barbers in town'), BARBER, RIVALS);
  assert.equal(who.kind, 'other');
});

test('a partial name match is not a match', () => {
  // "Fish Street Barbers" must not match a page that only says "barbers".
  const who = classify(r('https://example.com/x', 'Barbers near you'), BARBER, RIVALS);
  assert.equal(who.kind, 'other');
});

test('a malformed url does not take the run down', () => {
  assert.doesNotThrow(() => classify(r('not a url', 'Something'), BARBER, RIVALS));
});

/* ── Counting ─────────────────────────────────────────────────────────────── */

const SEEN = [
  measure('barber Shrewsbury', [
    r('https://booksy.com/en-gb/123_hinces', 'HINCES'),
    r('https://booksy.com/en-gb/9_the-fade-inn', 'The Fade Inn'),
    r('https://www.yell.com/barbers/shrewsbury', 'Barbers in Shrewsbury - Yell'),
  ], BARBER, RIVALS),
  measure('barber near me', [
    r('https://booksy.com/en-gb/search/barbers', 'Barbers near you'),
    r('https://www.yell.com/x', 'Yell'),
  ], BARBER, RIVALS),
  measure('best barber Shrewsbury', [
    r('https://booksy.com/en-gb/123_hinces', 'HINCES'),
    r('https://shrewsburybarber.co.uk/', 'The Barber Shop Shrewsbury'),
  ], BARBER, RIVALS),
];

test('a term where they appear is recorded as such', () => {
  assert.equal(SEEN[2].youAppear, true);
  assert.equal(SEEN[0].youAppear, false);
});

test('competitors and directories are counted separately', () => {
  assert.deepEqual(SEEN[0].competitors, ['HINCES', 'The Fade Inn']);
  assert.deepEqual(SEEN[0].directories, ['yell.com']);
});

test('the summary counts appearances and never states a position', () => {
  const claims = summarise(SEEN, BARBER, RIVALS, READ_ON);
  const text = claims.map(c => c.text).join('. ');
  assert.ok(!findRankClaims(text), `a ranking claim got in: ${text}`);
  assert.deepEqual(findTrafficClaims(text), []);
  assert.match(text, /You come up in 1 of 3/);
  assert.match(text, /HINCES comes up in 2 of 3/);
});

test('every claim carries its source and date', () => {
  const claims = summarise(SEEN, BARBER, RIVALS, READ_ON);
  assert.deepEqual(findUnsourcedClaims([{ name: 'x', addedByCustomer: false, claims: { channels: claims } }]), []);
});

/**
 * If the results for a search are all directories, the way in is to be listed on
 * them, not to try to out-rank them. This is the line that points at Booksy.
 */
test('a search that returns only directories is called out as the way in', () => {
  const text = summarise(SEEN, BARBER, RIVALS, READ_ON).map(c => c.text).join(' ');
  assert.match(text, /return only directory listings/);
  assert.match(text, /Being on booksy\.com, yell\.com is the way in/);
});

test('the terms they are missing from are named, with who is there instead', () => {
  const text = summarise(SEEN, BARBER, RIVALS, READ_ON).map(c => c.text).join(' ');
  assert.match(text, /You do not come up for "barber Shrewsbury"\. HINCES, The Fade Inn do/);
});

test('coming up in nothing is a result, not an error', () => {
  const none = [measure('barber Shrewsbury', [r('https://www.yell.com/x', 'Yell')], BARBER, RIVALS)];
  const claims = summarise(none, BARBER, RIVALS, READ_ON);
  assert.match(claims[0].text, /You come up in 0 of 1/);
  assert.equal(claims[0].value, 0);
});

test('no searches at all produces nothing, rather than a claim about nothing', () => {
  assert.deepEqual(summarise([], BARBER, RIVALS, READ_ON), []);
});

/* ── What the search finds that the list has missed ───────────────────────── */

/**
 * Real results for "barbers Shrewsbury Shropshire UK", read by hand on
 * 14 September 2026. Kept verbatim: the point of this fixture is that it is not
 * tidied up.
 */
const REAL: SearchResult[] = [
  r('https://the-barber-shop-shrewsbury.nearcut.com/', 'The Barber Shop Shrewsbury'),
  r('https://www.fresha.com/lp/en/bt/barbershops/in/gb-shrewsbury', 'Best Barbers near me in Shrewsbury | Fresha'),
  r('https://booksy.com/en-gb/42390_no-1-barbers_barber_1227928_shrewsbury', 'NO.1 BARBERS - Shrewsbury - Book Online'),
  r('https://www.mobile-barber-shropshire.co.uk/', 'Mobile Barber Shropshire | Home Haircuts'),
  r('https://www.shrewsburybarber.co.uk/', 'The Barber Shop Shrewsbury - Home'),
  r('https://www.sy1hair.co.uk/', 'Hair Salon | Sy1 Hair | England'),
  r('https://headcase-barbers.com/shrewsbury/', 'SHREWSBURY - Headcase Barbers | United Kingdom'),
  r('https://legionbarbers.com/', 'Legion Barbers'),
];

test('their own booking page counts as them, not as a stranger', () => {
  // the-barber-shop-shrewsbury.nearcut.com is not their domain, but it is them.
  assert.deepEqual(classify(REAL[0], BARBER, RIVALS), { kind: 'you' });
});

/**
 * The finding that made this function exist. The five competitors are picked by
 * Booksy review count; four of them do not come up in a real search, and two
 * shops with their own websites do and are on nobody's list.
 */
test('businesses that come up and are not on the list are offered back', () => {
  const found = candidatesFromSearch([{ term: 'barbers Shrewsbury', results: REAL }], BARBER, RIVALS);
  const names = found.map(c => c.name);
  assert.ok(names.includes('Headcase Barbers'), `missed Headcase: ${names.join(', ')}`);
  assert.ok(names.includes('Legion Barbers'));
});

test('the branch town is never offered as a business name', () => {
  // "SHREWSBURY - Headcase Barbers | United Kingdom" once gave a candidate
  // called SHREWSBURY, which is a town.
  const found = candidatesFromSearch([{ term: 'x', results: REAL }], BARBER, RIVALS);
  for (const c of found) {
    assert.notEqual(c.name.toLowerCase(), 'shrewsbury');
    assert.ok(!['home', 'united kingdom', 'book online'].includes(c.name.toLowerCase()), c.name);
  }
});

test('nobody already on the list is offered again', () => {
  const found = candidatesFromSearch([{ term: 'x', results: REAL }], BARBER, RIVALS);
  for (const c of found) {
    for (const rival of RIVALS) assert.ok(!c.name.toLowerCase().includes(rival.toLowerCase()));
  }
});

test('the customer is never offered as their own competitor', () => {
  const found = candidatesFromSearch([{ term: 'x', results: REAL }], BARBER, RIVALS);
  assert.ok(!found.some(c => c.url.includes('shrewsburybarber.co.uk')));
  assert.ok(!found.some(c => c.url.includes('nearcut')));
});

test('a directory is never offered as a competitor', () => {
  const found = candidatesFromSearch([{ term: 'x', results: REAL }], BARBER, RIVALS);
  for (const c of found) {
    for (const d of ['fresha', 'booksy', 'yell']) assert.ok(!c.url.includes(d), c.url);
  }
});

test('something in neither the trade nor the town is not a competitor', () => {
  const noise = [r('https://en.wikipedia.org/wiki/Barber_baronets', 'Barber baronets'),
                 r('https://example.com/news', 'Local news roundup')];
  const found = candidatesFromSearch([{ term: 'x', results: noise }], BARBER, RIVALS);
  assert.ok(!found.some(c => c.url.includes('example.com/news')));
});

test('coming up in several searches ranks a candidate above coming up in one', () => {
  const twice = [{ term: 'a', results: REAL }, { term: 'b', results: REAL }];
  const once = candidatesFromSearch([{ term: 'a', results: REAL }], BARBER, RIVALS);
  const found = candidatesFromSearch(twice, BARBER, RIVALS);
  assert.equal(found[0].seenIn, 2);
  assert.equal(once[0].seenIn, 1);
  assert.ok(found[0].seenIn >= found[found.length - 1].seenIn, 'not sorted by how often they came up');
});

test('the same business on two pages of one search is counted once', () => {
  const dupes = [r('https://legionbarbers.com/', 'Legion Barbers'),
                 r('https://legionbarbers.com/prices', 'Legion Barbers - Prices')];
  const found = candidatesFromSearch([{ term: 'x', results: dupes }], BARBER, RIVALS);
  assert.equal(found.length, 1);
  assert.equal(found[0].seenIn, 1);
});

test('a top-ten page is a directory, never a competitor', () => {
  // A real run offered "The 10 best barbers in Shrewsbury" as a business.
  const listicle = r('https://www.starofservice.co.uk/dir/shropshire/shrewsbury/barber-services',
                     'The 10 best barbers in Shrewsbury - StarOfService');
  assert.equal(classify(listicle, BARBER, RIVALS).kind, 'directory');
});

test('the trading name comes from a hyphenated hostname, not the page title', () => {
  // "Men's Beard Trim - Barber - Bridgette The Mobile Barber | Barber in
  // Shrewsbury" gave a candidate called "Men's Beard Trim".
  const found = candidatesFromSearch([{ term: 'beard trim Shrewsbury', results: [
    r('https://bridgette-the-mobile-barber.ueniweb.com/services/barber/mens-beard-trim',
      "Men's Beard Trim - Barber - Bridgette The Mobile Barber | Barber in Shrewsbury"),
  ] }], BARBER, RIVALS);
  assert.equal(found[0].name, 'Bridgette The Mobile Barber');
});

test('a one-word hostname falls back to the title', () => {
  const found = candidatesFromSearch([{ term: 'x', results: [
    r('https://legionbarbers.com/', 'Legion Barbers'),
  ] }], BARBER, RIVALS);
  assert.equal(found[0].name, 'Legion Barbers');
});

test('the directory names we show a customer are real domains', () => {
  const v = measure('best barber Shrewsbury', [
    r('https://www.yelp.com/search?find_desc=Barbers&find_loc=Shrewsbury', 'TOP 10 BEST Barbers'),
    r('https://booksy.com/en-gb/s/barber/1227928_shrewsbury', 'Barbers near me'),
  ], BARBER, RIVALS);
  // "yelp." with a trailing dot reached the screen once.
  for (const d of v.directories) assert.match(d, /\.[a-z]{2,}(\.[a-z]{2})?$/, `not a domain: ${d}`);
});

/* ── Discovery on a platform, which is where the competitors actually are ─── */

test('a venue page is a business; a listing page is not', () => {
  // Booksy serves both from one host. Until 15 September both came back as
  // "directory" and every competitor on the platform was discarded as a
  // listicle — so discovery found nobody on the one site nearly every small
  // business is on. 35 tests passed throughout, because they only ever used
  // independent websites.
  assert.equal(isVenuePage('https://booksy.com/en-gb/12884_hinces_barber_1227928_shrewsbury'), true);
  assert.equal(isVenuePage('https://booksy.com/en-gb/s/barber/1227928_shrewsbury'), false);
  assert.equal(isVenuePage('https://www.fresha.com/lvp/the-barber-shop-shrewsbury-smithfield-road-VEy9er'), true);
  assert.equal(isVenuePage('https://booksy.com/en-us/s/barber-shop/22487_shrewsbury'), false);
});

test('the country of a platform result is read from the url', () => {
  // Shrewsbury is a town in Shropshire, Pennsylvania, Massachusetts and New
  // Jersey. Searching "barber Shrewsbury" without a location returns
  // Pennsylvania and Massachusetts, measured 15 September.
  assert.equal(resultCountry('https://booksy.com/en-gb/12884_hinces_barber_1227928_shrewsbury'), 'GB');
  assert.equal(resultCountry('https://booksy.com/en-us/723622_matty-ice_barber-shop_22487_shrewsbury'), 'US');
  assert.equal(resultCountry('https://www.shrewsburybarber.co.uk/'), 'GB');
  assert.equal(resultCountry('https://example.org/x'), null);
});

test('five businesses on one platform are five candidates, not one', () => {
  // The other half of the same defect: candidates were keyed by host, so every
  // venue on booksy.com collapsed into a single entry.
  const p = { name: 'The Barber Shop Shrewsbury', trade: 'barber', town: 'Shrewsbury',
              country: 'GB', services: [], website: 'https://www.shrewsburybarber.co.uk' };
  const results = ['12884_hinces', '42390_no-1-barbers', '117692_branded-barbers-shrewsbury']
    .map(id => ({ url: `https://booksy.com/en-gb/${id}_barber_1227928_shrewsbury`,
                  title: `${id.split('_')[1]} - Shrewsbury - Book Online` }));
  const out = candidatesFromSearch([{ term: 'barber Shrewsbury', results }], p as any, []);
  assert.equal(out.length, 3, `collapsed ${3 - out.length} businesses into one host`);
});

test('a different country’s town of the same name is not a competitor', () => {
  const p = { name: 'The Barber Shop Shrewsbury', trade: 'barber', town: 'Shrewsbury',
              country: 'GB', services: [], website: 'https://www.shrewsburybarber.co.uk' };
  const results = [
    { url: 'https://booksy.com/en-gb/12884_hinces_barber_1227928_shrewsbury', title: 'HINCES - Shrewsbury' },
    { url: 'https://booksy.com/en-us/723622_matty-ice_barber-shop_22487_shrewsbury', title: 'Matty Ice - Shrewsbury' },
  ];
  const out = candidatesFromSearch([{ term: 'barber Shrewsbury', results }], p as any, []);
  assert.deepEqual(out.map(c => c.name), ['HINCES']);
});

test('the listing page itself is never offered as a competitor', () => {
  const p = { name: 'The Barber Shop Shrewsbury', trade: 'barber', town: 'Shrewsbury',
              country: 'GB', services: [], website: 'https://www.shrewsburybarber.co.uk' };
  const results = [{ url: 'https://booksy.com/en-gb/s/barber/1227928_shrewsbury',
                     title: 'Barbers near me in Shrewsbury - TOP 10 barbershops' }];
  assert.deepEqual(candidatesFromSearch([{ term: 'barber Shrewsbury', results }], p as any, []), []);
});
