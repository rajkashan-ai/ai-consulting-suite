/**
 * Who is on the list. CLAUDE.md section 2a.
 * Five, never six. The customer's own picks are permanent. Nobody is evicted silently.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addCompetitor, replaceCompetitor, refreshSet, MAX_COMPETITORS } from '../src/competitor-set.ts';
import { normaliseName, sameBusiness, checkName, MAX_NAME_LENGTH } from '../src/normalise.ts';
import { REAL_FIVE, OWN_BUSINESS, CUSTOMER_NAMED } from './fixtures/companies.ts';
import { HOSTILE_NAMES } from './fixtures/hostile-pages.ts';
import type { Competitor } from '../src/types.ts';

const ours = (...names: string[]): Competitor[] =>
  names.map(name => ({ name, addedByCustomer: false, claims: {} }));

test('proposes five', () => {
  assert.equal(REAL_FIVE.length, MAX_COMPETITORS);
});

test('fewer than five exist, so we return what exists and do not pad', () => {
  const set = refreshSet([], ['Fixture One', 'Fixture Two'], OWN_BUSINESS);
  assert.equal(set.length, 2);
});

test('nobody found is a result, not an error', () => {
  assert.deepEqual(refreshSet([], [], OWN_BUSINESS), []);
});

test('adding a sixth asks which of the five it replaces', () => {
  const r = addCompetitor(REAL_FIVE, 'Fixture Down The Road', OWN_BUSINESS);
  assert.equal(r.status, 'needs-swap');
  if (r.status !== 'needs-swap') return;
  assert.equal(r.replaceOneOf.length, 5);
});

test('never silently evicts: the set is untouched until the customer answers', () => {
  const before = [...REAL_FIVE];
  addCompetitor(REAL_FIVE, 'Fixture Down The Road', OWN_BUSINESS);
  assert.deepEqual(REAL_FIVE, before);
});

test('an explicit swap removes exactly one and adds exactly one', () => {
  const after = replaceCompetitor(REAL_FIVE, 'Fish Street Barbers', 'Fixture Down The Road');
  assert.equal(after.length, 5);
  assert.ok(!after.some(c => c.name === 'Fish Street Barbers'));
  assert.ok(after.some(c => c.name === 'Fixture Down The Road'));
});

test('a swap for someone not on the list is an error, not a silent no-op', () => {
  assert.throws(() => replaceCompetitor(REAL_FIVE, 'Fixture Nobody', 'Fixture New'));
});

test('a competitor the customer named survives the weekly run', () => {
  const previous = [CUSTOMER_NAMED, ...ours('A', 'B')];
  const after = refreshSet(previous, ['C', 'D', 'E', 'F'], OWN_BUSINESS);
  assert.ok(after.some(c => c.name === CUSTOMER_NAMED.name));
});

test('and survives even when fresh research would never have picked them', () => {
  const after = refreshSet([CUSTOMER_NAMED], ['A', 'B', 'C', 'D', 'E', 'F', 'G'], OWN_BUSINESS);
  assert.equal(after[0].name, CUSTOMER_NAMED.name);
  assert.equal(after.length, MAX_COMPETITORS);
});

test('five named by the customer means fresh research adds nobody', () => {
  const five = Array.from({ length: 5 }, (_, i) => ({ name: `Fixture C${i}`, addedByCustomer: true, claims: {} }));
  const after = refreshSet(five, ['A', 'B', 'C'], OWN_BUSINESS);
  assert.equal(after.length, 5);
  assert.ok(after.every(c => c.addedByCustomer));
});

test('the list never grows past five, whatever research returns', () => {
  const after = refreshSet(ours('A'), ['B', 'C', 'D', 'E', 'F', 'G', 'H'], OWN_BUSINESS);
  assert.ok(after.length <= MAX_COMPETITORS);
});

test('our own picks are replaceable between runs', () => {
  const after = refreshSet(ours('A', 'B'), ['X', 'Y', 'Z'], OWN_BUSINESS);
  assert.deepEqual(after.map(c => c.name), ['X', 'Y', 'Z']);
});

test('the customer cannot be their own competitor', () => {
  const r = addCompetitor([], OWN_BUSINESS, OWN_BUSINESS);
  assert.equal(r.status, 'rejected');
  if (r.status === 'rejected') assert.equal(r.reason, 'is-the-customer');
});

test('nor a differently punctuated version of themselves', () => {
  const r = addCompetitor([], 'the barber shop shrewsbury LTD.', OWN_BUSINESS);
  assert.equal(r.status, 'rejected');
});

test('a duplicate is refused, however it is typed', () => {
  for (const variant of ['HINCES', 'hinces', 'Hinces Ltd', 'H I N C E S'.replace(/ /g, ''), 'Hinces.']) {
    const r = addCompetitor(REAL_FIVE.slice(0, 3), variant, OWN_BUSINESS);
    assert.equal(r.status, 'rejected', `accepted a duplicate: ${variant}`);
  }
});

test('"&" and "and" are the same business', () => {
  assert.ok(sameBusiness('Smith & Sons', 'Smith and Sons'));
});

test('accents do not create a second business', () => {
  assert.ok(sameBusiness('Café Barbers', 'Cafe Barbers'));
});

test('a name that is only punctuation is not a business', () => {
  const r = addCompetitor([], '...', OWN_BUSINESS);
  assert.equal(r.status, 'added');           // we store what they typed
  assert.equal(normaliseName('...'), '');    // but it matches nothing
});

test('hostile names are stored as text or refused, never executed', () => {
  for (const c of HOSTILE_NAMES) {
    const r = addCompetitor([], c.value, OWN_BUSINESS);
    if (c.id === 'very-long') { assert.equal(r.status, 'rejected'); continue; }
    if (c.id === 'empty') { assert.equal(r.status, 'rejected'); continue; }
    assert.equal(r.status, 'added', `${c.id} should be accepted as inert text`);
    if (r.status === 'added') assert.equal(r.set[0].name, c.value.trim());
  }
});

test('a name at the length limit is accepted, one over is not', () => {
  assert.equal(addCompetitor([], 'A'.repeat(MAX_NAME_LENGTH), OWN_BUSINESS).status, 'added');
  assert.equal(addCompetitor([], 'A'.repeat(MAX_NAME_LENGTH + 1), OWN_BUSINESS).status, 'rejected');
});

test('emoji and RTL names round-trip unchanged', () => {
  const r = addCompetitor([], 'Fixture 💈 Barbers', OWN_BUSINESS);
  assert.equal(r.status, 'added');
  if (r.status === 'added') assert.equal(r.set[0].name, 'Fixture 💈 Barbers');
});

// KNOWN GAP, written down rather than left to be discovered by a customer.
// Cyrillic С and Latin C are different characters and NFKD does not fold them,
// so a homoglyph name gets past the duplicate check and the customer sees the
// same business listed twice. Needs a confusables mapping before launch.
test('homoglyph names are caught as duplicates', { todo: 'needs a Unicode confusables map' }, () => {
  assert.ok(sameBusiness('HINCES', 'HINСES'));  // second C is Cyrillic U+0421
});


/* ── checkName: what the customer typed, before anything is looked up ──────
   Untested until 15 September. It is the first thing a typed name meets, and
   the candidate-validation screen is about to be built on it, so the boundary
   is pinned here rather than discovered there. */

