/**
 * The two pages carry the same stylesheet.
 *
 * On 14 September the landing page and the workspace had drifted to 19 font
 * sizes and 21 tracking values between them, including -.010em and -.01em as
 * two rules for the same number. Neither file was wrong on its own. Nothing had
 * ever compared them, so nothing ever caught it.
 *
 * This compares them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const UI = join(import.meta.dirname, '..', '..', '..', 'UI');
const PAGES = ['workspace.html', 'landing-page.html'];
const read = (f: string) => readFileSync(join(UI, f), 'utf8');

const MARKERS = /\/\* == app\.css start ==.*?== app\.css end == \*\//s;

test('every page carries the app.css block', () => {
  for (const p of PAGES) assert.match(read(p), MARKERS, `${p} has never been synced`);
});

test('the two copies are byte-identical to each other', () => {
  const [a, b] = PAGES.map(p => read(p).match(MARKERS)![0]);
  assert.equal(a, b, 'the pages carry different stylesheets');
});

test('and identical to app.css itself', () => {
  // The check mode exits 1 when a page is stale, so this fails loudly rather
  // than silently passing on a copy nobody updated.
  execFileSync('python3', ['sync-styles.py', '--check'], { cwd: UI });
});

test('eight font sizes, no more', () => {
  const sizes = new Set([...read('app.css').matchAll(/font-size:\s*([\d.]+)px/g)].map(m => m[1]));
  assert.equal(sizes.size, 8, `${sizes.size} sizes: ${[...sizes].join(', ')}`);
});

test('three weights, and none of them 700', () => {
  const w = new Set([...read('app.css').matchAll(/font-weight:\s*(\d+)/g)].map(m => m[1]));
  assert.deepEqual([...w].sort(), ['400', '500', '600']);
});

test('the browser\'s bold default is overridden, or 700 gets in through a tag', () => {
  // The test above reads the weights DECLARED in app.css. A browser default is
  // declared nowhere, so <strong> and <b> rendered at 700 and nothing saw it.
  // Found on 15 September by measuring the rendered page instead of the file:
  // seven elements across the two screens, five of them predating the rule.
  // Anchored to the start of a line, so it demands a TOP-LEVEL reset. The first
  // version of this assertion was itself satisfied by ".tablewrap td strong",
  // which only covers table cells, and so it passed while the defect stood.
  assert.match(read('app.css'), /^(?:strong|b)\s*(?:,\s*(?:strong|b)\s*)*\{[^}]*font-weight:\s*600/m,
    'nothing resets the bold default, so every <strong> outside a table is 700');
});

test('a modifier used on its own still gets its family\'s box', () => {
  // .btn--ghost and .btn--sm are modifiers by name and standalone in the markup,
  // so for weeks they inherited none of .btn's box and every secondary button in
  // the product drew at radius 0. It looked like a decision. A grouped rule is
  // the fix, because a modifier that only works when somebody remembers to add
  // the base class is the same trap wearing a hat.
  const css = read('app.css');
  assert.match(css, /^\.btn,\.btn--ghost,\.btn--sm\{[^}]*border-radius/m,
    'the button family does not share a box, so a standalone modifier has none');

  // And the general form: any --modifier used without its base in the markup has
  // to be grouped with that base somewhere, or it silently gets nothing.
  const bad: string[] = [];
  for (const p of PAGES) {
    for (const m of read(p).matchAll(/class="([^"]+)"/g)) {
      const names = m[1].split(/\s+/);
      for (const n of names) {
        const base = n.includes('--') ? n.slice(0, n.indexOf('--')) : null;
        if (!base || names.includes(base)) continue;
        // Only when the base is a real rule. `.kind--good` sits beside `.t-kind`
        // and there is no `.kind` to inherit from, so its prefix is a name and
        // not a base: nothing is silently lost. `.btn` does exist, which is why
        // `.btn--ghost` standing alone was a real bug and this one is not.
        if (!new RegExp(`(?:^|[,\\s])\\.${base}\\s*[,{:]`, 'm').test(css)) continue;
        const grouped = new RegExp(`(?:^|[,\\s])\\.${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,[^{]*\\.${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'm');
        if (!grouped.test(css) && !bad.includes(n)) bad.push(n);
      }
    }
  }
  assert.deepEqual(bad, [], `used without their base and grouped with nothing: ${bad.join(', ')}`);
});

test('no spacing value off the 4px step', () => {
  const css = read('app.css');
  const off: string[] = [];
  for (const m of css.matchAll(/(?:padding|margin|gap)[^:]*:\s*([^;}]+)/g)) {
    for (const v of m[1].matchAll(/(\d+)px/g)) {
      const n = Number(v[1]);
      // 1, 2 and 3px are borders and small radii, which Stripe also exempts.
      if (n > 3 && n % 4 !== 0) off.push(`${n}px in "${m[0].trim().slice(0, 40)}"`);
    }
  }
  assert.deepEqual(off, []);
});

test('exactly one any-hover block, so a missing wrapper cannot hide', () => {
  assert.equal((read('app.css').match(/@media \(any-hover:hover\)/g) ?? []).length, 1);
});

test('no heading is styled by tag or through a descendant', () => {
  const css = read('app.css');
  const bad = [...css.matchAll(/^\s*\.[\w-]+ h[1-6]\s*\{/gm)].map(m => m[0].trim());
  assert.deepEqual(bad, [], 'a descendant heading rule is back');
});

test('every heading in the markup carries a type class', () => {
  for (const p of PAGES) {
    const naked = [...read(p).matchAll(/<h[1-6](?![^>]*class="[^"]*t-)[^>]*>/g)].map(m => m[0]);
    assert.deepEqual(naked, [], `${p} has headings with no t- class`);
  }
});

test('no inline style attribute in the workspace', () => {
  // 31 of them were how the system was lost the first time.
  assert.deepEqual([...read('workspace.html').matchAll(/\sstyle="/g)].map(m => m[0]), []);
});

test('no rule declares the same property twice, which silently kills the first', () => {
  // Written after the third source-order bug in this file in three days, and
  // the only one that was self-inflicted while fixing the other two. A
  // scrolling-shadow `background` stack was added at the top of `.tablewrap`
  // and a plain `background:var(--card)` was already sitting at the bottom of
  // the same rule. Same specificity, later wins, four gradient layers computed
  // to nothing. Nothing rendered wrong enough to notice by eye.
  const css = readFileSync(join(UI, 'app.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');                  // comments can hold anything
  const offenders: string[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selector = m[1].trim().split('\n').pop()!.trim();
    if (selector.startsWith('@')) continue;             // at-rule preludes, not declarations
    const seen = new Set<string>();
    for (const decl of m[2].split(';')) {
      const prop = decl.split(':')[0]?.trim();
      // A shorthand and its longhand are a different question; only flag the
      // identical property, which is never deliberate here.
      if (!prop || prop.startsWith('--') || decl.includes('(')  && !decl.includes(':')) continue;
      if (seen.has(prop)) offenders.push(`${selector} declares ${prop} twice`);
      seen.add(prop);
    }
  }
  assert.deepEqual(offenders, []);
});
