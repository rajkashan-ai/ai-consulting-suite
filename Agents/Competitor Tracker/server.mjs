/**
 * The bit that makes it a tool rather than a script.
 *
 *   node server.mjs            then open http://localhost:8788/?url=<site>
 *
 * First visit for a business: the skeleton goes out immediately, the research
 * starts, the page polls until it is done and reloads into the real screen.
 * Inside the week: the stored run is rendered straight away, no waiting.
 */
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { runFor } from './src/pipeline.ts';
import { renderTracker, renderSkeleton, unread } from './src/render.ts';
import { Store, freshnessOf, keyFor } from './src/store.ts';
import { changesBetween, say, summarise } from './src/changes.ts';

const PORT = Number(process.env.PORT ?? 8788);
// fileURLToPath, never .pathname. A URL percent-encodes, so on a path with a
// space in it — "AI Consulting for Small Businesses" — .pathname hands back
// "AI%20Consulting..." and the store quietly writes to a directory of that
// literal name. It reads back fine, because load uses the same wrong path, so
// nothing fails: the data is just somewhere nobody would look for it.
const store = new Store(fileURLToPath(new URL('./data/', import.meta.url)));

/** In-flight runs, so two tabs on the same business do not start two runs. */
const running = new Map();

async function searchResults() {
  const { seen } = JSON.parse(await readFile(new URL('./search-results.json', import.meta.url), 'utf8'));
  return seen;
}

function startRun(input) {
  if (running.has(keyFor(input))) return running.get(keyFor(input));
  const state = { step: 'Starting', done: 0, of: 5, error: null };
  const promise = (async () => {
    const previous = await store.load(input);
    const result = await runFor(input, await searchResults(), p => Object.assign(state, p));
    if (!result.ok) { state.error = result.stopped; return null; }
    const changes = changesBetween(previous?.run?.snapshot ?? null, result.snapshot);
    await store.save(input, { result, snapshot: result.snapshot, changes,
                              comparedTo: previous?.ranAt ?? null });
    return result;
  })().finally(() => setTimeout(() => running.delete(keyFor(input)), 2000));
  running.set(keyFor(input), { state, promise });
  return running.get(keyFor(input));
}

function viewFrom(stored) {
  const { result, changes, comparedTo } = stored.run;
  const p = result.profile;
  const totalReviews = result.competitors.reduce((n, c) => n + (c.reviewCount ?? 0), 0);
  const prices = result.competitors.map(c => c.match?.high).filter(n => typeof n === 'number').sort((a, b) => a - b);
  return {
    profile: p, services: result.services, street: result.street, postcode: result.postcode,
    readOn: stored.ranAt.slice(0, 10), sourceUrl: stored.input,
    nextCheck: summarise(changes, comparedTo),
    reviewsAboutYou: 0,
    reviewsAcrossTheFive: totalReviews || unread('no competitor could be read'),
    searchesAppearedIn: unread('search visibility is not built yet'),
    ownHeadlinePrice: result.anchor ? result.anchor.price : unread('no core service priced'),
    medianOfTheFive: prices.length ? prices[Math.floor(prices.length / 2)] : unread('no comparable prices read'),
    competitors: result.competitors.map(c => c.unread
      ? { name: c.name, headlinePrice: unread(c.unread), where: 'not read' }
      : { name: c.name, headlinePrice: c.match ? c.match.high : unread('no service comparable to yours'),
          where: `${c.reviewCount?.toLocaleString('en-GB') ?? '?'} reviews at ${c.rating ?? '?'}`,
          source: `${new URL(c.url).hostname.replace(/^www\./, '')} · ${stored.ranAt.slice(0, 10)}` }),
    ahead: [], behind: [],
    actions: changes.length
      ? changes.slice(0, 3).map(c => ({ area: 'What moved', headline: say(c), why: `Compared against the run on ${String(comparedTo).slice(0, 10)}.` }))
      : [unread('An action has to rest on a number above. The findings step is not built yet.')],
    checked: [
      { what: 'Their own website', note: `${new URL(stored.input).hostname} — name, trade and address` },
      { what: 'Their price page', note: `${result.services.length} services with a published price` },
      { what: 'Where this trade lists itself', note: `${result.plan.shape} — ${result.plan.usable.map(u => u.host).join(', ')}` },
      { what: 'Search for competitors', note: result.discoveryNote },
      { what: 'What the prices compare', note: result.anchorNote },
    ],
    notChecked: [
      { what: 'Reviews about you', note: 'No review source for the customer has been read yet' },
      ...result.plan.blocked.map(b => ({ what: b.host, note: `Refused us, measured ${b.checkedOn}` })),
    ],
  };
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const input = url.searchParams.get('url');
  const send = (code, type, body) => { res.writeHead(code, { 'content-type': type + '; charset=utf-8' }); res.end(body); };

  if (url.pathname === '/app.css') {
    return send(200, 'text/css', await readFile(fileURLToPath(new URL('../../UI/app.css', import.meta.url)), 'utf8'));
  }

  if (url.pathname === '/api/status') {
    const job = running.get(keyFor(input ?? ''));
    if (job) return send(200, 'application/json', JSON.stringify({ state: 'running', ...job.state }));
    const stored = await store.load(input ?? '');
    return send(200, 'application/json', JSON.stringify({ state: stored ? 'ready' : 'idle' }));
  }

  if (url.pathname !== '/') return send(404, 'text/plain', 'not found');
  if (!input) return send(400, 'text/html', '<p>Add ?url=https://example.co.uk to the address.</p>');

  const stored = await store.load(input);
  const fresh = freshnessOf(stored);
  if (fresh.state === 'fresh') return send(200, 'text/html', renderTracker(viewFrom(stored)));

  // Nothing held, or older than a week: start the run and show the skeleton.
  const job = startRun(input);
  if (job.state.error) return send(200, 'text/html', `<link rel="stylesheet" href="/app.css">
    <div class="band band--a band--first"><div class="band__in">
      <h1 class="t-page">We could not run this</h1><p class="t-lead">${job.state.error}</p></div></div>`);
  return send(200, 'text/html', renderSkeleton(new URL(input).hostname));
}).listen(PORT, () => console.log(`http://localhost:${PORT}/?url=https://shrewsburybarber.co.uk/`));
