/**
 * A real website in, facts out.
 *
 * WHY THIS EXISTS
 * Until 15 September the planner's screen was hand-typed HTML and `src/` was a
 * library of rules nothing called. There was no application between them. This
 * is the front of the pipeline that joins them: it reads a site and produces the
 * `KnownFacts` every guard in this tool already checks against.
 *
 * WHAT IT WILL NOT DO
 * It never guesses. A field it cannot read stays empty, and an empty field is
 * what stops `findInventedClaims` letting the writer invent one. On the real
 * test site the price menu is rendered client side, so prices come back empty
 * and the plan that follows simply does not mention prices. That is the right
 * answer, not a failure.
 *
 * Plain JavaScript, no imports, so node and a browser can both run it.
 */

/** Visible words, with script, style and markup taken out. */
import { ACCOUNT_URLS, NOT_A_HANDLE } from './platform.ts';

function visibleText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '. ')
    .replace(/<\/(?:p|div|li|h[1-6]|section)>/gi, '. ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); })
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&pound;/g, '£')
    .replace(/&[a-z]+;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** The trading name, as the site gives it. */
/**
 * The business's name, out of the page title.
 *
 * A title is often three things joined by bars: a descriptor, the name, and the
 * town. "Experienced Dog Groomer | PAW-Lished | Shrewsbury" is not a business
 * name, and putting it on the screen is the tool getting their name wrong on
 * line one. The domain says which part is the name, because the name is the
 * part they registered: paw-lished.co.uk picks PAW-Lished.
 *
 * Where a title has no separator the whole thing stands, which is the barber's
 * case and why this was invisible until a second site was tried.
 */
function businessName(html, siteUrl) {
  var t = (String(html).match(/<title[^>]*>([^<]*)</i) || [])[1] || '';
  t = t.replace(/\s*[-|–]\s*(home|welcome|official site)\s*$/i, '').replace(/\s+/g, ' ').trim();
  var parts = t.split(/\s*[|–·]\s*|\s+[-]\s+/).map(function (x) { return x.trim(); }).filter(Boolean);
  if (parts.length < 2) return t;

  var label = '';
  try { label = new URL(siteUrl).hostname.replace(/^www\./, '').split('.')[0]; } catch (e) { label = ''; }
  var key = function (x) { return x.toLowerCase().replace(/[^a-z0-9]/g, ''); };
  if (label) {
    for (var i = 0; i < parts.length; i++) if (key(parts[i]) && key(label).indexOf(key(parts[i])) === 0) return parts[i];
    for (var j = 0; j < parts.length; j++) if (key(parts[j]) === key(label)) return parts[j];
  }
  return parts[0];
}

/**
 * Which channels they are actually on.
 *
 * CLAUDE.md: we plan for the channels they have, and telling someone to start
 * one is a claim about their market with nothing behind it.
 */
function channels(html) {
  var found = [], src = String(html);
  /* The URL shapes are the platform's, not the customer's, so they live in
     platform.ts with their source and the date they were last seen working. */
  var map = [
    ['instagram', ACCOUNT_URLS.instagram.value],
    ['facebook', ACCOUNT_URLS.facebook.value],
    ['linkedin', ACCOUNT_URLS.linkedin.value],
    ['tiktok', ACCOUNT_URLS.tiktok.value],
    ['youtube', ACCOUNT_URLS.youtube.value],
  ];
  for (var i = 0; i < map.length; i++) {
    var m = src.match(map[i][1]);
    /* facebook.com/profile.php?id=1234 is a real page with no readable handle.
       Showing "Found as profile.php on your site" is worse than showing
       nothing, so the channel counts and the handle does not. */
    if (m && !/sharer|share\.php|intent|plugins/i.test(m[0])) {
      var handle = NOT_A_HANDLE.value.test(m[1]) ? '' : m[1];
      found.push(handle ? { channel: map[i][0], handle: handle } : { channel: map[i][0] });
    }
  }
  return found;
}

/** Prices, only where a money amount sits next to something being sold. */
function prices(text) {
  var out = {}, re = /([A-Za-z][A-Za-z &'\-]{2,34}?)\s*[-–:.\s]{0,6}(£\s?\d+(?:\.\d{2})?)/g, m;
  while ((m = re.exec(text)) !== null) {
    /* The match starts wherever the letters start, so a list written as
       "...£40 and Giant Breeds from £60" hands back "and giant breeds from". */
    var name = m[1].replace(/\s+/g, ' ').trim().toLowerCase()
      .replace(/^(and|or|the|a|our|plus|from|for)\s+/, '').trim();
    if (name.split(' ').length > 5) continue;         // a sentence, not a service
    out[name] = m[2].replace(/\s/g, '');
  }
  return out;
}

/** Services named on the page, from the words the trade actually uses. */
var TRADE_WORDS = [
  'haircut', 'hair cut', 'clipper cut', 'classic cut', 'skin fade', 'fade',
  'beard trim', 'beard sculpting', 'hot towel shave', 'head shave', 'shave',
  'boiler service', 'bathroom', 'installation', 'repair', 'servicing',
  'colour', 'cut and blow dry', 'manicure', 'pedicure', 'massage', 'treatment',
];
function services(text) {
  var lower = text.toLowerCase(), found = [];
  for (var i = 0; i < TRADE_WORDS.length; i++) {
    if (lower.indexOf(TRADE_WORDS[i]) !== -1 && found.indexOf(TRADE_WORDS[i]) === -1) found.push(TRADE_WORDS[i]);
  }
  return found;
}

/** How someone books, in their own words. Drives what an ask can say. */
function booking(text) {
  var out = { appointmentOnly: /appointment only/i.test(text), phone: null, platform: null };
  var tel = text.match(/\b0\d{3,4}\s?\d{3}\s?\d{3,4}\b/);
  if (tel) out.phone = tel[0].trim();
  var plat = text.match(/\b(booksy|fresha|treatwell|nearcut|setmore|calendly|whatsapp)\b/i);
  if (plat) out.platform = plat[1].toLowerCase();
  return out;
}

/**
 * A stretch of their own prose, for the voice read-back.
 *
 * The longest sentence run that is not navigation. It is a sample, not a
 * judgement: what to make of it is the writer's job, and on the real site it is
 * the "we pride ourselves" paragraph, which tells you plenty.
 */
function voiceSample(text) {
  var parts = String(text).split(/(?<=[.!?])\s+/).filter(function (s) {
    /* Skip-links and the page title are chrome, not voice. The groomer's sample
       opened "... | Shrewsbury Skip to content", which is not how anyone talks. */
    return s.split(' ').length >= 8 &&
      !/^(home|menu|blog|products|use tab|top of page)/i.test(s) &&
      !/skip to (content|main)|cookie|javascript|enable js/i.test(s) &&
      !/\|/.test(s);
  });
  return parts.slice(0, 4).join(' ').slice(0, 600).trim();
}

/** Do they serve an area, or sell beyond the doorstep? Decides "local". */
function servesAnArea(text, name) {
  if (/\b(nationwide|worldwide|across the uk|remote|online only)\b/i.test(text)) return false;
  return /\b(shop|salon|studio|practice|garage|we are open|opening times|call in|visit us)\b/i.test(text)
    || /\b(in|of)\s+[A-Z][a-z]+\b/.test(name);
}

/**
 * One pass over one or more pages of a site.
 * @returns {{name, channels, known, voiceSample, booking, readAt, pages}}
 */
function extractFacts(pages, readAt) {
  var htmlAll = pages.map(function (p) { return p.html; }).join('\n');
  var text = pages.map(function (p) { return visibleText(p.html); }).join(' ');
  var name = businessName(pages[0].html, pages[0].url);
  return {
    name: name,
    channels: channels(htmlAll),
    voiceSample: voiceSample(text),
    booking: booking(text),
    readAt: readAt,
    pages: pages.map(function (p) { return p.url; }),
    known: {
      services: services(text),
      prices: prices(text),
      accreditations: [],
      awards: [],
      namedClients: [],
      counts: {},
      reviewThemes: [],
      servesAnArea: servesAnArea(text, name),
    },
  };
}

/* These two are not inlined into the page, so they can be modules. */
export { extractFacts, visibleText, businessName, channels, prices, services, booking, voiceSample, servesAnArea };
