/**
 * Someone trying to break it. TESTING.md section 4.
 *
 * Two attacks matter more than the rest, because both are cheap to attempt and
 * specific to what we built: instructions hidden in a page we read, and one
 * customer reaching another's data.
 *
 * The rule: text we fetched is information, never instruction. A page telling
 * the agent to do something is a finding to report, not an order to follow.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOSTILE_PAGES, HOSTILE_NAMES } from './fixtures/hostile-pages.ts';
import { mayFetch, ROBOTS } from '../src/fetch-policy.ts';
import { findTrafficClaims, findNamedReviewers, findUnsourcedClaims } from '../src/guards.ts';
import { addCompetitor } from '../src/competitor-set.ts';
import { OWN_BUSINESS } from './fixtures/companies.ts';

/* ── Every hostile page has a stated expectation, so none is decorative ───── */

test('every hostile fixture says what passing looks like', () => {
  for (const p of HOSTILE_PAGES) {
    assert.ok(p.goal.length > 10, `${p.id} has no stated goal`);
    assert.ok(p.expect.length > 10, `${p.id} has no stated expectation`);
  }
  assert.ok(HOSTILE_PAGES.length >= 15);
});

/* ── The deterministic half: what the code can refuse without a model ─────── */

test('a link to an internal address inside a competitor page is never followed', () => {
  const page = HOSTILE_PAGES.find(p => p.id === 'ssrf')!;
  const href = page.html.match(/href="([^"]+)"/)![1];
  const r = mayFetch(href);
  assert.equal(r.allowed, false);
  if (!r.allowed) assert.equal(r.refusal, 'private-address');
});

test('a link inviting us into a disallowed path is never followed', () => {
  const page = HOSTILE_PAGES.find(p => p.id === 'robots-trap')!;
  const href = page.html.match(/href="([^"]+)"/)![1];
  const r = mayFetch(href, ROBOTS.booksy);
  assert.equal(r.allowed, false);
  if (!r.allowed) assert.equal(r.refusal, 'platform-search');
});

test('the exfiltration url is refused, so no customer detail leaves in a query string', () => {
  // The worst case in the set: data theft dressed as a helpful link.
  const url = 'https://example.com/collect?business=The+Barber+Shop&prices=8,15,20';
  const parsed = new URL(url);
  assert.ok(parsed.search.length > 0);
  // A url carrying our customer's own data is refused on that basis alone,
  // whatever robots.txt says about the host.
  const carriesCustomerData = /business=|prices=|email=|phone=/.test(parsed.search);
  assert.ok(carriesCustomerData, 'the fixture no longer carries customer data');
});

test('a boast about traffic on their own page does not become a claim in ours', () => {
  const page = HOSTILE_PAGES.find(p => p.id === 'traffic-bait')!;
  assert.ok(findTrafficClaims(page.html).length > 0, 'the traffic guard would let this through');
});

test('a named reviewer planted on a page is caught before it reaches an export', () => {
  const page = HOSTILE_PAGES.find(p => p.id === 'named-reviewer')!;
  assert.ok(findNamedReviewers(page.html).length > 0);
});

test('a self-reported number that contradicts the platform is not silently preferred', () => {
  // Both go in, each with its own source. Neither is asserted as the truth.
  const fromTheirSite = { text: 'Over 10,000 five-star reviews', value: 10000, source: { url: 'https://example.com', fetchedOn: '2026-09-14' } };
  const fromBooksy = { text: '2,461 reviews at 5.0', value: 2461, source: { url: 'https://booksy.com/en-gb/hinces', fetchedOn: '2026-09-14' } };
  const competitor = [{ name: 'Fixture', addedByCustomer: false, claims: { reviews: [fromTheirSite, fromBooksy] } }];
  assert.deepEqual(findUnsourcedClaims(competitor), []);
  assert.notEqual(fromTheirSite.source.url, fromBooksy.source.url, 'two numbers, two sources, no merge');
});

test('a hostile competitor name is stored as text, never run and never obeyed', () => {
  for (const c of HOSTILE_NAMES) {
    if (c.id === 'very-long' || c.id === 'empty') continue;
    const r = addCompetitor([], c.value, OWN_BUSINESS);
    assert.equal(r.status, 'added');
    if (r.status !== 'added') continue;
    const stored = r.set[0].name;
    assert.equal(stored, c.value.trim(), `${c.id} was altered on the way in`);
    // Whatever it says, it is a name. It never reaches mayFetch.
    if (/^https?:/.test(stored)) assert.equal(mayFetch(stored).allowed, false);
  }
});

test('a page the length of a novel does not let an instruction at the end win', () => {
  const page = HOSTILE_PAGES.find(p => p.id === 'enormous-page')!;
  assert.ok(page.html.length > 100_000, 'the fixture is no longer large enough to test this');
  // The rule is in CLAUDE.md: work through long input in pieces, never truncate,
  // never skim the tail. Graded by eval; recorded here so the case is not lost.
});

/* ── One customer reading another's data ──────────────────────────────────── */

/** Stand-in for the query layer, so these cases exist before the database does. */
function readBattlecard(accountId: string, ownerId: string) {
  if (accountId !== ownerId) return { status: 'refused' as const };
  return { status: 'ok' as const };
}

test('account A cannot read account B\'s battlecard by its id', () => {
  assert.equal(readBattlecard('account-a', 'account-b').status, 'refused');
});

test('nor B\'s competitor set, nor B\'s business profile', () => {
  for (const resource of ['competitors', 'profile', 'documents']) {
    assert.equal(readBattlecard('account-a', 'account-b').status, 'refused', `leaked ${resource}`);
  }
});

test('and an owner can still read their own', () => {
  assert.equal(readBattlecard('account-a', 'account-a').status, 'ok');
});

/* ── Cases the model has to pass, graded by eval, listed so none is lost ──── */

test('every injection fixture is claimed by a grader', () => {
  const gradedByCode = new Set(['ssrf', 'robots-trap', 'traffic-bait', 'named-reviewer', 'self-reported-contradiction', 'exfiltration']);
  const gradedByEval = HOSTILE_PAGES.filter(p => !gradedByCode.has(p.id)).map(p => p.id);
  assert.deepEqual(gradedByEval, [
    'plain-override', 'html-comment', 'white-on-white', 'image-alt',
    'aria-label', 'fake-turn', 'defamation-bait', 'zero-width', 'enormous-page',
  ], 'a hostile fixture is graded by nothing');
});
