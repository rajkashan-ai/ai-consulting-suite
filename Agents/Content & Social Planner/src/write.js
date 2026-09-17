/**
 * Slots in, words out. THE JUDGEMENT SEAM.
 *
 * Everything else in this pipeline is arithmetic: dates, the mix, the angles,
 * the recommendation, the guards, the render. This is the one part that decides
 * what to SAY, and with no model available in this environment it composes from
 * the facts the site actually published.
 *
 * WHAT THAT MEANS HONESTLY
 * A template can say "our prices are X, Y and Z" because those came off the
 * page. It cannot say "the mistake is leaving it eight weeks between cuts",
 * because nothing on the page says so and inventing it is the one thing this
 * tool exists not to do. So where an angle needs knowledge the facts do not
 * carry, the writer leaves a marked blank with an instruction — which is what
 * CLAUDE.md §4 already requires of a post that needs a real example.
 *
 * The result is a plan with more blanks in it than the one written by hand.
 * That difference is the honest measure of what a model adds, and it is visible
 * in the eval rather than hidden.
 *
 * REPLACING THIS WITH A MODEL: keep the signature. `write(slot, facts, voice)`
 * returns {words, shot, why}. A model call swaps the body, and every guard in
 * `src/guards.ts` runs over the result either way.
 */
import { CHANNEL } from './types.ts';


function list(items, join) {
  if (!items || !items.length) return '';
  if (items.length === 1) return items[0];
  return items.slice(0, -1).join(', ') + (join || ' and ') + items[items.length - 1];
}
function priceLine(known) {
  var names = Object.keys(known.prices || {});
  return names.map(function (n) { return n.replace(/\b\w/g, function (c) { return c.toUpperCase(); }) + ' ' + known.prices[n]; });
}
function bookingLine(facts) {
  var b = facts.booking || {};
  if (b.appointmentOnly && b.phone) return 'We are appointment only. Call or message ' + b.phone + ' and we will find you a slot.';
  if (b.platform) return 'You can book through ' + b.platform + '.';
  if (b.phone) return 'Call ' + b.phone + ' and we will find you a slot.';
  return '[say how someone books with you]';
}

/** A blank the owner fills, with the instruction inside it. */
function blank(t) { return '[' + t + ']'; }

/**
 * What to film, where the channel is video.
 *
 * SHOT tells the owner to photograph something. On TikTok and YouTube that is
 * advice they cannot act on: a still is not a post there. Same angle, same
 * plainness, different instruction. Both are still things they can do on the
 * phone in their pocket this week, which is CLAUDE.md 6.4.
 */
var FILM = {
  'how-it-works': 'Film it happening, start to finish, phone propped against something. A minute is plenty.',
  'what-it-costs': 'Talk to the camera and say the prices out loud. One take.',
  'the-mistake': 'Film the problem before you fix it, then say in one line why it happens.',
  'before-after': 'Film the before, then the after, same spot. Cut straight between them.',
  'asked-a-lot': 'Film yourself answering it, the way you answer it in person.',
  'this-week': 'Three short clips from this week, one each, taken before they leave.',
  'not-for-you': 'Film the work you do want, and say plainly what you do not take on.',
  'the-timing': 'Film what the time of year looks like where you are.',
  'ask-them': 'Film the two things you are asking between, a few seconds each.',
  'the-ask': 'Film the booking screen, or the door opening, and say how to get in.',
};

var SHOT = {
  'how-it-works': 'The two side by side, same spot, same light, taken on your phone.',
  'what-it-costs': 'Your price list where you actually have it written down.',
  'the-mistake': 'One photo that shows the problem, taken before you fixed it.',
  'before-after': 'Before and after, same place, same light.',
  'asked-a-lot': 'Whatever someone sees first when they arrive.',
  'this-week': 'Three from this week, one photo each, taken before they leave.',
  'not-for-you': 'The work you do want, plainly.',
  'the-timing': 'Something that shows the time of year where you are.',
  'ask-them': 'Two photos, the two things you are asking between.',
  'the-ask': 'The booking screen, or the door open.',
};
var WHY = {
  'how-it-works': 'It is the question you answer in person every week.',
  'what-it-costs': 'A price nobody has to ask for is a reason to walk in.',
  'the-mistake': 'Useful on its own, and it argues for booking sooner.',
  'before-after': 'The work is the argument. Nothing else needs saying.',
  'asked-a-lot': 'It arrives as a message at nine at night. Answer it once.',
  'this-week': 'The plainest posts prove you do this every day.',
  'not-for-you': 'Saying who you are not for is how the right ones recognise you.',
  'the-timing': 'People act on a date more than on a discount.',
  'ask-them': 'A question with two pictures gets answered.',
  'the-ask': 'One ask a month, and this is it.',
};

