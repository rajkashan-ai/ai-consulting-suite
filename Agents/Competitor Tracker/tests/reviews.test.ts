/**
 * Reading the reviews, not counting them.
 *
 * The tool had 4,799 reviews across five competitors and read the count. These
 * cases are built on the nine it actually read first, on 14 September 2026.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseReviews, namesAPerson, findNames, redact, validateTheme,
  loyaltyIsToAPerson, choiceSignals, MIN_FOR_A_THEME, type Review, type Theme,
} from '../src/reviews.ts';

/** Verbatim from booksy.com, three Shrewsbury barbers, 14 September 2026. */
const REAL: Review[] = [
  { on: '2026-09-10', rating: 5, body: 'Very great haircut and lovely chats' },
  { on: '2026-09-10', rating: 5, body: 'I have been getting fades for over 20 years and this guy is by far the best in town. The attention to detail is ridiculous' },
  { on: '2026-09-09', rating: 5, body: 'Saskia did a lovely job. Very happy overall. I will definitely visit again.' },
  { on: '2026-09-11', rating: 5, body: 'Great barber' },
  { on: '2026-09-11', rating: 5, body: 'Top haircut and service from Josh as usual. Thank you!' },
  { on: '2026-09-08', rating: 5, body: 'Jordan has been cutting my hair for a good few months now and every time he does, I get great attention to detail' },
  { on: '2026-09-07', rating: 5, body: 'Been getting my haircut by Younis for years and always pleased with the results. Friendly, professional and provides excellent service.' },
  { on: '2026-09-05', rating: 5, body: 'Great lads and top barbers' },
];

/* ── Getting them off the page ────────────────────────────────────────────── */

test('a schema.org review yields its date, rating and words', () => {
  const html = '{"@type":"Review","datePublished":"2026-09-10","reviewRating":{"ratingValue":"5"},"reviewBody":"Very great haircut"},{"@type":"Other"}';
  assert.deepEqual(parseReviews(html), [{ on: '2026-09-10', rating: 5, body: 'Very great haircut' }]);
});

test('a star with no words is dropped, because it says nothing', () => {
  // NO.1 Barbers had exactly this on 14 September.
  const html = '{"@type":"Review","datePublished":"2026-09-07","reviewBody":""},{"@type":"x"}';
  assert.deepEqual(parseReviews(html), []);
});

test('the same review rendered twice is counted once', () => {
  const one = '{"@type":"Review","datePublished":"2026-09-10","reviewBody":"Great barber"}';
  assert.equal(parseReviews(`${one},${one},{"@type":"x"}`).length, 1);
});

test('a curly apostrophe is not published as mojibake', () => {
  // The first real read returned "Iâ€™ve been getting fades". Presenting that as
  // somebody's exact words is wrong twice over: it is ugly and it is not what
  // they wrote.
  const html = '{"@type":"Review","datePublished":"2026-09-10","reviewBody":"I\\u00e2\\u0080\\u0099ve been getting fades"},{"@type":"x"}';
  const [r] = parseReviews(html);
  assert.ok(!/â/.test(r.body), `still mojibake: ${r.body}`);
  assert.match(r.body, /ve been getting fades/);
});

/* ── UK GDPR: themes, never individuals ───────────────────────────────────── */

test('a review naming a barber is detected', () => {
  for (const b of ['Saskia did a lovely job.', 'Top haircut from Josh as usual.',
                   'Jordan has been cutting my hair', 'Been getting my haircut by Younis for years']) {
    assert.ok(namesAPerson(b), `missed a name in: ${b}`);
  }
});

test('an ordinary review with no name is left alone', () => {
  for (const b of ['Very great haircut and lovely chats', 'Great barber', 'Great lads and top barbers']) {
    assert.ok(!namesAPerson(b), `false positive on: ${b}`);
  }
});

test('a sentence opener is never mistaken for a name', () => {
  for (const b of ['Very happy overall.', 'Great service.', 'Friendly and professional.', 'Always pleased.']) {
    assert.deepEqual(findNames(b), [], b);
  }
});

test('a quote is redacted before it can be published', () => {
  assert.equal(redact('Saskia did a lovely job.'), '[a barber] did a lovely job.');
  assert.ok(!namesAPerson(redact('Top haircut and service from Josh as usual.')));
});

/* ── A theme has to survive being read by the business it describes ───────── */

const ok: Theme = {
  says: 'Customers mention attention to detail', count: 2, outOf: 8,
  from: '2026-09-08', to: '2026-09-10',
  quotes: ['The attention to detail is ridiculous'],
};

test('a sourced, dated, counted theme passes', () => {
  assert.deepEqual(validateTheme(ok), []);
});

test(`one mention is a coincidence, not a theme`, () => {
  assert.ok(validateTheme({ ...ok, count: MIN_FOR_A_THEME - 1 }).some(p => p.kind === 'too-few'));
});

test('a count with no denominator is not a finding', () => {
  assert.ok(validateTheme({ ...ok, outOf: 0 }).some(p => p.kind === 'no-denominator'));
});

test('an undated theme is refused, because reviews go stale', () => {
  assert.ok(validateTheme({ ...ok, from: '', to: '' }).some(p => p.kind === 'undated'));
});

test('a theme quoting a named person never ships', () => {
  const p = validateTheme({ ...ok, quotes: ['Saskia did a lovely job'] });
  assert.ok(p.some(x => x.kind === 'names-a-person'));
});

/* ── The two signals that answer "why did they choose" ────────────────────── */

/**
 * The finding that justified building this. Four of the nine reviews name an
 * individual barber, so the competitor's advantage is a person: hireable,
 * losable, and not something you beat with a price. No review count shows it.
 */
test('loyalty to a person is measured, with its denominator', () => {
  const l = loyaltyIsToAPerson(REAL);
  assert.equal(l.named, 4);
  assert.equal(l.outOf, 8);
});

test('returning customers are counted, which is the only win/loss data a small business has', () => {
  const c = choiceSignals(REAL);
  assert.ok(c.returning >= 4, `only found ${c.returning}`);
  assert.equal(c.outOf, 8);
});

test('nobody switching is a result, not a blank', () => {
  // None of the nine said they moved from another barber. That is a finding:
  // these customers are not in play.
  assert.equal(choiceSignals(REAL).switched, 0);
});

test('no reviews at all gives zeroes with a denominator, never a divide by nothing', () => {
  assert.deepEqual(choiceSignals([]), { returning: 0, switched: 0, outOf: 0 });
  assert.deepEqual(loyaltyIsToAPerson([]), { named: 0, outOf: 0 });
});