test('a name is accepted and comes back trimmed', () => {
  const r = checkName('  Fish Street Barbers  ');
  assert.deepEqual(r, { ok: true, name: 'Fish Street Barbers' });
});

test('empty is rejected, and so is whitespace that only looks like a name', () => {
  for (const raw of ['', '   ', '\t\n ']) {
    assert.deepEqual(checkName(raw), { ok: false, problem: 'empty' }, `accepted ${JSON.stringify(raw)}`);
  }
});

test('the length cap is applied after trimming, not before', () => {
  // A name at the cap padded with spaces is a valid name, not a too-long one.
  const atCap = 'A'.repeat(MAX_NAME_LENGTH);
  assert.deepEqual(checkName(`  ${atCap}  `), { ok: true, name: atCap });
});

test('one character over the cap is rejected', () => {
  assert.deepEqual(checkName('A'.repeat(MAX_NAME_LENGTH + 1)), { ok: false, problem: 'too-long' });
});

test('checkName and addCompetitor agree on the boundary', () => {
  // Two places decide the same thing. They drifted once on case sensitivity in
  // findNamedReviewers, so the agreement is asserted rather than assumed.
  for (const n of [MAX_NAME_LENGTH, MAX_NAME_LENGTH + 1]) {
    const name = 'A'.repeat(n);
    const accepted = checkName(name).ok;
    const added = addCompetitor([], name, OWN_BUSINESS).status === 'added';
    assert.equal(accepted, added, `they disagree at ${n} characters`);
  }
});
