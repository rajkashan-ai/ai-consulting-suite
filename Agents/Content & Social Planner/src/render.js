/**
 * A plan in, the screen out.
 *
 * This is the other end of the pipeline: the markup used to be typed by hand
 * and is now drawn from the data. It produces the same structure the hand-built
 * screen had, because `evals/expected-screen.js` is the target and a different
 * structure would make that comparison meaningless.
 *
 * Plain rendering, no judgement. Everything it says comes from the plan, the
 * facts, or `CHANNEL` — never from a string typed in here about a business.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHANNEL, CADENCE_LABEL } from './types.ts';
import { CONNECT as CONNECT_FACTS } from './platform.ts';
import { keptFractionLabel } from './render-helpers.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESIZER = readFileSync(join(HERE, '_resizer-block.html'), 'utf8');

/**
 * Escape anything that came off someone else's website.
 *
 * It used to cover & and < only, which is safe in text and unsafe the first
 * time a business name lands in an attribute. Nothing does that today, so this
 * closes a hole before it exists rather than after: a quote is invisible in
 * text and is the whole attack in `title="..."`. & must stay first or it
 * re-escapes the escapes.
 */
const e = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  .replace(/£/g, '&pound;');
const blanked = (s) => e(s).replace(/\[([^\]]+)\]/g, (_, g) => `<span class="blank">[${g}]</span>`);
const day = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
/* The strip used the capitalised short date lowercased, which reads "6 oct". */
const longDay = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
/* One line for what the owner has to supply, which is no longer always a photo. */
function supplyLine(written) {
  const vids = written.filter((p) => (CHANNEL[p.channel] || {}).medium === 'video').length;
  const pics = written.length - vids;
  const bit = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  if (!vids) return `You take ${bit(pics, 'photograph', 'photographs')}.`;
  if (!pics) return `You film ${bit(vids, 'clip', 'clips')}.`;
  return `You take ${bit(pics, 'photograph', 'photographs')} and film ${bit(vids, 'clip', 'clips')}.`;
}

const shortDay = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).toUpperCase();
const KIND = { useful: 'Useful', question: 'A question for them', offer: 'The ask' };

