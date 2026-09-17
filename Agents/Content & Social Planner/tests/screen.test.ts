/**
 * Every guard, run over the actual rendered screen.
 *
 * Until 15 September each guard was only ever run over sentences somebody chose
 * for it. The Competitor Tracker pointed its guards at its own screens and found
 * three defects in an afternoon, two of them guards crying wolf. A guard with
 * false positives on a clean screen is one nobody reads by the third week, and
 * then it protects nothing: the same end state as a guard nothing calls,
 * reached from the opposite direction.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findBuildDetail, findFeedbackPrompts, findInventedClaims, findLocalAssumptions, findOverdueLanguage } from '../src/guards.ts';
import { findOverclaimedAccess, findUnboundedSuperlatives, findUnearnedInference } from '../src/tracking.ts';
import { findPromisedResults } from '../src/recommend.ts';
import { BARBER } from './fixtures/businesses.ts';

const PAGE = join(import.meta.dirname, '..', '..', '..', 'UI', 'workspace.html');

/**
 * The prose of the planner screen, as sentences.
 *
 * Two things learned from the Tracker doing this first. **Tables are dropped
 * rather than flattened**, because a cell reading "None found." is bounded by a
 * column header that is not in the sentence. And **closing block tags become
 * full stops**, without which every sentence-scoped guard sees one enormous
 * run-on and reports findings that are artefacts of the extraction.
 */
