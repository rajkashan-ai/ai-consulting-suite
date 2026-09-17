/** The whole run from one URL.  node run.mjs [url]  →  UI/live.html */
import { writeFile } from 'node:fs/promises';
import { buildProfile, pagePathsFrom, pricePagePath } from './src/profile.ts';
import { fetchPage, isFetched } from './src/fetch-pages.ts';
import { renderTracker, unread } from './src/render.ts';
import { readFile } from 'node:fs/promises';
import { buildSearchTerms, candidatesFromSearch } from './src/search-visibility.ts';
import { planFor, coreServiceWords } from './src/discovery-routes.ts';
import { fetchAll } from './src/fetch-pages.ts';
import { venueFrom, comparableTo } from './src/venue.ts';
import { report } from './evals/score.ts';

const INPUT = process.argv[2] ?? 'https://shrewsburybarber.co.uk/';
const t0 = Date.now();

const home = await fetchPage(INPUT);
if (!isFetched(home)) { console.error('could not read the site:', home); process.exit(1); }
const path = pricePagePath(pagePathsFrom(home.html));
const price = path ? await fetchPage(new URL(home.url).origin + path) : null;
const r = buildProfile(home.html, price && isFetched(price) ? price.html : '', INPUT);
if (!r.ok) { console.error('no profile. Missing:', r.missing.join(', ')); process.exit(1); }

// The headline service is the dearest single cut — the one a price comparison
// is actually about. Named here rather than assumed to be the first row.
const single = r.services.filter(s => !/&|and/i.test(s.name));
const headline = single.length ? Math.max(...single.map(s => s.price)) : undefined;

// ---- discovery -------------------------------------------------------------
const plan = planFor(r.profile.trade);
const terms = buildSearchTerms(r.profile);
let candidates = [];
let discoveryNote = '';
if (plan.cannotProceed) {
  discoveryNote = plan.cannotProceed;
} else {
  const { seen } = JSON.parse(await readFile(new URL('./search-results.json', import.meta.url), 'utf8'));
  candidates = candidatesFromSearch(seen, r.profile, []).slice(0, 5);
  discoveryNote = `${terms.length} searches, ${candidates.length} businesses found on ${plan.usable.map(u => u.host).join(' and ')}`;
}

// ---- read each competitor, in parallel ------------------------------------
// Six businesses in series is six round trips of waiting. Failures come back
// beside successes: one we could not read is a finding, never a shorter list.
const pages = await fetchAll(candidates.map(c => c.url));
const venues = candidates.map((c, i) => {
  const page = pages[i];
  return isFetched(page) ? { c, v: venueFrom(page.html), readOn: page.readOn } : { c, failed: page.failed };
});

// WHICH SERVICE THE COMPARISON IS ABOUT.
//
// Anchoring on the customer's dearest service picked "Beard Sculpting £20" and
// so compared beards, when the screen is about haircuts. Anchoring on the
// cheapest would pick the £8 clipper cut. Both are guesses about what matters.
//
// The comparable service is the one the market actually has in common: for each
// of the customer's services, count how many competitors offer something like
// it, and take the one most of them share. That is decided by the market rather
// than by us, and it is the same rule for a barber, a salon or a plumber.
// A plain service anchors the comparison, not a combined one. Anchoring on
// "Classic Cut & Beard Trim" made every match a two-job service and pushed
// HINCES from £35 to £40 — inflating every competitor at once.
const isCombined = (n) => /\binc\b|\band\b|&/i.test(n);
const core = coreServiceWords(r.profile.trade);
const candidatesForAnchor = (core ? r.services.filter(s =>
  core.some(w => s.name.toLowerCase().includes(w))) : []).filter(s => !isCombined(s.name));
// Dearest of the plain core services: a barber's standard cut, not the £8
// clipper trim that undercuts every comparison.
const ourHeadline = candidatesForAnchor.sort((a, b) => b.price - a.price)[0] ?? null;
const sharedBy = ourHeadline
  ? venues.filter(x => x.v && comparableTo(ourHeadline.name, x.v.services, core)).length : 0;
const anchorNote = ourHeadline
  ? `${ourHeadline.name} £${ourHeadline.price} — the core job for a ${r.profile.trade}, offered by ${sharedBy} of ${venues.length}`
  : `we have not recorded what job a ${r.profile.trade} is judged on, so no price is compared`;

