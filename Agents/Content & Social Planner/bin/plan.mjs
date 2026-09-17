/**
 * THE APPLICATION. A real site in, a real screen out.
 *
 *   node bin/plan.mjs https://shrewsburybarber.co.uk [--write]
 *
 * Until 15 September there was no file like this. The screen was hand-typed
 * HTML, `src/` was a library of rules, and nothing joined them: zero imports
 * from `src/` in the markup, zero site fetches in `src/`. Every test passed,
 * because a test proves a function works and never that anything calls it.
 *
 * This is the thing that calls them. Fetch, extract, recommend, shape, write,
 * check, render.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractFacts } from '../src/extract.js';
import { write } from '../src/write.js';
import { recommendCadence, validateRecommendation } from '../src/recommend.ts';
import { planDates, slotWeeks, validateShape } from '../src/plan-shape.ts';
import { MIX, CHANNEL, CADENCE_LABEL, ANGLES } from '../src/types.ts';
import { validatePlan } from '../src/guards.ts';
import { renderScreen } from '../src/render.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const UA = 'Mozilla/5.0 (compatible; HILPlannerBot/0.1)';

/**
 * Fetch the home page, then the pages it links to that are most likely to carry
 * prices and services.
 *
 * It used to guess a fixed list of paths. That worked on the barber, whose
 * prices sit at /price-menu, and read exactly one page of a dog groomer whose
 * prices sit at /dog-grooming/ and were therefore invisible. Guessing a path is
 * a claim about a site we have not read. Following its own navigation is not.
 */
export async function readSite(base, opts = {}) {
  const { max = 5, guesses = ['/prices', '/services', '/price-list', '/menu', '/price-menu'] } = opts;
  /* The origin has to come from where we landed, not from what was typed.
     paw-lished.co.uk redirects www to the apex and links to the apex, so an
     origin taken from the typed URL made every one of its own links look like
     another site's, and we read one page of it. */
  const home = await get(new URL(base).origin);
  if (!home) throw new Error(`nothing readable at ${new URL(base).origin}`);
  const origin = new URL(home.url).origin;

  const paths = [...linkedPaths(home.html, origin), ...guesses]
    .filter((p, i, all) => all.indexOf(p) === i && p !== '/')
    .slice(0, max);
  const found = await Promise.all(paths.map((p) => get(origin + p)));
  return [home, ...found.filter(Boolean)];
}

/** Same-origin links whose path or wording suggests services or prices, best first. */
export function linkedPaths(html, origin) {
  const WORTH = /price|pricing|cost|service|treatment|groom|menu|what-we-do|rates|packages|book/i;
  const SKIP = /privacy|terms|cookie|policy|login|account|cart|basket|blog\/|\.(jpg|png|pdf|css|js)$/i;
  const out = [];
  for (const m of html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]{0,120}?)<\/a>/gi)) {
    let path;
    try { path = new URL(m[1], origin); } catch { continue; }
    const same = (u) => new URL(u).host.replace(/^www\./, '') === new URL(origin).host.replace(/^www\./, '');
    if (!same(path)) continue;
    const p = path.pathname;
    if (SKIP.test(p)) continue;
    const text = m[2].replace(/<[^>]+>/g, ' ');
    if (WORTH.test(p) || WORTH.test(text)) out.push(p);
  }
  // A page named for prices before one merely linked as "book".
  return [...new Set(out)].sort((a, b) => Number(/price|cost|rates/i.test(b)) - Number(/price|cost|rates/i.test(a)));
}

async function get(url) {
  try {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': UA } });
    if (!r.ok) return null;
    const html = await r.text();
    return html.length > 400 ? { url: r.url || url, html } : null;
  } catch { return null; }
}

/**
 * Lay the angles over the slots so the mix adds up and nothing repeats.
 * Arithmetic, not judgement: the rules are already in CLAUDE.md 3a.
 */
export function shapeMonth(cadence, ranAt, channels) {
  const dates = planDates(cadence, ranAt);
  const weeks = slotWeeks(cadence);
  const mix = MIX[cadence];
  const order = [];
  for (let i = 0; i < mix.useful; i++) order.push('useful');
  for (let i = 0; i < mix.question; i++) order.push('question');
  for (let i = 0; i < mix.offer; i++) order.push('offer');
  // Spread the questions and the ask through the month rather than bunching them.
  const purposes = new Array(dates.length);
  const spots = { question: spread(mix.question, dates.length, 0.35), offer: spread(mix.offer, dates.length, 0.95) };
  spots.question.forEach((i) => { purposes[i] = 'question'; });
  spots.offer.forEach((i) => { purposes[i] = 'offer'; });
  for (let i = 0; i < dates.length; i++) if (!purposes[i]) purposes[i] = 'useful';

  const byPurpose = {
    useful: ['what-it-costs', 'how-it-works', 'before-after', 'asked-a-lot', 'the-mistake', 'this-week', 'not-for-you'],
    question: ['ask-them', 'the-timing'],
    offer: ['the-ask'],
  };
  const used = {}; let last = null;
  return dates.map((date, i) => {
    const purpose = purposes[i];
    const pool = byPurpose[purpose].filter((a) => a !== last && (used[a] ?? 0) < 3);
    const angle = (pool.length ? pool : byPurpose[purpose])[0];
    used[angle] = (used[angle] ?? 0) + 1; last = angle;
    return { date, week: weeks[i], purpose, angle, channel: channels[i % channels.length] };
  });
}
function spread(n, total, bias) {
  const out = [];
  for (let k = 0; k < n; k++) out.push(Math.min(total - 1, Math.round((k + bias) * (total / Math.max(1, n)))));
  return [...new Set(out)];
}

