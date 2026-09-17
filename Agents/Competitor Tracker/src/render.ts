/**
 * Draw the Competitor Tracker from data.
 *
 * The first version of this file invented a small three-section page instead of
 * rendering the screen we already designed, and Raj's verdict was the right one:
 * "looks and works nothing like the one we built". This produces the same five
 * bands in the same order with the same classes, so the only difference between
 * a hand-built screen and a run is where the values came from.
 *
 * A value the run could not read is rendered as an explicit unread state in the
 * place it would have occupied — never omitted, never left blank, never filled
 * with something plausible. A screen that quietly drops what it could not find
 * is how a run built on a hole looks finished.
 */
import type { SearchProfile } from './search-visibility.ts';
import type { PricedService } from './profile.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface Unread { why: string }
export const unread = (why: string): Unread => ({ why });
const isUnread = (v: unknown): v is Unread => typeof v === 'object' && v !== null && 'why' in (v as any);

export interface Competitor { name: string; headlinePrice?: number | Unread; where?: string; source?: string }

export interface RunView {
  profile: SearchProfile;
  services: PricedService[];
  street?: string; postcode?: string;
  readOn: string; sourceUrl: string; nextCheck: string;
  reviewsAboutYou: number | Unread;
  reviewsAcrossTheFive: number | Unread;
  searchesAppearedIn: string | Unread;
  ownHeadlinePrice: number | Unread;
  medianOfTheFive: number | Unread;
  competitors: (Competitor | Unread)[];
  ahead: { text: string; note?: string }[];
  behind: { text: string; note?: string }[];
  actions: ({ area: string; headline: string; why: string } | Unread)[];
  checked: { what: string; note: string }[];
  notChecked: { what: string; note: string }[];
}

/** One stat tile. An unread figure shows a dash and says why underneath, in the
 *  slot the number would have filled, so the shape of the screen tells you what
 *  is missing without reading a word. */
function stat(v: number | string | Unread, unit: string, label: string, note: string, bad = false): string {
  const missing = isUnread(v);
  const fig = missing ? '&mdash;' : esc(String(v));
  return `<div class="stat${bad && !missing ? ' stat--bad' : ''}">
          <span class="stat__figure">${fig}${unit && !missing ? `<span class="unit"> ${esc(unit)}</span>` : ''}</span>
          <span class="stat__label t-kind">${esc(label)}</span>
          <span class="stat__note t-meta">${esc(missing ? (v as Unread).why : note)}</span>
        </div>`;
}

const li = (t: { text: string; note?: string }) =>
  `<li>${esc(t.text)}${t.note ? `<span class="note">${esc(t.note)}</span>` : ''}</li>`;

function competitorRow(c: Competitor | Unread): string {
  if (isUnread(c)) {
    return `<tr><td colspan="4"><span class="t-kind kind--bad">Not read</span> ${esc(c.why)}</td></tr>`;
  }
  const price = isUnread(c.headlinePrice) ? `<span class="t-meta">${esc(c.headlinePrice.why)}</span>`
    : c.headlinePrice === undefined ? '<span class="t-meta">not read</span>' : `&pound;${c.headlinePrice}`;
  return `<tr><td><strong>${esc(c.name)}</strong></td><td>${price}</td>` +
         `<td>${esc(c.where ?? 'not read')}<span class="note">${esc(c.source ?? '')}</span></td><td>${price}</td></tr>`;
}

function actionCard(a: RunView['actions'][number], i: number): string {
  if (isUnread(a)) {
    return `<div class="action">
            <span class="action__no">${i + 1}</span>
            <span class="action__area t-kind">Not built yet</span>
            <h3 class="t-sub">No action can be written yet</h3>
            <p class="action__why t-doc u-wide">${esc(a.why)}</p>
          </div>`;
  }
  return `<div class="action">
            <span class="action__no">${i + 1}</span>
            <span class="action__area t-kind">${esc(a.area)}</span>
            <h3 class="t-sub">${esc(a.headline)}</h3>
            <p class="action__why t-doc u-wide">${esc(a.why)}</p>
          </div>`;
}