function screenProse(): string {
  const html = readFileSync(PAGE, 'utf8');
  const section = html.slice(
    html.indexOf('<!-- CONTENT & SOCIAL PLANNER -->'),
    html.indexOf('<!-- FIRST-USE STATES -->'),
  );
  assert.ok(section.length > 2000, 'the planner section was not found in the page');
  // The planner's own script writes user-facing text, and stripping <script>
  // would hide every word of it from the guards below. The Competitor Tracker
  // found 51 strings living that way on its screens.
  //
  // Comments are removed BEFORE strings are matched. The first version did not,
  // and every apostrophe in an English comment ("the session's", "Airbnb's")
  // read as a string delimiter, so it swallowed whole blocks of CSS and markup
  // and four guards then failed on text that was never on the screen. The
  // extraction check below is what caught it.
  const block = html.slice(html.lastIndexOf('<script>'), html.lastIndexOf('</script>'));
  const code = block.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  const spoken = [...code.matchAll(/'([^'\\\n]{14,})'/g)].map(m => m[1])
    // Tags are stripped rather than the string being skipped: the save
    // confirmations carry <strong>, and those are exactly the sentences a
    // customer reads at the moment something either worked or did not.
    .map(s => s.replace(/<[^>]*>/g, ' ').replace(/\\u\w{4}/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(s => /^[A-Z0-9]/.test(s) && / [a-z]/.test(s) && !/[{}=]|\$\{/.test(s))
    .join('. ');
  return (section + '\n' + spoken)
    .replace(/<table[\s\S]*?<\/table>/gi, ' ')
    .replace(/<(?:script|style)[\s\S]*?<\/(?:script|style)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '. ')
    .replace(/<\/(?:p|li|h[1-6]|span|div|article|button|label)>/gi, '. ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&pound;/g, '£').replace(/&middot;/g, '·')
    .replace(/&mdash;/g, '—').replace(/&[a-z]+;/g, ' ')
    .replace(/\s*\.\s*(\.\s*)+/g, '. ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

test('the extraction produces sentences, not one run-on', () => {
  // Checked first, because every guard below is sentence-scoped and a bad
  // extraction produces findings that are entirely artefacts of itself.
  const prose = screenProse();
  const sentences = prose.split(/(?<=\.)\s+/).filter(s => s.trim());
  assert.ok(sentences.length > 30, `only ${sentences.length} sentences came out`);
  const longest = Math.max(...sentences.map(s => s.split(/\s+/).length));
  assert.ok(longest < 90, `a ${longest}-word sentence means the extraction is not splitting`);
  assert.doesNotMatch(prose, /<[a-z]/i, 'markup survived into the prose');
});

test('the screen makes no claim the business has not given us', () => {
  const found = findInventedClaims(screenProse(), BARBER);
  assert.deepEqual(found, [], `invented on screen: ${JSON.stringify(found)}`);
});

test('the screen infers nothing from a number', () => {
  assert.deepEqual(findUnearnedInference(screenProse()), []);
});

test('no superlative on the screen is missing its denominator', () => {
  assert.deepEqual(findUnboundedSuperlatives(screenProse()), []);
});

test('the screen claims no access we do not ask for', () => {
  assert.deepEqual(findOverclaimedAccess(screenProse()), []);
});

test('the screen promises no result', () => {
  assert.deepEqual(findPromisedResults(screenProse()), []);
});

test('nothing on the screen calls a post overdue', () => {
  assert.deepEqual(findOverdueLanguage(screenProse()), []);
});

test('no build detail reaches the screen', () => {
  assert.deepEqual(findBuildDetail(screenProse()), []);
});

test('local wording is used only where it is true', () => {
  // The barber serves an area, so "local" is allowed. This asserts the guard
  // would fire on this exact copy if the business were a national seller,
  // which is what makes the permission meaningful rather than accidental.
  assert.deepEqual(findLocalAssumptions(screenProse(), BARBER), []);
});

test('no feedback prompt has leaked into the document part of the screen', () => {
  const prose = screenProse();
  const leaked = findFeedbackPrompts(prose).filter(p => p !== 'too salesy' && p !== 'not how i talk');
  assert.deepEqual(leaked, [], 'app furniture reached the document');
});

/* ── The false positives the screen scan found, kept fixed ────────────────── */

test('a denial is the sentence we want, not an instance of the thing', () => {
  // "Nothing here is overdue" was reported as overdue language. The same fix
  // existed in findOverclaimedAccess a day earlier and was never carried across.
  assert.deepEqual(findOverdueLanguage('Nothing here is overdue.'), []);
  assert.deepEqual(findOverdueLanguage('Nothing is late and nothing was missed.'), []);
  assert.deepEqual(findOverdueLanguage('This post is overdue.'), ['overdue']);
});

test('a word is a word, not a substring of a longer one', () => {
  // "every later week" matched "late".
  assert.deepEqual(findOverdueLanguage('every later week is written to the new number'), []);
  assert.deepEqual(findOverdueLanguage('updated lately'), []);
  // "open late on Thursday" is opening hours, so bare 'late' went the way of
  // 'sessions' in a barber's price list: a word boundary does not save a word
  // that means something else in the trade. It is late AGAINST something.
  assert.deepEqual(findOverdueLanguage('We are open late on Thursday.'), []);
  assert.deepEqual(findOverdueLanguage('Your post is late.'), ['is late']);
});

test('"since" is temporal here far more often than causal', () => {
  assert.deepEqual(findUnearnedInference('anything you have told us since'), []);
  assert.deepEqual(findUnearnedInference('It reached further because it had a photo.'), ['because']);
});

test('a negation that is part of the accusation does not excuse it', () => {
  // Sentence-scoped denial was too generous and swallowed real nagging. The
  // clause stops at the comma, and the matched phrase cannot use its own "not".
  assert.ok(findOverdueLanguage('You have not posted since June, time to catch up.').length >= 2);
  assert.deepEqual(findOverdueLanguage('Nothing here is overdue.'), []);
});

/* ── A word that means something else in the trade ────────────────────────── */

const TRADE_COPY = [
  'Your feedback is what tells us what to do more of.',
  'He is the best in the chair on a busy Saturday.',
  'We are closed Sunday and open late on Thursday.',
  'We run barbering sessions for apprentices on a Tuesday.',
  'First impressions matter, and so does the back of your neck.',
  'The conversion of the back room gave us a third chair.',
];
for (const line of TRADE_COPY) {
  test(`trade copy stays clean: ${line.slice(0, 36)}`, () => {
    // The Competitor Tracker found five of these on its own screens: "sessions"
    // is a visit in analytics and an appointment in a barber's price list, and
    // a word boundary does not tell them apart. A guard with false positives on
    // clean copy is one nobody reads by the third week.
    const fired = [
      ['invented', findInventedClaims(line, BARBER).map(c => c.kind)],
      ['feedback', findFeedbackPrompts(line)],
      ['overdue', findOverdueLanguage(line)],
      ['inference', findUnearnedInference(line)],
      ['superlative', findUnboundedSuperlatives(line)],
      ['promise', findPromisedResults(line)],
      ['build', findBuildDetail(line)],
    ].filter(([, hits]) => (hits as string[]).length);
    assert.deepEqual(fired, [], `${JSON.stringify(fired)} on clean trade copy`);
  });
}

test('and the real violations are all still caught', () => {
  // The other half of every narrowing. Loosening a guard until the screen is
  // clean is the failure that looks exactly like fixing it.
  assert.ok(findFeedbackPrompts('Was this helpful? Rate this plan.').length >= 2);
  assert.ok(findInventedClaims('Voted best barber in Shropshire.', BARBER).length > 0);
  assert.deepEqual(findOverdueLanguage('Your post is late.'), ['is late']);
  assert.ok(findUnearnedInference('Your carousels perform better than your photos.').length > 0);
  assert.equal(findUnboundedSuperlatives('412 reached, the most this month.').length, 1);
});

/* ── Every narrowing, paired with the violation it must still catch ───────── */

/**
 * This block sits directly under the clean-screen assertions on purpose,
 * because that is where the temptation is. Narrowing a guard until the screen
 * goes quiet is the failure that looks exactly like fixing it: the screen is
 * clean, the suite is green, the false positives are gone, and the guard has
 * stopped guarding.
 *
 * Auditing four narrowings made an hour earlier found six of these already
 * broken, including "Your carousels get more saves" — the single sentence
 * findUnearnedInference exists to stop.
 */
const NARROWED: [string, string, (s: string) => unknown[]][] = [
  ['feedback: the verb makes it a prompt', 'Leave feedback below.', findFeedbackPrompts],
  ['feedback: and so does naming this plan', 'Send feedback about this plan.', findFeedbackPrompts],
  ['award: a place after "best in"', 'Best in Shropshire three years running.', s => findInventedClaims(s, BARBER)],
  ['award: the voted form', 'Voted best barber in Shropshire.', s => findInventedClaims(s, BARBER)],
  ['overdue: a duration in front of late', 'Your post is three days late.', findOverdueLanguage],
  ['overdue: and the shorter form', 'This one is a week late.', findOverdueLanguage],
  ['overdue: the plain one', 'This post is overdue.', findOverdueLanguage],
  ['inference: more, of a number we read', 'Your carousels get more saves.', findUnearnedInference],
  ['inference: and reach', 'Photo posts get more reach for you.', findUnearnedInference],
  ['inference: the causal form', 'It reached further because it had a photo.', findUnearnedInference],
  ['superlative: no number needed', 'That was your best post.', findUnboundedSuperlatives],
];
for (const [what, line, fn] of NARROWED) {
  test(`still caught after narrowing — ${what}`, () => {
    assert.ok(fn(line).length > 0, `narrowed away a real violation: ${line}`);
  });
}

test('none of the planner\'s copy is generated in the page script', () => {
  // The screen scan strips <script>, so any copy that moves in there becomes
  // invisible to every guard above without a single test failing. The
  // Competitor Tracker found 51 user-facing strings living in the shared script
  // with no guard ever having read them. This section is markup-only today and
  // this is what keeps it that way.
  const html = readFileSync(PAGE, 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
  // The planner now has its own script, which is fine: the rule was never "no
  // script", it was "no copy the guards cannot see". screenProse() reads the
  // resizer's strings, so what this has to protect is that the SHARED script
  // does not generate planner copy, which is the part no guard would reach.
  const shared = scripts.slice(0, scripts.indexOf('THE RESIZER.') === -1 ? undefined : scripts.indexOf('THE RESIZER.'));
  assert.doesNotMatch(shared, /\bv-content\b/, 'the shared script now writes into the planner screen');
  // The section ids are built as `"v-" + key`, so the literal "v-content" never
  // appears and checking for it alone caught nothing: adding a `content:` entry
  // to the EMPTY template came back 0 red. The mutation applied and the
  // assertion was the thing that was wrong.
  const empty = scripts.slice(scripts.indexOf('var EMPTY'), scripts.indexOf('Object.keys(EMPTY)'));
  assert.doesNotMatch(empty, /(?:^|[{,\s])content\s*:/, 'the planner has an entry in the empty-state template');
  // And the section's own controls must not depend on ids the script owns.
  const shared2 = scripts.slice(0, scripts.indexOf('THE RESIZER.') === -1 ? undefined : scripts.indexOf('THE RESIZER.'));
  const section = html.slice(html.indexOf('<!-- CONTENT & SOCIAL PLANNER -->'), html.indexOf('<!-- FIRST-USE STATES -->'));
  for (const id of section.matchAll(/id="([^"]+)"/g)) {
    if (id[1] === 'v-content' || id[1].startsWith('rz-')) continue;
      assert.doesNotMatch(shared2, new RegExp(`["'#]${id[1]}\\b`), `${id[1]} is driven from the shared script`);
  }
});

/* ── The planner's own spine, asserted by the planner's own suite ─────────── */

test('the screen still has all seven of its sections, in order', () => {
  // Moved here from the Competitor Tracker's structure.test.ts on 15 September.
  // A test that asserts another session's markup makes their legitimate change
  // your red build. UI/CLAUDE.md 6c.
  //
  // It exists because a section was once deleted by a range replacement and not
  // one test noticed: every test checked what a section contained, none that it
  // was there. Changing these headings is fine. Changing them without updating
  // this list is the thing being caught.
  const html = readFileSync(PAGE, 'utf8');
  const section = html.slice(html.indexOf('<!-- CONTENT & SOCIAL PLANNER -->'), html.indexOf('<!-- FIRST-USE STATES -->'));
  const spine = [...section.matchAll(/<h([12])[^>]*>([\s\S]*?)<\/h\1>/g)]
    .map(m => `h${m[1]}: ${m[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim()}`);
  assert.deepEqual(spine, [
    'h1: Content & Social Planner',
    'h2: What you have posted',
    'h2: How often we suggest you post',
    'h2: What you sound like',
    'h2: This week',
    'h2: Resize a photo',
    'h2: The rest of the month',
    'h2: What we did not write',
  ]);
});

test('the screen opens on a band--first and closes on a band--last', () => {
  const html = readFileSync(PAGE, 'utf8');
  const section = html.slice(html.indexOf('<!-- CONTENT & SOCIAL PLANNER -->'), html.indexOf('<!-- FIRST-USE STATES -->'));
  assert.equal((section.match(/band--first/g) ?? []).length, 1);
  assert.equal((section.match(/band--last/g) ?? []).length, 1);
  assert.equal((section.match(/band--dark/g) ?? []).length, 1, 'one dark band per screen');
});

/* ── A way out of the resizer ─────────────────────────────────────────────── */

test('the resizer has a cancel, and it clears everything it put on screen', () => {
  const html = readFileSync(PAGE, 'utf8');
  const block = html.slice(html.lastIndexOf('<script>'), html.lastIndexOf('</script>'));
  assert.match(html, /id="rz-cancel"/, 'no way out of the resizer');

  // Each of these was a separate thing left behind by the first version.
  for (const [what, pattern] of [
    ['the photo', /img = null/],
    ['the file input, or the same photo cannot be chosen again', /\$\('rz-file'\)\.value = ''/],
    ['the results', /\$\('rz-out'\)\.innerHTML = ''/],
    ['the status line', /\$\('rz-status'\)\.classList\.add\('hide'\)/],
    ['the panel itself', /\$\('rz-work'\)\.classList\.add\('hide'\)/],
  ] as const) assert.match(block, pattern, `cancel does not clear ${what}`);
});

test('cancelling stops a resize that is already running', () => {
  // The first version cleared the screen and the loop carried on writing
  // thumbnails into it, because a resize is a loop with an await in it. Every
  // run takes a ticket and checks its own after each await.
  const html = readFileSync(PAGE, 'utf8');
  const block = html.slice(html.lastIndexOf('<script>'), html.lastIndexOf('</script>'));
  assert.match(block, /var myRun = \+\+runId/, 'a run does not take a ticket');
  assert.match(block, /runId\+\+;/, 'cancel does not tear the ticket up');
  // Named positions, not a count. ">= 3" passed with one of the four removed,
  // which is the loosest kind of assertion: it measures quantity where the
  // thing that matters is WHERE they are. Each await needs one after it, or the
  // work resumes into a screen that has been cleared.
  assert.match(block, /for \(var i = 0; i < picked\.length; i\+\+\) \{\s*\n\s*if \(myRun !== runId\) return;/,
    'the loop does not check before doing the next size');
  assert.match(block, /toBlob\(res, 'image\/jpeg', 0\.9\); \}\);\s*\n\s*if \(myRun !== runId\) return;/,
    'the loop does not check after awaiting the blob');
  assert.match(block, /if \(myRun !== runId\) return;\s*\n\s*try \{/,
    'the save runs even when the run was cancelled');
});

test('the label says which of the two things it does', () => {
  // "Cancel" after the files are already saved is a lie about what pressing it
  // will undo. design-rules.md: a label has to describe the state it is in.
  const html = readFileSync(PAGE, 'utf8');
  const block = html.slice(html.lastIndexOf('<script>'), html.lastIndexOf('</script>'));
  assert.match(block, /rz-cancel'\)\.textContent = \$\('rz-out'\)\.children\.length \? 'Start again' : 'Cancel'/);
});

/* ── The resizer's four load-bearing invariants ───────────────────────────── */

/**
 * These are structural, not behavioural: the suite has no DOM, so they assert
 * the shape of the code that produces the behaviour rather than the behaviour
 * itself. Each one is here because breaking it produces a specific wrong
 * picture on screen, and every one was verified live in a browser on
 * 15 September before being written down.
 */
const RESIZER = () => {
  const html = readFileSync(PAGE, 'utf8');
  return html.slice(html.lastIndexOf('<script>'), html.lastIndexOf('</script>'));
};

test('the preview canvas is reset on every draw, so marks cannot accumulate', () => {
  // Assigning canvas.width clears the surface. Without it the old crop
  // rectangle and the old focal circle stay on screen under the new ones, and
  // the picture shows two of everything.
  const b = RESIZER();
  const draw = b.slice(b.indexOf('function drawPreview'), b.indexOf('function pointAt'));
  assert.match(draw, /cv\.width = [^;]+; cv\.height =/, 'drawPreview does not reset the canvas before drawing');
  const resets = draw.indexOf('cv.width ='), paints = draw.indexOf('x.drawImage');
  assert.ok(resets !== -1 && paints !== -1, 'drawPreview no longer resets or no longer paints');
  assert.ok(resets < paints, 'the canvas is reset after the image is drawn, which erases it');
});

test('a new photo recomputes the focal point', () => {
  // Otherwise the second photo is cropped to wherever the first one's subject
  // was, and the file name and the picture disagree.
  const load = RESIZER().slice(RESIZER().indexOf('function load('), RESIZER().indexOf("$('rz-file').addEventListener"));
  assert.match(load, /img = i;\s*focal = findFocalPoint\(i\);/, 'load does not recompute the focal point');
});

test('the crop and the circle are drawn from one focal point, never two', () => {
  // The failure this prevents is the crop sitting somewhere the circle is not,
  // which is the single most confusing thing this screen could show.
  const b = RESIZER();
  const draw = b.slice(b.indexOf('function drawPreview'), b.indexOf('function pointAt'));
  assert.doesNotMatch(draw, /function drawPreview\([^)]+\)/, 'drawPreview takes an argument, so it can be drawn from a second focal point');
  assert.match(draw, /cropBox\(sw, sh, f\.w, f\.h, focal\)/, 'the crop is not computed from cropBox with the focal point');
  assert.match(draw, /x\.arc\(focal\.x \* cv\.width, focal\.y \* cv\.height/, 'the circle is not drawn from focal');
});

test('dragging writes the focal point and redraws, in that order', () => {
  const point = RESIZER().slice(RESIZER().indexOf('function pointAt'), RESIZER().indexOf('var dragging'));
  // Both have to EXIST before their order means anything. `indexOf` returns -1
  // for a missing string, and -1 is less than every real index, so an ordering
  // assertion passes most loudly when the thing it is ordering has been deleted.
  const writes = point.indexOf('focal.x =');
  const redraws = point.indexOf('drawPreview()');
  assert.ok(writes !== -1, 'pointAt no longer writes the focal point');
  assert.ok(redraws !== -1, 'pointAt no longer redraws');
  assert.ok(writes < redraws, 'it redraws before it has moved the point');
  // Both axes, named separately. Checking the pattern appears at all passed
  // with x unclamped, because y still had it: one match is not two.
  assert.match(point, /focal\.x = Math\.min\(1, Math\.max\(0,/, 'the drag is unclamped horizontally');
  assert.match(point, /focal\.y = Math\.min\(1, Math\.max\(0,/, 'the drag is unclamped vertically');
});

test('the page uses the tested geometry rather than its own copy', () => {
  // THE BUG RAJ HIT TWICE was geometric, and every test at the time read the
  // page's source and passed straight through it. The maths now lives in
  // src/preview.js where preview.test.ts runs it with real numbers, and the
  // page gets the same file inlined. This asserts there is one implementation.
  const b = RESIZER();
  const draw = b.slice(b.indexOf('function drawPreview'), b.indexOf('function pointAt'));
  assert.match(draw, /fitPreview\(sw, sh\)/, 'drawPreview computes its own scale again');
  assert.doesNotMatch(draw, /PV_W \/ sw/, 'the scale maths is back in the page');
  assert.equal((b.match(/function cropBox/g) ?? []).length, 1, 'cropBox is defined more than once');
  assert.equal((b.match(/function fitPreview/g) ?? []).length, 1, 'fitPreview is defined more than once');
});

test('the inlined copy of the geometry matches its source', () => {
  // The same rule app.css lives by. A copy edited by hand is two
  // implementations of one thing, drifting from the day it is made.
  /* Minus the export lines, which is exactly what sync-preview.py takes out on
     the way in: a classic script throws on `export` and the web app needs one.
     The guarantee is unchanged, a hand-edited copy still fails; what changed is
     that the transform is now named here instead of the test being deleted. */
  const source = readFileSync(join(import.meta.dirname, '..', 'src', 'preview.js'), 'utf8')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('export '))
    .join('\n')
    .trim();
  const page = readFileSync(PAGE, 'utf8');
  const from = page.indexOf('== preview.js start ==');
  const to = page.indexOf('== preview.js end ==');
  assert.ok(from !== -1 && to !== -1, 'the page has never been synced with sync-preview.py');
  const inlined = page.slice(page.indexOf('*/', from) + 2, page.lastIndexOf('/*', to)).trim();
  assert.equal(inlined, source, 'the page is out of date: run python3 UI/sync-preview.py');
});

test('the preview canvas is not stretched by CSS', () => {
  // Fitting the canvas in script is undone if the stylesheet then stretches it:
  // `width:100%` plus `height:auto` is exactly how the height escaped.
  const css = readFileSync(join(import.meta.dirname, '..', '..', '..', 'UI', 'app.css'), 'utf8');
  const shot = css.slice(css.indexOf('.cropper{'), css.indexOf('}', css.indexOf('.cropper{')));
  // `max-width:100%` contains `width:100%`, so a bare pattern fails on the
  // correct CSS. The boundary is the whole assertion.
  assert.doesNotMatch(shot, /[;{\s]width:\s*100%/, '.shot stretches to its container again');
  assert.match(shot, /max-width:\s*100%/, '.shot cannot shrink on a narrow screen');
});

/* ── The primary action does something ────────────────────────────────────── */

test('the screen\'s one primary button is wired to a handler', () => {
  // "Approve this week" sat here with no handler at all, and by design it only
  // set a flag the per-post Done toggle already sets: the most
  // consequential-sounding word on the screen on the least consequential
  // action. Raj: what does it actually do?
  const html = readFileSync(PAGE, 'utf8');
  const section = html.slice(html.indexOf('<!-- CONTENT & SOCIAL PLANNER -->'), html.indexOf('<!-- FIRST-USE STATES -->'));
  // Two of them: one for the posts, one for the resizer, each the primary of
  // its own block. The rule is not how many there are, it is that every one
  // does something — which is what "Approve this week" did not.
  const primaries = [...section.matchAll(/<button class="btn"[^>]*id="([^"]+)"/g)].map(m => m[1]);
  assert.ok(primaries.length >= 1, 'the screen has no primary action at all');
  assert.ok(primaries.every(id => id), 'a primary button with no id cannot be wired');
  const block = RESIZER();
  for (const id of primaries) {
    // indexOf, not a regex. The regex version reported "no handler" on a button
    // that plainly had one, and I could not tell whether the escaping or the
    // code was wrong — which means the assertion was not earning its place.
    // EVERY mention, not the first. `indexOf` found `$('rz-go').disabled` in
    // refresh() and reported a button with a handler as unwired. Third time
    // today a first-occurrence search has lied: the others were a mutation that
    // hit the wrong screen and a slice that started inside a comment.
    const mentions: number[] = [];
    for (let at = block.indexOf(`('${id}')`); at !== -1; at = block.indexOf(`('${id}')`, at + 1)) mentions.push(at);
    assert.ok(mentions.length > 0, `the primary button #${id} is never referenced in the script`);
    assert.ok(mentions.some(at => block.slice(at, at + 200).includes('addEventListener')),
      `the primary button #${id} has no handler`);
  }
  assert.doesNotMatch(section, /Approve this week/, 'the button that did nothing is back');
});

test('the week it sends is read from the screen, not from a second copy', () => {
  // Two sources for one thing drift from the day they are made. It reads the
  // posts the owner is looking at.
  const block = RESIZER();
  const fn = block.slice(block.indexOf('function weekAsText'), block.indexOf('var send ='));
  assert.match(fn, /#v-content \.posts > \.card/, 'it does not read the posts from the page');
  assert.match(fn, /\[\^\\\]\]\+/, 'it does not collect the blanks');
  assert.doesNotMatch(fn, /Beard sculpting|NearCut/, 'the post text is duplicated into the script');
});

test('a failed save does not lose the words', () => {
  const block = RESIZER();
  const fn = block.slice(block.indexOf("var send = $('wk-send')"), block.indexOf("$('rz-cancel').addEventListener"));
  assert.match(fn, /clipboard\.writeText/, 'if saving fails the week is gone');
  assert.match(fn, /AbortError/, 'cancelling the save dialog is treated as a failure');
});