const read = venues.map(x => x.failed ? x
  : { ...x, match: ourHeadline ? comparableTo(ourHeadline.name, x.v.services, core) : null });

const NOT_BUILT = 'Discovery is not built yet, so no competitor has been read';
const view = {
  profile: r.profile, services: r.services, street: r.street, postcode: r.postcode,
  readOn: home.readOn, sourceUrl: INPUT, nextCheck: 'Runs once a week',
  reviewsAboutYou: 0,
  reviewsAcrossTheFive: read.filter(x => x.v).reduce((n, x) => n + (x.v.reviewCount ?? 0), 0) || unread(NOT_BUILT),
  searchesAppearedIn: unread('Search is not built yet'),
  ownHeadlinePrice: ourHeadline ? ourHeadline.price : unread('no single-service price found'),
  medianOfTheFive: (() => {
    const p = read.filter(x => x.match).map(x => x.match.high).sort((a, b) => a - b);
    return p.length ? p[Math.floor(p.length / 2)] : unread('no comparable prices read');
  })(),
  competitors: read.length
    ? read.map(x => x.failed
        ? { name: x.c.name, headlinePrice: unread(`their page returned ${x.failed}`), where: 'not read' }
        : {
            name: x.v.name ?? x.c.name,
            headlinePrice: x.match ? x.match.high : unread('no service comparable to yours on their menu'),
            where: `${x.v.reviewCount?.toLocaleString('en-GB') ?? '?'} reviews at ${x.v.rating ?? '?'}`,
            source: `${new URL(x.c.url).hostname.replace(/^www\./, '')} · ${x.readOn}`,
          })
    : [unread(discoveryNote)],
  ahead: [], behind: [],
  actions: [unread('An action has to rest on a number above. None of them can be read yet.')],
  checked: [
    { what: 'Their own website', note: `${new URL(INPUT).hostname} — name, trade and address from schema.org` },
    { what: 'Their price page', note: `${r.services.length} services with a published price` },
    { what: 'Where this trade lists itself', note: `${plan.shape} — ${plan.usable.map(u => u.host).join(', ') || 'no readable source'}` },
    { what: 'Search for competitors', note: discoveryNote },
    { what: 'What the prices compare', note: anchorNote },
  ],
  notChecked: [
    { what: 'Each competitor\u2019s own page', note: 'Found, but not yet fetched for prices and reviews' },
    ...plan.blocked.map(b => ({ what: b.host, note: 'Refused us when we asked, measured ' + b.checkedOn })),
    { what: 'Reviews, and who they name', note: 'No review source read' },
    { what: 'Google', note: 'Readable but not storable, so it cannot join the weekly comparison' },
  ],
};

await writeFile(new URL('../../UI/live.html', import.meta.url), renderTracker(view));
console.log(`${r.profile.name} — ${r.profile.trade} in ${r.profile.town}, ${r.services.length} priced services, ${Date.now()-t0}ms\n`);
// Score the whole run, not the convenient half of it. The first version passed
// only the profile, so "Competitors identified 0/5" was reported while
// discovery had in fact found three — the scorer was being shown less than the
// run produced, which flatters nothing but hides progress.
console.log(report({
  profile: r.profile,
  services: r.services,
  competitors: read.filter(x => x.v).map(x => ({
    name: x.v.name ?? x.c.name,
    headlinePrice: x.match ? x.match.high : undefined,
  })),
  headlines: {
    reviewsAboutTheCustomer: view.reviewsAboutYou,
    reviewsAcrossTheFive: typeof view.reviewsAcrossTheFive === 'number' ? view.reviewsAcrossTheFive : undefined,
    ownClassicCut: typeof view.ownHeadlinePrice === 'number' ? view.ownHeadlinePrice : undefined,
    medianClassicCutAcrossTheFive: typeof view.medianOfTheFive === 'number' ? view.medianOfTheFive : undefined,
  },
}));

console.log('\n  read from each competitor:');
for (const x of read) {
  console.log('   ' + (x.v?.name ?? x.c.name).padEnd(28) +
    (x.failed ? x.failed
      : `${String(x.v.reviewCount ?? '?').padStart(5)} reviews at ${x.v.rating ?? '?'}   ` +
        (x.match ? `${x.match.name} £${x.match.high}` : 'no comparable service')));
}