export function renderScreen(plan, facts) {
  const written = plan.posts.filter((p) => p.words);
  const posted = plan.posts.filter((p) => p.postedUrl);
  const blanks = written.flatMap((p) => [...p.words.matchAll(/\[([^\]]+)\]/g)].map((m) => ({ on: p.date, asks: m[1] })));
  const weeks = [...new Set(plan.posts.map((p) => p.week))].sort((a, b) => a - b);
  const h = [];
  /* What connecting an account actually involves, per channel.
     This was one paragraph shown for every channel, and it described Meta's
     rules: "a business or creator account joined to a Facebook page". Shown
     under TikTok that is a false claim about someone else's product, which is
     the one thing CLAUDE.md 4 and the fact-integrity rule both forbid. Where we
     have not built a connection we say so, rather than describing one. */
  const CONNECT = {
    instagram: CONNECT_FACTS.meta.value, facebook: CONNECT_FACTS.meta.value,
    none: CONNECT_FACTS.none.value,
  };
  const band = (cls, body) => { h.push(`        <div class="band ${cls}"><div class="band__in">`); body(); h.push('        </div></div>'); };

  h.push('      <!-- CONTENT & SOCIAL PLANNER -->');
  h.push('      <section id="v-content" class="hide">');

  band('band--a band--first', () => {
    h.push(`        <h1 class="t-page">Content &amp; Social Planner</h1>`);
    h.push(`        <p class="t-lead">Thirty days of posts for ${e(plan.business)}, written from what is on your own site.</p>`);
    h.push('        <h2 class="t-section">What you have posted</h2>');
    h.push(`        <p class="t-doc-sm">Paste the link when a post goes out and we keep the count. Connect an account and we can also see what is already on there.</p>`);
    h.push('        <div class="card"><ul>');
    for (const c of plan.channels) {
      const handle = (facts.channels.find((x) => x.channel === c) || {}).handle;
      h.push(`          <li><span class="t-card">${CHANNEL[c].label}</span>` +
        `<span class="note">Nothing through here yet. We cannot see the rest of your account.${handle ? ' Found as ' + e(handle) + ' on your site.' : ''}</span>` +
        `<span class="note">${CONNECT[c] || CONNECT.none}</span></li>`);
    }
    h.push('        </ul></div>');
    /* A button offering to connect something we have not built is the same
       promise "Approve this week" made and could not keep. */
    const connectable = plan.channels.filter((c) => CONNECT[c]);
    if (connectable.length) {
      h.push('        <div class="controls">' + connectable.map((c) => `<button class="btn--ghost" type="button">Connect ${CHANNEL[c].label}</button>`).join('') + '</div>');
    }
    h.push('        <div class="stats">');
    h.push(stat(`${written.length}<span class="unit"> this week</span>`, dayNames(written), `Written from your site on ${e(facts.readAt)}. ${supplyLine(written)}`));
    h.push(stat(`${blanks.length}<span class="unit"> blank${blanks.length === 1 ? '' : 's'}</span>`, 'A line from you', 'Each one says what to put in it. We will not write it for you.', blanks.length ? ' stat--warn' : ''));
    /* The third figure is progress, not plumbing. "5 prices read" and "2 pages
       read" are facts about our own machinery, which base-prompt.md forbids on a
       customer screen, and neither tells them where they are in the month. It
       counts posts they have told us went out, and says so, per CLAUDE.md 6a. */
    h.push(stat(`${posted.length} of ${plan.posts.length}<span class="unit"> posted</span>`, 'So far this month', 'Posts you have told us went out. We cannot see the rest of your account.'));
    h.push('        </div>');
    h.push(`        <div class="strip"><strong>Week ${written.length ? plan.posts.find((p) => p.words).week : 1} of ${weeks.length}</strong><span>Read ${e(facts.readAt)}.</span><span class="t-meta">${plan.posts.length} posts to ${longDay(plan.posts[plan.posts.length - 1].date)}</span></div>`);
  });

  band('band--b', () => {
    h.push('        <h2 class="t-section">How often we suggest you post</h2>');
    h.push('        <p class="t-doc-sm">You can change this and every later week is written to the new number.</p>');
    h.push(`        <div class="panel"><p class="t-doc"><strong>${CADENCE_LABEL[plan.recommendation.cadence]}.</strong></p><ul>` +
      plan.recommendation.because.map((r) => `<li class="t-row">${e(r.text)}</li>`).join('') + '</ul>' +
      (plan.recommendation.stepUp ? `<p class="t-doc-sm"><strong>If you want to step up.</strong> ${e(plan.recommendation.stepUp.costs)} ${e(plan.recommendation.stepUp.covers)}</p>` : '') + '</div>');
    h.push('        <div class="controls">' + ['Once a week', 'A couple of times a week', 'Most days']
      .map((x) => `<button class="toggle" type="button" aria-pressed="${x === CADENCE_LABEL[plan.recommendation.cadence]}">${x}</button>`).join('') + '</div>');
    h.push('        <h2 class="t-section">What you sound like</h2>');
    h.push(`        <p class="t-doc-sm">Read off your own site on ${e(facts.readAt)}.</p>`);
    h.push(`        <div class="panel"><p class="t-doc">${e(plan.voice.slice(0, 420))}</p></div>`);
    h.push('        <div class="controls">' + ['Too salesy', 'Too formal', 'Not how I talk', 'Too long', 'I would not say that about myself']
      .map((x) => `<button class="toggle" type="button" aria-pressed="false">${x}</button>`).join('') + '</div>');
    h.push('        <p class="t-meta">Anything showing as chosen is a correction we are holding. It is remembered next month. Press it again to drop it.</p>');
  });

  band('band--dark', () => {
    h.push('        <h2 class="t-section">This week</h2>');
    /* "Tuesday are a suggestion" is what one post a week reads like when the
       sentence was written for two. A groomer on the weekly cadence saw it. */
    h.push(`        <p class="t-doc-sm">${dayNames(written)} ${written.length === 1 ? 'is' : 'are'} a suggestion. A day later is fine.</p>`);
    h.push('        <div class="posts">');
    for (const p of written) {
      h.push('          <article class="card">');
      h.push(`            <div class="card__head card__head--base"><span class="t-card u-push">${day(p.date)}</span><span class="t-meta">${CHANNEL[p.channel].label}</span><span class="t-kind">${KIND[p.purpose]}</span></div>`);
      /* A YouTube upload form has a title box above the description, and a post
         that leaves it empty cannot be published. It goes above the words on
         the card for the same reason it does on their screen. */
      h.push('            <div class="card__body">' +
        (p.title ? `<div class="inset"><p class="t-kind">Title</p><p class="t-row">${e(p.title)}</p></div>` : '') +
        `<p class="t-doc">${blanked(p.words)}</p>`);
      /* "Photograph" over a TikTok instruction is advice they cannot act on. */
      h.push(`              <div class="inset"><p class="t-kind">${(CHANNEL[p.channel] || {}).medium === 'video' ? 'Film' : 'Photograph'}</p><p class="t-row">${e(p.shot)}</p></div>`);
      h.push('            </div>');
      h.push(`            <div class="card__foot"><p class="t-meta u-push">${e(p.why)}</p><button class="btn--sm btn--ghost" type="button">Edit</button><button class="btn--sm btn--ghost" type="button" data-rz="${p.channel}">Size a photo</button></div>`);
      h.push(`            <div class="card__foot"><label class="t-meta u-push" for="lnk-${p.date}">Posted it? Paste the link</label><input class="field" id="lnk-${p.date}" type="url" placeholder="https://..." /><button class="btn--sm btn--ghost" type="button">Posted</button></div>`);
      h.push('          </article>');
    }
    h.push('        </div>');
    h.push(`        <div class="card"><div class="card__foot"><p class="t-doc-sm u-push">Take them with you. The words, what to bring and the days, in one file you can open on your phone.</p><button class="btn" type="button" id="wk-send">Send me this week</button></div></div>`);
  });

  band('band--a', () => {
    h.push(RESIZER.trimEnd());
    h.push('        <h2 class="t-section">The rest of the month</h2>');
    h.push('        <p class="t-doc-sm">Every day, channel and subject is already set. The words arrive the Monday of each week.</p>');
    h.push('        <div class="card"><ul class="feed">');
    for (const w of weeks) {
      const inWeek = plan.posts.filter((p) => p.week === w);
      const state = w < (plan.weeksWritten ?? 1) ? 'Done' : w === (plan.weeksWritten ?? 1) ? 'This week' : 'Ahead';
      h.push(`          <li class="feed__row feed__row--static"><span class="t-kind${state === 'Done' ? ' kind--good' : ''}">${state}</span>` +
        `<span class="t-row t-strong">${e(subject(inWeek))}</span>` +
        `<span class="t-meta">${inWeek.length} post${inWeek.length === 1 ? '' : 's'} &middot; ${shortDay(inWeek[0].date)}</span></li>`);
    }
    h.push('        </ul></div>');
  });

  band('band--b band--last', () => {
    h.push('        <h2 class="t-section">What we did not write</h2>');
    h.push('        <div class="card"><h3 class="t-card card__head">Not written, and why</h3><ul>');
    h.push('          <li><span class="tag tag--cant">We cannot</span>A customer quote or a review<span class="note">Your site does not publish any, and we will not write one for you to post under your own name</span></li>');
    h.push(`          <li><span class="tag tag--cant">We cannot</span>How long you have been going<span class="note">It is not on the ${facts.pages.length} page${facts.pages.length === 1 ? '' : 's'} we read. Tell us once and it can go in every month after this</span></li>`);
    h.push('          <li><span class="tag tag--na">Not for you</span>A photograph we made<span class="note">A generated picture of work that was never done</span></li>');
    h.push(`          <li><span class="tag tag--na">Not for you</span>Channels not on your site<span class="note">We found ${plan.channels.map((c) => CHANNEL[c].label).join(' and ')}. Starting another is a decision, not a post</span></li>`);
    h.push('        </ul></div>');
  });

  h.push('      </section>');
  return h.join('\n');
}

function stat(figure, label, note, extra = '') {
  return `          <div class="stat${extra}"><span class="stat__figure">${figure}</span><span class="stat__label t-kind">${e(label)}</span><span class="stat__note t-meta">${e(note)}</span></div>`;
}
function dayNames(posts) {
  const names = posts.map((p) => new Date(p.date + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' }));
  return names.length < 2 ? names[0] ?? '' : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}
/** What a week is about, taken from the angles in it rather than invented. */
function subject(posts) {
  const SUBJECT = {
    'what-it-costs': 'What each job is, and what it costs', 'how-it-works': 'What each job actually is',
    'before-after': 'The work itself, close up', 'asked-a-lot': 'The questions you answer every week',
    'the-mistake': 'What people get wrong', 'this-week': 'A normal week', 'not-for-you': 'Who you are not for',
    'ask-them': 'A question for them', 'the-timing': 'The time of year', 'the-ask': 'The ask',
  };
  return SUBJECT[posts[0].angle] ?? 'This week';
}
