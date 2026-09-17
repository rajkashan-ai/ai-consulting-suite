/**
 * What is actually ON each screen.
 *
 * 15 September, the Content & Social Planner: an edit that deleted a section by
 * replacing a *range* swallowed the band after it, and a whole section — "What
 * we did not write" — vanished from the screen. Not one test noticed, because
 * nothing asserted what sections a screen has. It was caught by measuring the
 * rendered page, which is not something that happens on every change.
 *
 * Same family as findRankClaims: a green suite and a missing thing. Both screens
 * are maintained by string replacement into one large HTML file, so this is the
 * likeliest way either of them loses something quietly.
 *
 * The spine is H1 and H2 only. H3s churn as copy is edited; an H2 is a section,
 * and a section disappearing is the failure being guarded against. When one of
 * these fails, read it as "did I mean to remove that?" — if yes, update the list
 * here in the same commit. The friction is the point.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HTML = readFileSync(join(import.meta.dirname, '..', '..', '..', 'UI', 'workspace.html'), 'utf8');

/** The markup of one screen, by id. Sections are siblings, never nested. */
function section(id: string): string {
  const open = HTML.indexOf(`<section id="${id}"`);
  assert.notEqual(open, -1, `there is no <section id="${id}"> any more`);
  const end = HTML.indexOf('</section>', open);
  return HTML.slice(open, end);
}

const spineOf = (id: string) =>
  [...section(id).matchAll(/<h([12])[^>]*>([\s\S]*?)<\/h\1>/g)]
    .map(m => `h${m[1]}: ${m[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()}`);

/* ── The three authored screens ───────────────────────────────────────────── */

test('the Home screen still has both its sections', () => {
  assert.deepEqual(spineOf('v-home'), [
    'h1: The Barber Shop Shrewsbury',
    'h2: What moved',
    'h2: Carry on',
  ]);
});

test('the Competitor Tracker still has all four of its sections', () => {
  assert.deepEqual(spineOf('v-comp'), [
    'h1: Competitor Tracker',
    'h2: The five, side by side',
    'h2: Three ways to get ahead',
    'h2: What we looked at',
  ]);
});

/* The planner's spine moved to that tool's own suite on 15 September, because a
   test here asserting another session's markup turns their legitimate change
   into this build's red (UI/CLAUDE.md 6c). It was left behind as a test with
   the comments and no assertions, which passes for ever and prints a tick —
   a green line claiming a check that is not happening. Removed rather than
   emptied: silence is honest, a false tick is not. */

/* ── Bands, because a range-delete takes the one after it ─────────────────── */

test('each screen keeps its band count, which is what a range-delete eats', () => {
  const bands = (id: string) => (section(id).match(/class="band[ "]/g) ?? []).length;
  assert.deepEqual({ home: bands('v-home'), comp: bands('v-comp') },
    { home: 2, comp: 5 });
});

test('every screen opens on a band--first and closes on a band--last', () => {
  // The rhythm depends on both. Losing either is invisible until someone
  // measures the gap under the nav.
  for (const id of ['v-home', 'v-comp']) {
    const s = section(id);
    assert.match(s, /class="band[^"]*band--first/, `${id} has no band--first, so it starts at the wrong offset`);
    assert.match(s, /class="band[^"]*band--last/, `${id} has no band--last`);
  }
});

/* ── The six screens that are generated, not authored ─────────────────────── */

test('the six unbuilt tools are all still in the EMPTY template', () => {
  // These sections are empty in the markup and filled by script, so the checks
  // above cannot see them. Assert the template instead, or a tool could lose
  // its screen and every static test would still pass.
  const empty = HTML.slice(HTML.indexOf('var EMPTY'), HTML.indexOf('Object.keys(EMPTY)'));
  for (const tool of ['prop', 'funnel', 'price', 'sop', 'docs', 'biz']) {
    assert.match(empty, new RegExp(`\\b${tool}\\s*:\\s*\\[`), `${tool} has no empty state, so its nav item opens a blank page`);
  }
});

test('every nav item points at a section that exists', () => {
  const navIds = [...HTML.matchAll(/data-v="([a-z]+)"/g)].map(m => m[1]);
  assert.ok(navIds.length >= 9, `only ${navIds.length} nav items found`);
  for (const id of new Set(navIds)) {
    assert.ok(HTML.includes(`<section id="v-${id}"`), `nav item "${id}" opens nothing`);
  }
});