export function renderTracker(r: RunView): string {
  const host = new URL(r.sourceUrl).hostname;
  return `<title>${esc(r.profile.name)} &middot; Competitor Tracker</title>
<link rel="stylesheet" href="/app.css">
<div class="app">
  <!-- Bare <header>, styled by element in app.css, and no .mock banner: that
       class is defined in the mockup's own <style> block and is documented
       there as furniture that will never ship. A renderer that used it would
       be carrying mockup scaffolding into the product. Found by the test
       below that asserts every class here exists in the stylesheet. -->
  <header><span class="logo"><i></i>Suite</span><span class="t-meta">${esc(r.profile.name)}</span></header>
  <main><section>

    <div class="band band--a band--first"><div class="band__in">
      <h1 class="t-page">Competitor Tracker</h1>
      <p class="t-lead">Where you stand against the five nearest you in ${esc(r.profile.town)}.</p>
      <div class="stats">
        ${stat(r.reviewsAboutYou, isUnread(r.reviewsAcrossTheFive) ? '' : `of ${r.reviewsAcrossTheFive}`,
               'Reviews about you', 'counted on the platforms we can read', true)}
        ${stat(r.searchesAppearedIn, '', 'Searches you come up in', 'of the searches a customer would run')}
        ${stat(r.ownHeadlinePrice === undefined ? unread('no headline service found') : r.ownHeadlinePrice,
               '', 'Your headline price',
               isUnread(r.medianOfTheFive) ? '' : `Median across the five is £${r.medianOfTheFive}`)}
      </div>
      <div class="strip">
        <strong>Checked ${esc(r.readOn)}</strong>
        <span>We look once a week, so this is the same answer you will see all week.</span>
        <span class="t-meta">${esc(r.nextCheck)}</span>
      </div>
    </div></div>

    <div class="band band--b"><div class="band__in">
      <div class="pair">
        <div class="pair__col">
          <h3 class="t-card card__head"><span class="t-kind kind--good kind--block">Ahead</span>Where you are winning</h3>
          <ul>${r.ahead.length ? r.ahead.map(li).join('') : '<li>Nothing can be said yet<span class="note">This needs the five competitors read</span></li>'}</ul>
        </div>
        <div class="pair__col">
          <h3 class="t-card card__head"><span class="t-kind kind--bad kind--block">Behind</span>Where they are winning</h3>
          <ul>${r.behind.length ? r.behind.map(li).join('') : '<li>Nothing can be said yet<span class="note">This needs the five competitors read</span></li>'}</ul>
        </div>
      </div>
    </div></div>

    <div class="band band--a"><div class="band__in">
      <h2 class="t-section">The five, side by side</h2>
      <p class="t-doc-sm">Your own prices came off your price page in this run. Competitor rows are filled once discovery is built.</p>
      <div class="tablewrap"><table>
        <thead><tr><th>Business</th><th>Prices published</th><th>Where</th><th>Headline</th></tr></thead>
        <tbody>
          <tr class="row-you"><td><strong>You</strong></td>
            <td><ul class="cell-list">${r.services.map(s => `<li>${esc(s.name)} &pound;${s.price}</li>`).join('')}</ul></td>
            <td>A full menu on your own site<span class="note">${esc(host)} &middot; ${esc(r.readOn)}</span></td>
            <td>${isUnread(r.ownHeadlinePrice) ? '&mdash;' : `&pound;${r.ownHeadlinePrice}`}</td></tr>
          ${r.competitors.map(competitorRow).join('\n          ')}
        </tbody>
      </table></div>
    </div></div>

    <div class="band band--dark"><div class="band__in">
      <h2 class="t-section">Three ways to get ahead</h2>
      <p class="t-doc-sm u-wide">Ranked by impact, and every one comes from a number above rather than an opinion.</p>
      <div class="actions">${r.actions.map(actionCard).join('')}</div>
    </div></div>

    <div class="band band--a band--last"><div class="band__in">
      <h2 class="t-section">What we looked at</h2>
      <div class="pair">
        <div class="pair__col">
          <h3 class="t-card card__head">Checked, ${esc(r.readOn)}</h3>
          <ul>${r.checked.map(x => `<li>${esc(x.what)}<span class="note">${esc(x.note)}</span></li>`).join('')}</ul>
        </div>
        <div class="pair__col">
          <h3 class="t-card card__head">Not checked</h3>
          <ul>${r.notChecked.map(x => `<li><span class="tag tag--cant">Not yet</span>${esc(x.what)}<span class="note">${esc(x.note)}</span></li>`).join('')}</ul>
        </div>
      </div>
    </div></div>

  </section></main>
</div>`;
}


/* ── The screen before the data arrives ───────────────────────────────────── */

/**
 * The skeleton, with every fixed part of the page already in place.
 *
 * It is the real page with the real headings, bands and table, and grey blocks
 * where values will land. That matters more than a spinner: a user who can see
 * the shape of what is coming knows the thing is working and roughly what they
 * will get, and the swap at the end moves nothing around.
 *
 * The progress line says what is being read right now, and the clock counts up
 * rather than down. A countdown has to guess a total and is then wrong twice —
 * once when it finishes early and once when it runs past zero, which reads
 * exactly like a crash. A number that keeps rising cannot be wrong, and it is
 * the only honest way to say "still going".
 */
