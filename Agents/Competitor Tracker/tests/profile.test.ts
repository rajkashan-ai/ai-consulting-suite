/**
 * Step 2, against the first eval.
 *
 * The fixtures are real slices of the live site fetched on 15 September 2026:
 * the JSON-LD block verbatim, the real body prose, and the five real price rows.
 * Not invented, and not the extracted answer written back as a fixture — that
 * would test nothing but itself.
 *
 * The assertions compare against evals/golden-barber.ts, which is the screen a
 * person built by hand on 14 September. Two methods, one answer: if they agree,
 * the pipeline reproduced a human's reading; if they disagree, one of them is
 * wrong and the disagreement is the finding.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildProfile, tradeFrom, servicesFrom, fromStructuredData, pagePathsFrom, pricePagePath } from '../src/profile.ts';
import { EXPECTED_PROFILE, EXPECTED_OWN_PRICES, INPUT } from '../evals/golden-barber.ts';
import { fetchPage, fetchAll, isFetched } from '../src/fetch-pages.ts';
import { rulesFor } from '../src/fetch-policy.ts';

const fx = (f: string) => readFileSync(join(import.meta.dirname, 'fixtures', f), 'utf8');
const home = fx('barber-home.html');
const prices = fx('barber-prices.html');

test('the structured data carries name, town and country', () => {
  const sd = fromStructuredData(home);
  assert.equal(sd.name, 'The Barber Shop Shrewsbury');
  assert.equal(sd.town, 'Shrewsbury');
  assert.equal(sd.country, 'GB');
  assert.equal(sd.street, '37 Smithfield Road');
});

test('a site with no structured data returns nothing rather than guessing', () => {
  assert.deepEqual(fromStructuredData('<html><body><h1>A Shop</h1></body></html>'), {});
});

test('the trade is read as "barber", which is the word a customer types', () => {
  const t = tradeFrom(home);
  assert.equal(t?.trade, 'barber');
  assert.ok(t!.mentions >= 2, `only ${t?.mentions} mentions`);
});

test('a single passing mention is not enough to decide a trade', () => {
  assert.equal(tradeFrom('<p>We are near the barber on the corner.</p>'), null);
});

test('the specific trade wins over the general one', () => {
  // A barber is also a hairdresser. The search term is the specific word.
  const t = tradeFrom('<p>barber barber barbers hairdressing hair salon hairdresser</p>');
  assert.equal(t?.trade, 'barber');
});

test('the price page is found even though the site has no links', () => {
  // 475KB of Wix with zero <a href>. The paths survive in the router's JSON.
  const paths = pagePathsFrom(home);
  assert.ok(paths.length > 0, 'no paths found at all');
  assert.equal(pricePagePath(paths), '/price-menu');
});

test('the five services and prices match what a person read by hand', () => {
  const found = servicesFrom(prices);
  const asMap = Object.fromEntries(found.map(s => [s.name.toLowerCase(), s.price]));
  for (const [name, price] of Object.entries(EXPECTED_OWN_PRICES)) {
    const key = name.toLowerCase().replace('cut & beard', 'classic cut & beard trim');
    assert.equal(asMap[key], price, `${name} should be £${price}, read £${asMap[key]}`);
  }
  assert.equal(found.length, 5, `expected 5 services, read ${found.length}`);
});

test('a price without a service name is not a service', () => {
  // "from £8", "£8 deposit" and a phone number after a pound sign all used to
  // qualify under a looser pattern. Four right beats five with one invented.
  const junk = '<p>from £8</p><p>Call 01743 362638</p><p>£20 deposit</p><p>Deposit: £20</p>';
  assert.deepEqual(servicesFrom(junk).map(s => s.name), ['Deposit']);
});

test('the whole profile matches the eval target', () => {
  const r = buildProfile(home, prices, INPUT);
  assert.ok(r.ok, r.ok ? '' : `could not build: ${(r as any).missing?.join(', ')}`);
  if (!r.ok) return;
  assert.equal(r.profile.name, EXPECTED_PROFILE.name);
  assert.equal(r.profile.trade, EXPECTED_PROFILE.trade);
  assert.equal(r.profile.town, EXPECTED_PROFILE.town);
  assert.equal(r.profile.country, EXPECTED_PROFILE.country);
  assert.equal(r.profile.services.length, EXPECTED_PROFILE.services.length);
});

test('a page we cannot read names what is missing instead of guessing', () => {
  const r = buildProfile('<html><body><p>Welcome</p></body></html>', '', INPUT);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.ok(r.missing.includes('the business name'));
  assert.ok(r.missing.includes('what trade this is'));
  assert.ok(r.missing.includes('which town'));
});

/* ── The network layer ────────────────────────────────────────────────────── */

