/**
 * The designed screen as an eval.
 *
 * `evals/expected-screen.js` is the screen I built by hand, frozen as data. The
 * pipeline now produces the screen instead, so the question is no longer "is
 * the markup still the markup I typed" but "does the real pipeline produce the
 * output I designed, and where does it fall short".
 *
 * Two kinds of answer, and they are treated differently on purpose:
 *   breaks - not a whole screen. Fatal.
 *   gaps   - a whole screen that reads worse than the design. Listed in
 *            KNOWN_GAPS below with what would close each one. A new gap fails,
 *            and closing one fails until it is taken off the list, so the list
 *            cannot quietly grow and a fix cannot go unrecorded.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXPECTED_SCREEN as E } from '../evals/expected-screen.js';
import { compareScreen, readScreen } from '../evals/compare.js';

/* PLANNER_PAGE points the eval at a copy, so a mutation run can prove these
   assertions go red without writing to the shared page. */
const PAGE = process.env.PLANNER_PAGE || join(import.meta.dirname, '..', '..', '..', 'UI', 'workspace.html');
const section = () => {
  const html = readFileSync(PAGE, 'utf8');
  return html.slice(html.indexOf('<!-- CONTENT & SOCIAL PLANNER -->'), html.indexOf('<!-- FIRST-USE STATES -->'));
};

/**
 * Every difference the pipeline is currently allowed against the design, and
 * what would close it. Two are shortfalls. One is deliberate and better than
 * the design, and is recorded here for the same reason: an unexplained
 * difference between the design and the product is a defect either way.
 */
const KNOWN_DIFFS = [
  // A model call in src/write.js closes these two. The writer composes from
  // extracted facts, so it writes about the prices it can see rather than about
  // the craft, which is the thing a barber would actually have said.
  'post 1 opens "Our prices, so nobody has to ask first", designed "Beard sculpting is not a trim"',
  'post 2 opens "Two people ask for the same thing and mean different things", designed "Do you need to book? You can book through NearCut, it takes about thirty seconds and you pick your own slot"',
  // The design left two gaps. The template writer leaves one, because it only
  // asks for what it can name a use for.
  '1 blanks, designed 2',
  // Deliberate, 2026-09-15: the design said "done", which does not say which
  // count it is. CLAUDE.md 6a requires it to. Do not close this back.
  'stat 3 measures "posted", designed as "done"',
];

test('the target describes a whole screen, not a fragment', () => {
  assert.ok(E.sections.length >= 5, 'too few sections to be a screen');
  assert.ok(E.posts.length >= 1, 'no posts in the target');
  assert.equal(E.stats.length, 3, 'the headline figures are missing');
  assert.ok(E.weeks.length >= 4, 'no month spine');
});

test('every post in the target is a finished post, not a hook', () => {
  for (const p of E.posts) {
    assert.ok(p.words.split(/\s+/).length >= 40, `${p.day} is too short to paste`);
    assert.ok(p.shot.length > 20, `${p.day} has no shot instruction`);
    assert.ok(p.day && p.channel && p.kind, `${p.day} is missing its head`);
  }
});

test('the blanks in the target are instructions, not placeholders', () => {
  for (const b of E.blanks) {
    assert.ok(b.split(/\s+/).length >= 3, `"${b}" tells them nothing`);
    assert.doesNotMatch(b, /^(tbc|todo|xxx|\.\.\.)$/i);
  }
});

test('what the pipeline produced is a whole screen', () => {
  const { breaks } = compareScreen(E, readScreen(section()));
  assert.deepEqual(breaks, [], breaks.join('\n'));
});

test('it falls short of the design in exactly the recorded ways', () => {
  const { gaps } = compareScreen(E, readScreen(section()));
  const isNew = gaps.filter((g) => !KNOWN_DIFFS.includes(g));
  const closed = KNOWN_DIFFS.filter((g) => !gaps.includes(g));
  assert.deepEqual(isNew, [], `new gap against the design:\n  ${isNew.join('\n  ')}`);
  assert.deepEqual(closed, [], `gap closed, take it off KNOWN_DIFFS:\n  ${closed.join('\n  ')}`);
});
