/**
 * Nothing goes in that we cannot point at. CLAUDE.md section 4.
 * Quote it and date it, every time. An empty cell is a finding, not a failure.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findUnsourcedClaims, findImpossibleDates, findStaleClaims, findNamedReviewers, STALE_AFTER_DAYS } from '../src/guards.ts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REAL_FIVE, INVISIBLE, NO_PRICES, said, couldNotSee } from './fixtures/companies.ts';
import type { Competitor } from '../src/types.ts';

const NOW = new Date('2026-09-14T12:00:00.000Z');
const one = (claims: Competitor['claims']): Competitor[] => [{ name: 'Fixture', addedByCustomer: false, claims }];

test('every claim in the real run carries a url and a date', () => {
  assert.deepEqual(findUnsourcedClaims(REAL_FIVE), []);
});

test('a stated fact with no source is rejected', () => {
  const bad = one({ pricing: [{ text: 'Classic cut £25', value: 25, source: null }] });
  assert.equal(findUnsourcedClaims(bad).length, 1);
});

test('a source with a url but no date is rejected, because a price is a price from a date', () => {
  const bad = one({ pricing: [{ text: 'Cut £25', value: 25, source: { url: 'https://example.com', fetchedOn: '' } }] });
  assert.equal(findUnsourcedClaims(bad).length, 1);
});

test('"we could not see it" needs no source and is allowed', () => {
  assert.deepEqual(findUnsourcedClaims(one({ pricing: [couldNotSee('No prices published')] })), []);
});

test('an empty cell is a finding: the whole of an invisible business validates', () => {
  assert.deepEqual(findUnsourcedClaims([INVISIBLE]), []);
});

test('"No prices published" is a complete and useful answer', () => {
  const claim = NO_PRICES.claims.pricing![0];
  assert.equal(claim.value, null);
  assert.deepEqual(findUnsourcedClaims([NO_PRICES]), []);
});

test('a fetch date in the future means the date was generated, not read', () => {
  const bad = one({ pricing: [said('Cut £25', 25, 'https://example.com', '2027-01-01')] });
  assert.equal(findImpossibleDates(bad, NOW).length, 1);
});

test('an unparseable date is caught too', () => {
  const bad = one({ pricing: [said('Cut £25', 25, 'https://example.com', 'last Tuesday')] });
  assert.equal(findImpossibleDates(bad, NOW).length, 1);
});

test('nothing read today is stale', () => {
  assert.deepEqual(findStaleClaims(REAL_FIVE, NOW), []);
});

test(`anything older than ${STALE_AFTER_DAYS} days is flagged for the export's staleness note`, () => {
  const old = one({ pricing: [said('Cut £25', 25, 'https://example.com', '2026-07-01')] });
  assert.equal(findStaleClaims(old, NOW).length, 1);
});

test('a review theme is allowed', () => {
  assert.deepEqual(findNamedReviewers('4 of 12 reviews since June mention waiting for a callback.'), []);
});

test('a named reviewer is not, whatever shape it arrives in', () => {
  const shapes = [
    'Reviewer Sarah left three stars.',
    'Sarah Whitfield wrote that the wait was long.',
    '"Waited three weeks for a callback" — Sarah',
  ];
  for (const s of shapes) assert.ok(findNamedReviewers(s).length > 0, `missed a name in: ${s}`);
});

/* ── The GDPR guard has to be readable to be read ─────────────────────────── */

test('a named individual is caught whatever the case of the keyword', () => {
  for (const s of ['Reviewer Sarah says the fade is the best in town.',
                   'reviewer Sarah says the fade is the best in town.',
                   'Customer Dave Wilson left a review about the beard trim.',
                   'Posted by Amira K. on their booking page.']) {
    assert.ok(findNamedReviewers(s).length > 0, `a real name got through: ${s}`);
  }
});

test('and ordinary prose is not', () => {
  // All twelve of these were reported as named individuals on 15 September,
  // because the pattern carried /i and so matched any two lowercase words.
  // A GDPR guard that cries wolf twelve times on a clean screen is one nobody
  // reads by the third week.
  for (const s of ['We read the newest review from the last thirty days.',
                   'Three searches a customer would run, from Shrewsbury.',
                   'What a client to review would look for.',
                   'Their customers name a barber rather than the shop.',
                   'Nothing a customer finds first points at it.']) {
    assert.deepEqual(findNamedReviewers(s), [], `flagged ordinary prose as a person: ${s}`);
  }
});

test('the whole Competitor Tracker screen names nobody', () => {
  // End to end, against the real markup, because every test above is a sentence
  // somebody chose. Block tags become sentence ends first: without that the
  // tables collapse into one 400-word run-on and the sentence-scoped guards
  // report nonsense.
  const html = readFileSync(join(import.meta.dirname, '..', '..', '..', 'UI', 'workspace.html'), 'utf8');
  const i = html.indexOf('<section id="v-comp"');
  const text = html.slice(i, html.indexOf('</section>', i))
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<\/(?:p|li|td|th|tr|h[1-6]|div|section|summary|button|a)>/g, '. ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s*\.\s*(?:\.\s*)+/g, '. ')
    .replace(/[ \t]+/g, ' ');
  assert.deepEqual(findNamedReviewers(text), []);
});

test('a capitalised word that is not a person is not reported as one', () => {
  // This tool writes dates and platform names constantly, and both are
  // capitalised. "A review from Monday" reporting a person called Monday is the
  // cost of widening the pattern back out to catch "A review from Sarah".
  for (const s of ['A review from Monday.',
                   'Reviews from September were better than August.',
                   'A review from Booksy, read on 14 September.',
                   'Feedback from Google is not something we can see.']) {
    assert.deepEqual(findNamedReviewers(s), [], `reported a date or a platform as a person: ${s}`);
  }
  // and the real one still fires, because that is the point of the widening
  assert.deepEqual(findNamedReviewers('A review from Sarah says the fade is sharp.'), ['Sarah']);
});