test('a page that robots disallows is never requested', () => {
  // The refusal happens before the fetch, not after: a page we may not read is
  // not fetched-and-discarded.
  let called = false;
  const spy = (async () => { called = true; return new Response('x'); }) as unknown as typeof fetch;
  return fetchPage('https://booksy.com/search/barbers', { disallowed: ['/search/'] }, spy)
    .then(r => {
      assert.equal(isFetched(r), false);
      assert.equal((r as any).failed, 'robots-disallowed');
      assert.equal(called, false, 'it made the request anyway');
    });
});

test('an HTTP status becomes the failure word the rest of the code uses', async () => {
  const code = (n: number) => (async () => new Response('', { status: n })) as unknown as typeof fetch;
  assert.equal((await fetchPage('https://x.test/a', {}, code(403)) as any).failed, 'forbidden');
  assert.equal((await fetchPage('https://x.test/a', {}, code(404)) as any).failed, 'not-found');
});

test('a 200 with an empty body is a failure, not a page', async () => {
  const empty = (async () => new Response('   ', { status: 200 })) as unknown as typeof fetch;
  assert.equal((await fetchPage('https://x.test/a', {}, empty) as any).failed, 'empty-body');
});

test('fetchAll returns failures beside successes, never a shorter list', async () => {
  // A business we could not read is a finding. Dropping it from the array is
  // how five competitors silently become four.
  const mixed = (async (u: any) =>
    String(u).includes('bad') ? new Response('', { status: 404 }) : new Response('<p>ok</p>')
  ) as unknown as typeof fetch;
  const out = await fetchAll(['https://x.test/good', 'https://x.test/bad', 'https://x.test/good2'], {}, mixed);
  assert.equal(out.length, 3);
  assert.deepEqual(out.map(isFetched), [true, false, true]);
});

test('the robots rules come from the host, not from the caller', () => {
  // Found by passing Booksy's rules for a Google URL and watching the check
  // pass. Google disallows /search and Booksy does not, so the call site looked
  // guarded while reading the wrong site's policy — worse than no check,
  // because a reviewer stops looking once they see one.
  assert.deepEqual(rulesFor('https://www.google.com/search?q=x').disallowed.slice(0, 1), ['/search']);
  assert.deepEqual(rulesFor('https://instagram.com/someone').disallowed, ['/']);
  assert.deepEqual(rulesFor('https://shrewsburybarber.co.uk/').disallowed, []);
});

test('a caller cannot weaken the host rules by supplying laxer ones', async () => {
  let called = false;
  const spy = (async () => { called = true; return new Response('x'); }) as unknown as typeof fetch;
  // Caller says "nothing is disallowed". Google says /search is.
  const r = await fetchPage('https://www.google.com/search?q=barbers', { disallowed: [] }, spy);
  assert.equal(isFetched(r), false);
  assert.equal((r as any).failed, 'robots-disallowed');
  assert.equal(called, false, 'it made the request anyway');
});

test('a host we have never read robots for gets an empty rule set, honestly', () => {
  // Not a claim that nothing is disallowed — a statement that we have not
  // looked. Named in the code rather than hidden, because it is a real gap.
  assert.deepEqual(rulesFor('https://some-plumber.example/').disallowed, []);
});
