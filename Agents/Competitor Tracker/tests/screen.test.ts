/**
 * Every guard, run over the real screen, not over a sentence somebody chose.
 *
 * Added 15 September. Each guard had unit tests and none of them had ever been
 * pointed at the thing that ships. Doing it found three defects in one pass: a
 * fifth unbounded count the manual sweep missed, twelve false positives from
 * findNamedReviewers (the /i flag had switched its own capitalisation test off),
 * and a BOUNDED list so narrow that it flagged sentences which already named
 * their denominator.
 *
 * Two of those were guards crying wolf, which is the failure that matters most
 * here: the suite stays green either way, and a guard nobody reads protects
 * nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as guards from '../src/guards.ts';

const html = readFileSync(join(import.meta.dirname, '..', '..', '..', 'UI', 'workspace.html'), 'utf8');

/**
 * The prose of one screen.
 *
 * Tables are dropped, not flattened: a cell reading "None found." is bounded by
 * its column header, which is not in the sentence. Closing block tags become
 * full stops, or the sentence-scoped guards see one 400-word run-on and report
 * nonsense — which is how the first version of this scan produced twelve
 * findings that were all artefacts of its own text extraction.
 */
function proseOf(id: string): string {
  const i = html.indexOf(`<section id="${id}"`);
  assert.notEqual(i, -1, `no section ${id}`);
  return html.slice(i, html.indexOf('</section>', i))
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<table[\s\S]*?<\/table>/g, ' ')
    .replace(/<\/(?:p|li|h[1-6]|div|summary|button|a)>/g, '. ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s*\.\s*(?:\.\s*)+/g, '. ')
    .replace(/[ \t]+/g, ' ');
}

/* ── The extraction is asserted BEFORE any guard runs ─────────────────────
   Node runs tests in file order, and these have to come first. A bad extraction
   does not produce a wrong finding, it produces a finding that is entirely an
   artefact of itself: the first version of this scan collapsed the tables into
   one 400-word run-on and reported twelve violations, none of which were on the
   screen. Every assertion below this block is worthless if these fail. */

const SANITY = ['v-home', 'v-comp'];

test('extraction: each screen yields prose, and it is the right screen', () => {
  // The length floor is a tripwire for "the selector matched nothing", not a
  // quality bar. It guessed 800 first and failed on Home, which is legitimately
  // 713 characters. Identity is the assertion that matters.
  for (const id of SANITY) {
    assert.ok(proseOf(id).length > 300, `${id} prose came back at ${proseOf(id).length} characters`);
  }
  assert.match(proseOf('v-comp'), /Competitor Tracker/);
  assert.match(proseOf('v-home'), /The Barber Shop Shrewsbury/);
});

test('extraction: no markup survived', () => {
  for (const id of SANITY) {
    const p = proseOf(id);
    assert.doesNotMatch(p, /<[a-z/!]/i, `${id} still contains tags`);
    assert.doesNotMatch(p, /&[a-z]+;/i, `${id} still contains entities`);
  }
});

test('extraction: sentences exist and none is a run-on', () => {
  // This is the one that would have caught the first version. A table flattened
  // without sentence ends becomes a single enormous "sentence", and every
  // sentence-scoped guard then judges the whole screen as one claim.
  for (const id of SANITY) {
    const sentences = proseOf(id).split(/(?<=[.!?])\s+/).filter(x => x.trim());
    assert.ok(sentences.length > 8, `${id} split into only ${sentences.length} sentences`);
    const longest = sentences.reduce((a, b) => (a.split(/\s+/).length > b.split(/\s+/).length ? a : b));
    assert.ok(longest.split(/\s+/).length <= 90,
      `${id} has a ${longest.split(/\s+/).length}-word run-on, so the extraction is wrong, not the screen: ${longest.slice(0, 90)}`);
  }
});


const SCREENS = ['v-home', 'v-comp'];

/**
 * The copy that lives in the page script, not in the markup.
 *
 * Every assertion in this file stripped <script> until 15 September, and a
 * growing share of what a customer reads is generated there: the four answers
 * the Swap-in box gives, and the empty state for all six unbuilt tools. 51
 * user-facing strings that no guard had ever seen. Markup is not the boundary
 * of the product; what the customer reads is.
 */