export async function buildPlan(url, { ranAt = new Date().toISOString(), hoursAWeek = 2, weeksWritten = 1, told } = {}) {
  const pages = await readSite(url);
  const facts = extractFacts(pages, ranAt.slice(0, 10));
  /* `told` is what the owner ticked before we read anything. It wins over what
     the site links, because detection only sees what is on the page: a business
     with an active Instagram and no link to it looks identical to one with no
     Instagram at all, and Canny Cuts is a real example of the first. */
  const seen = facts.channels.map((c) => c.channel);
  const channels = (told && told.length ? told : seen).filter((c) => CHANNEL[c]);
  if (!channels.length) throw new Error('no channels found on the site, so there is nothing to plan for');

  const rec = recommendCadence(facts.known, { hoursAWeek }, channels);
  const slots = shapeMonth(rec.cadence, ranAt, channels);
  const posts = slots.map((s) => (s.week <= weeksWritten ? { ...s, ...write(s, facts) } : s));

  const plan = {
    business: facts.name, cadence: rec.cadence, ranAt, channels, recommendation: rec,
    weeksWritten, voice: facts.voiceSample, posts,
    weeks: [1, 2, 3, 4, 5].map((w) => ({ week: `Week ${w}`, about: '', channels })),
  };
  return { plan, facts, rec };
}

/* Comparing a file:// URL to argv[1] fails whenever the path has a space in
   it, which this one does: the URL is percent-encoded and the argument is not.
   It exited 0 and printed nothing, which looks exactly like success. */
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const url = process.argv[2];
  if (!url) { console.error('usage: node bin/plan.mjs <url> [--channels a,b] [--write|--out <file>]'); process.exit(2); }
  /* A site that will not load is an ordinary outcome, not a crash. It printed a
     node stack trace, which tells whoever ran it nothing they can act on. */
  const chAt = process.argv.indexOf('--channels');
  const told = chAt > -1 ? String(process.argv[chAt + 1] || '').split(',').map((x) => x.trim()).filter(Boolean) : undefined;
  let built;
  try {
    built = await buildPlan(url, { ranAt: '2026-09-14T09:00:00.000Z', told });
  } catch (err) {
    console.error(`\ncould not plan for ${url}\n  ${err.message}`);
    process.exit(1);
  }
  const { plan, facts, rec } = built;

  const shape = validateShape(plan);
  const recProblems = validateRecommendation(rec);
  const written = { ...plan, posts: plan.posts.filter((p) => p.words) };
  const html = renderScreen(plan, facts);
  const checks = validatePlan(written, facts.known, html.replace(/<[^>]+>/g, ' '));

  console.log(`\n${facts.name}  ${facts.pages.length} page(s) read, ${facts.readAt}`);
  console.log(`channels: ${plan.channels.join(', ')}   cadence: ${CADENCE_LABEL[rec.cadence]}   posts: ${plan.posts.length}`);
  console.log(`prices read: ${Object.keys(facts.known.prices).length}   services: ${facts.known.services.length}`);
  console.log(`\nshape problems      : ${shape.length ? JSON.stringify(shape) : 'none'}`);
  console.log(`recommendation      : ${recProblems.unsourced.length + recProblems.promised.length ? JSON.stringify(recProblems) : 'clean'}`);
  console.log(`invented claims     : ${checks.perPost.flatMap((p) => p.invented).length}`);
  console.log(`unearned inference  : ${checks.overdue.length} overdue words, ${checks.buildDetail.length} build words`);

  /* --out writes the same screen somewhere else, so a second business can be
     looked at without touching the shared page or displacing the first. */
  const outAt = process.argv.indexOf('--out');
  const page = join(HERE, '..', '..', '..', 'UI', 'workspace.html');
  if (process.argv.includes('--write') || outAt > -1) {
    const src = readFileSync(page, 'utf8');
    const a = src.indexOf('      <!-- CONTENT & SOCIAL PLANNER -->');
    const b = src.indexOf('      <!-- FIRST-USE STATES -->');
    const built = src.slice(0, a) + html + '\n' + src.slice(b);
    const to = outAt > -1 ? process.argv[outAt + 1] : page;
    if (!to) { console.error('--out needs a file to write to'); process.exit(2); }
    writeFileSync(to, built);
    console.log(`\nwritten into ${to}`);
  } else {
    console.log('\n(dry run. pass --write to put it on the screen, or --out <file>)');
  }
}