/**
 * @param {{angle:string, channel:string, purpose:string, date:string}} slot
 * @param {object} facts  from extractFacts
 * @returns {{words:string, shot:string, why:string}}
 */
function write(slot, facts) {
  var known = facts.known || {}, s = known.services || [], p = priceLine(known);
  var a = s[0] || 'what you do', b = s[1] || s[0] || 'the other thing you do';
  var words;

  switch (slot.angle) {
    case 'what-it-costs':
      words = p.length
        ? 'Our prices, so nobody has to ask first. ' + p.join('. ') + '. ' + bookingLine(facts)
        : blank('write your prices here, exactly as you charge them') + ' ' + bookingLine(facts);
      break;
    case 'asked-a-lot':
      words = 'Do you need to book? ' + bookingLine(facts) + ' ' +
        blank('the other question you get asked most, and your answer') + ' ' +
        (p.length ? p[0] + ', and everything else is on the price list.' : '');
      break;
    case 'the-ask':
      words = 'Booking is open. ' + bookingLine(facts) + ' ' +
        (p.length ? p.slice(0, 2).join('. ') + '.' : '') + ' ' +
        blank('if you want to put an offer on it, say what it is here');
      break;
    case 'how-it-works':
      words = 'Two people ask for the same thing and mean different things. ' +
        cap(a) + ' and ' + b + ' are not the same job. ' +
        blank('say in a line or two what the difference actually is') + ' ' +
        (p.length ? 'That is the difference between ' + p[0] + ' and ' + (p[1] || p[0]) + '.' : '');
      break;
    case 'ask-them':
      words = 'Settle something for us. ' + cap(a) + ', or ' + b + '? ' +
        blank('say what you would pick and why, in a line') +
        ' Tell us which one is you.';
      break;
    case 'before-after':
      words = cap(b) + ', start to finish. ' +
        blank('say what they came in asking for') + ' ' +
        blank('say what you actually did, in two lines') + ' ' +
        (known.prices[b] ? 'It is ' + known.prices[b] + '.' : '');
      break;
    default:
      words = blank('what do people get wrong about ' + a + '?') + ' ' +
        blank('say what you would tell them instead, in three or four lines') + ' ' +
        blank('and what you would have them do about it');
  }

  var ch = CHANNEL[slot.channel] || {};
  var video = ch.medium === 'video';
  var out = {
    words: words.replace(/\s+/g, ' ').trim(),
    shot: video ? (FILM[slot.angle] || FILM['this-week']) : (SHOT[slot.angle] || SHOT['this-week']),
    why: WHY[slot.angle] || WHY['this-week'],
  };
  /* A YouTube upload with no title cannot be posted, so a post without one is
     not a finished post. The first sentence is what the owner would have typed
     anyway, trimmed to fit rather than cut mid-word. */
  if (ch.titleChars) out.title = firstLine(out.words, ch.titleChars);
  return out;
}
function cap(s) { return String(s).charAt(0).toUpperCase() + String(s).slice(1); }

/** The opening sentence, inside `max` characters, never broken mid-word. */
function firstLine(words, max) {
  var first = String(words).split(/(?<=[.!?])\s/)[0].replace(/\s+/g, ' ').trim();
  first = first.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
  if (first.length <= max) return first;
  var cut = first.slice(0, max + 1);
  var sp = cut.lastIndexOf(' ');
  return (sp > 0 ? cut.slice(0, sp) : first.slice(0, max)).replace(/[,.;:\-]$/, '').trim();
}

/* These two are not inlined into the page, so they can be modules. */
export { write, bookingLine, blank, firstLine };