function scriptCopy(): string {
  // EVERY script block, not just the first. A second one, owned by the Content
  // & Social Planner and scoped to its own section, was added on 15 September.
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  return blocks.map(block => block
      // COMMENTS OUT BEFORE STRINGS IN. An apostrophe in an English comment —
      // "the planner's cadence controls" — reads as an opening single quote and
      // swallows everything to the next quote, which on the Planner's side
      // produced four guard failures on text that was never on a screen. Our
      // comment style is full of apostrophes. Regex literals are left alone by
      // requiring a line start or whitespace before //.
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[\s;{(])\/\/[^\n]*/g, '$1 '))
    .flatMap(block => [...block.matchAll(/(["'])((?:\\.|(?!\1)[^\\])*?)\1/g)].map(m => m[2]))
    .filter(s => s.length > 12 && s.includes(' ')
      && !/^[.#[]/.test(s)
      && !/function|querySelector|addEventListener/.test(s)
      // MARKUP IS NOT PROSE. The EMPTY template builds its screens by
      // concatenating HTML, so 13 of the 67 strings this used to return were
      // fragments like '<div class="band band--a">'. A guard reading those is
      // judging text no customer sees, which is how a scan starts reporting
      // artefacts of itself rather than defects.
      && !/<\/?[a-z][a-z0-9-]*[\s>]/i.test(s))
    .join('. ')
    .replace(/&[a-z]+;/g, ' ');
}

test('extraction: the script yields user-facing copy', () => {
  const copy = scriptCopy();
  assert.ok(copy.length > 400, `script copy came back at ${copy.length} characters`);
  assert.match(copy, /We cannot find anything about/);
});

for (const [name, guard] of [
  ['no traffic claim', guards.findTrafficClaims],
  ['no rank claim', guards.findRankClaims],
  ['no feedback prompt', guards.findFeedbackPrompts],
  ['no build detail', guards.findBuildDetail],
  ['nobody named', guards.findNamedReviewers],
  ['every count bounded', guards.findUnboundedCounts],
] as [string, (t: string) => unknown][]) {
  test(`script copy: ${name}`, () => {
    const out = guard(scriptCopy());
    const fired = Array.isArray(out) ? out.length > 0 : Boolean(out);
    assert.ok(!fired, `script copy violates "${name}": ${JSON.stringify(out).slice(0, 240)}`);
  });
}

for (const id of SCREENS) {
  test(`${id}: no traffic claim`, () => {
    assert.deepEqual(guards.findTrafficClaims(proseOf(id)), []);
  });
  test(`${id}: no rank claim`, () => {
    assert.equal(guards.findRankClaims(proseOf(id)), false);
  });
  test(`${id}: no feedback prompt inside the document`, () => {
    assert.deepEqual(guards.findFeedbackPrompts(proseOf(id)), []);
  });
  test(`${id}: no build detail on a customer screen`, () => {
    assert.deepEqual(guards.findBuildDetail(proseOf(id)), []);
  });
  test(`${id}: nobody is named`, () => {
    assert.deepEqual(guards.findNamedReviewers(proseOf(id)), []);
  });
  test(`${id}: every count says where it stops`, () => {
    assert.deepEqual(guards.findUnboundedCounts(proseOf(id)), []);
  });
}


/* ── A clean screen proves nothing unless the guards still bite ───────────── */

/**
 * One real violation per guard, asserted to still fire.
 *
 * This is the counterweight to every test above. On 15 September five guards
 * were narrowed in one session to stop them flagging ordinary barbering
 * language, and one of those narrowings — dropping `from` out of
 * findNamedReviewers — silently removed three real violations with it. "A
 * review from Sarah" is exactly how this tool phrases one, and it went straight
 * through a green suite and a clean screen.
 *
 * Loosening a guard until the screen goes clean looks identical to fixing it,
 * and leaves the same end state as a guard that was never wired: green, quiet,
 * protecting nothing. Every narrowing ships with a line here.
 */
const REAL_VIOLATIONS: [string, string, (t: string) => unknown][] = [
  ['traffic, plain',        'HINCES gets around 40,000 visitors per month.',            guards.findTrafficClaims],
  ['traffic, in context',   'The Fade Inn sees roughly 12,000 sessions a quarter.',     guards.findTrafficClaims],
  ['traffic, ad metric',    'Their ads got 40,000 impressions last month.',             guards.findTrafficClaims],
  ['a rank position',       'You rank third on Google for best barber Shrewsbury.',     guards.findRankClaims],
  ['a feedback prompt',     'Was this any use?',                                        guards.findFeedbackPrompts],
  ['build detail',          'That is being started: identity check, passport, proof of address.', guards.findBuildDetail],
  ['a named reviewer',      'Reviewer Sarah says the fade is the best in town.',        guards.findNamedReviewers],
  ['a name after "from"',   'A review from Sarah says the fade is sharp.',              guards.findNamedReviewers],
  ['an unbounded count',    'You have none.',                                           guards.findUnboundedCounts],
];

for (const [label, sentence, guard] of REAL_VIOLATIONS) {
  test(`still guarding: ${label}`, () => {
    const out = guard(sentence);
    const fired = Array.isArray(out) ? out.length > 0 : Boolean(out);
    assert.ok(fired,
      `this guard has been narrowed until it no longer catches: "${sentence}". ` +
      'A clean screen is not the goal; a guard that still fires on a real violation is.');
  });
}

test('the screen never claims to have read a source it lists as not checked', () => {
  // Written after doing exactly this. The Swap-in box said "We looked at Booksy,
  // Fresha, Google and their own site" while the panel eight inches below said
  // "Not yet — Google reviews". Both were written on the same day, hours apart,
  // by the same person, because the mockup hand-copies what src/candidate.ts
  // returns instead of calling it. Two implementations of one rule drift on day
  // one, and this is the shape it takes.
  const prose = proseOf('v-comp');
  const notChecked = [...prose.matchAll(/Not yet\s+([A-Z][A-Za-z]+)/g)].map(m => m[1]);
  assert.ok(notChecked.length > 0, 'no "Not yet" entries found, so this test is checking nothing');
  for (const source of notChecked) {
    const claimsToHaveRead = new RegExp(`We looked at[^.]*\\b${source}\\b`, 'i');
    assert.doesNotMatch(prose, claimsToHaveRead,
      `the screen lists ${source} as not checked and elsewhere says it looked at it`);
  }
});