export function renderSkeleton(business: string): string {
  const bar = (w: string) => `<span class="sk" style="width:${w}"></span>`;
  return `<title>${esc(business)} &middot; Competitor Tracker</title>
<link rel="stylesheet" href="/app.css">
<style>
  /* Skeleton furniture only. Deliberately not in app.css: it exists to be
     removed the moment the data lands, and nothing in the product uses it. */
  .sk{display:inline-block;height:1em;vertical-align:-.15em;border-radius:4px;
      background:linear-gradient(90deg,var(--card-2) 25%,var(--line) 37%,var(--card-2) 63%);
      background-size:400% 100%;animation:sk 1.4s ease infinite}
  @keyframes sk{0%{background-position:100% 50%}100%{background-position:0 50%}}
  @media (prefers-reduced-motion:reduce){.sk{animation:none}}
  .waiting{display:flex;gap:var(--s3);align-items:baseline;flex-wrap:wrap}
  .waiting__clock{font-variant-numeric:tabular-nums;font-weight:600}
</style>
<div class="app">
  <header><span class="logo"><i></i>Suite</span><span class="t-meta">${esc(business)}</span></header>
  <main><section>
    <div class="band band--a band--first"><div class="band__in">
      <h1 class="t-page">Competitor Tracker</h1>
      <p class="t-lead">Reading the businesses you are up against. Nothing here is guessed, so it takes a moment.</p>
      <div class="strip waiting" role="status" aria-live="polite">
        <strong id="step">Starting</strong>
        <span class="t-meta" id="detail">We are reading your website first, then your competitors.</span>
        <span class="t-meta waiting__clock" id="clock">0s</span>
      </div>
      <div class="stats">
        <div class="stat"><span class="stat__figure">${bar('3ch')}</span><span class="stat__label t-kind">Reviews about you</span></div>
        <div class="stat"><span class="stat__figure">${bar('3ch')}</span><span class="stat__label t-kind">Searches you come up in</span></div>
        <div class="stat"><span class="stat__figure">${bar('3ch')}</span><span class="stat__label t-kind">Your headline price</span></div>
      </div>
    </div></div>
    <div class="band band--b"><div class="band__in"><div class="pair">
      <div class="pair__col"><h3 class="t-card card__head">Where you are winning</h3>
        <ul><li>${bar('80%')}</li><li>${bar('65%')}</li></ul></div>
      <div class="pair__col"><h3 class="t-card card__head">Where they are winning</h3>
        <ul><li>${bar('75%')}</li><li>${bar('60%')}</li></ul></div>
    </div></div></div>
    <div class="band band--a"><div class="band__in">
      <h2 class="t-section">The five, side by side</h2>
      <div class="tablewrap"><table>
        <thead><tr><th>Business</th><th>Prices published</th><th>Where</th><th>Headline</th></tr></thead>
        <tbody>${[0,1,2,3,4,5].map(() =>
          `<tr><td>${bar('9ch')}</td><td>${bar('12ch')}</td><td>${bar('11ch')}</td><td>${bar('4ch')}</td></tr>`).join('')}
        </tbody></table></div>
    </div></div>
    <div class="band band--dark"><div class="band__in">
      <h2 class="t-section">Three ways to get ahead</h2>
      <div class="actions">${[1,2,3].map(n =>
        `<div class="action"><span class="action__no">${n}</span><h3 class="t-sub">${bar('16ch')}</h3>
         <p class="action__why t-doc u-wide">${bar('90%')}</p></div>`).join('')}</div>
    </div></div>
    <div class="band band--a band--last"><div class="band__in">
      <h2 class="t-section">What we looked at</h2>
      <div class="pair">
        <div class="pair__col"><h3 class="t-card card__head">Checked</h3><ul><li>${bar('70%')}</li><li>${bar('55%')}</li></ul></div>
        <div class="pair__col"><h3 class="t-card card__head">Not checked</h3><ul><li>${bar('66%')}</li><li>${bar('50%')}</li></ul></div>
      </div>
    </div></div>
  </section></main>
</div>
<script>
  var t0 = Date.now();
  setInterval(function(){
    var s = Math.round((Date.now() - t0) / 1000);
    document.getElementById('clock').textContent = s < 60 ? s + 's' : Math.floor(s/60) + 'm ' + (s % 60) + 's';
  }, 1000);
  (function poll(){
    fetch('/api/status?url=' + encodeURIComponent(new URLSearchParams(location.search).get('url') || ''))
      .then(function(r){ return r.json(); })
      .then(function(j){
        if (j.state === 'ready') { location.reload(); return; }
        if (j.step) document.getElementById('step').textContent = j.step;
        if (j.of) document.getElementById('detail').textContent = 'Step ' + j.done + ' of ' + j.of + '.';
        setTimeout(poll, 1000);
      })
      .catch(function(){ setTimeout(poll, 2000); });
  })();
</script>`;
}
