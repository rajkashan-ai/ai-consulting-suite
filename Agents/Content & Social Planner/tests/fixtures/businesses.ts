/**
 * Two businesses and one clean plan.
 *
 * REAL: everything under BARBER was read by hand from The Barber Shop
 * Shrewsbury on 14 September 2026, the same run the Competitor Tracker suite
 * uses. SYNTHETIC: STUDIO exists to make one edge case happen, sells nationally,
 * and is not a real company.
 *
 * PLAN is deliberately clean. Every test below breaks exactly one thing in it,
 * so a failure names the rule rather than the fixture.
 */
import type { KnownFacts, Plan, Post } from '../../src/types.ts';
import { CADENCE_LABEL, isWritten } from '../../src/types.ts';
import { weeksCovered } from '../../src/guards.ts';

/* REAL. Read by hand, 14 September 2026. */
export const BARBER: KnownFacts = {
  services: ['clipper cut', 'classic cut', 'beard trim', 'cut and beard', 'beard sculpting', 'hot towel shave', 'head shave'],
  prices: { 'clipper cut': '£8', 'classic cut': '£15', 'beard trim': '£8', 'cut and beard': '£20', 'beard sculpting': '£20' },
  accreditations: [],
  awards: [],
  namedClients: [],
  counts: {},
  reviewThemes: [],
  servesAnArea: true,
};

/* SYNTHETIC. A studio competing nationally, so "local" is wrong for it. */
export const STUDIO: KnownFacts = {
  services: ['brand identity', 'packaging design'],
  prices: { 'brand identity': '£6,000' },
  yearsTrading: 9,
  accreditations: [],
  awards: [],
  namedClients: ['Harlow Tea'],
  counts: { clients: 40 },
  reviewThemes: [],
  servesAnArea: false,
};

const P = (
  date: string, channel: Post['channel'], angle: Post['angle'], purpose: Post['purpose'],
  words: string, shot: string, why: string,
): Post => ({ date, channel, angle, purpose, words, shot, why });

export const POSTS: Post[] = [
  P('2026-09-15', 'instagram', 'how-it-works', 'useful',
    'Two men ask for the same thing and mean completely different haircuts. A clipper cut is one guard over the whole head, in and out in fifteen minutes, £8. A classic cut is scissors on top, tapered in at the sides, shaped round the ear, and it takes closer to half an hour. That is £15. If you are not sure which one you want, tell us what you want it to look like in three weeks and we will pick for you.',
    'The same head after a clipper cut and after a classic cut, two photos, same spot by the window.',
    'It is the question you answer at the chair every day, and it explains the gap between £8 and £15.'),

  P('2026-09-18', 'facebook', 'what-it-costs', 'useful',
    'Our prices, so nobody has to ask first. Clipper cut £8. Classic cut £15. Beard trim £8. Cut and beard together £20. Beard sculpting £20. No card fee, no booking fee, nothing added on the way out. If you want something that is not on that list, ask before we start and we will tell you what it comes to. Prices are the same on a Saturday as they are on a Tuesday morning.',
    'The price board on the wall, straight on, no angle.',
    'A price nobody has to ask for is a reason to walk in rather than message first.'),

  P('2026-09-22', 'instagram', 'before-after', 'useful',
    'Beard sculpting is not a trim. A trim takes the length off. Sculpting sets the line: where the cheek stops, where the neck starts, and where the corner of the jaw sits. Get those three wrong and a good beard looks untidy however short it is. This one took about twenty minutes. [say what he came in asking for] It is £20, and it holds its shape for roughly three weeks before it needs touching.',
    'Before and after, same chair, same light, taken from slightly above so the jawline shows.',
    'The difference between an £8 trim and a £20 sculpt is invisible until somebody shows it.'),

  P('2026-09-25', 'facebook', 'asked-a-lot', 'useful',
    'Do you need to book? You can book through NearCut, it takes about thirty seconds and you pick your own slot. [walk-ins: say whether you take them and when is quiet] We are open six days, closed Sunday. If you are coming for a cut and beard together, book it as the one job rather than two separate ones, or the slot will be too short and the beard gets rushed.',
    'Your phone showing the booking screen, held up in front of the shop window.',
    'It is the question that arrives as a message at nine at night, and an answered question is a booking.'),

  P('2026-09-29', 'instagram', 'ask-them', 'question',
    'Settle something for us. Beard trimmed, or beard sculpted? A trim keeps what you have got and tidies it up. Sculpting draws the lines and changes the shape of your face more than most men expect it to. Two photos below, the same beard, a fortnight apart. Tell us which one you would walk out with, and if it is the second one, [say how far ahead you are booking at the moment] so people know.',
    'Two photos of the same beard, trimmed and then sculpted, side by side.',
    'A question with two pictures gets answered. A question on its own does not.'),

  P('2026-10-02', 'facebook', 'the-mistake', 'useful',
    'The mistake is leaving it eight weeks and then asking for the same cut you had at three. A classic cut is shaped to grow out for about four weeks. After six it is a different head of hair, and getting back to the shape you liked needs a shorter cut than you came in wanting. Book the next one while you are still happy with this one. Three to four weeks for a classic cut, two for a clipper cut.',
    'One photo of a cut at week one and the same head at week six, if you have both.',
    'It is genuinely useful, and it argues for booking the next one without asking for the booking.'),

  P('2026-10-06', 'instagram', 'this-week', 'useful',
    'A normal week in the shop. [pick three cuts from this week and say what each man asked for] Nothing dramatic, no transformations, just the work. That is most of what a barber does and it is the part nobody puts up. If you saw one you liked, screenshot it and bring it in with you. A picture on your phone saves ten minutes of describing it, and we would far rather see it than guess at it.',
    'Three cuts from this week, one photo each, taken before he stands up.',
    'The plainest posts are the ones that prove you do this every day.'),

  P('2026-10-09', 'facebook', 'ask-them', 'question',
    'Question for the Friday crowd. When do you actually want to come in? Saturday morning, or a weekday after work? We are asking because the answer decides what we do about opening hours, and we would rather ask than guess at it. Comment with whichever one is you. If it is neither, and there is a time you can never get in, say that instead, because that is the useful answer.',
    'The empty shop, lights on, taken from the door first thing.',
    'It asks for something you will actually use, which is why it will get answers.'),

  P('2026-10-13', 'instagram', 'the-ask', 'offer',
    'Booking for the rest of the month is open. If you already know you want a cut before the end of October, put it in on NearCut now and pick the slot you actually want rather than the one that is left. [if you want to put an offer on it, say what it is here] Classic cut £15. Cut and beard £20. Six days a week, closed Sunday. It takes thirty seconds and then you stop thinking about it.',
    'The booking screen with this month showing, and the empty slots visible.',
    'One ask a month, and this is it. It asks for the thing that is easiest to say yes to.'),
];

export const PLAN: Plan = {
  business: 'The Barber Shop Shrewsbury',
  cadence: 'twice-weekly',
  ranAt: '2026-09-14T09:00:00.000Z',
  channels: ['instagram', 'facebook'],
  voice: 'Short, flat and a bit dry. You explain things the way you would to someone in the chair, you never oversell, and you have never once called yourself passionate.',
  weeks: [
    { week: '15 to 21 September', about: 'What each cut is, and what it costs', channels: ['instagram', 'facebook'] },
    { week: '22 to 28 September', about: 'The work itself, close up', channels: ['instagram', 'facebook'] },
    { week: '29 September to 5 October', about: 'What people get wrong between cuts', channels: ['instagram', 'facebook'] },
    { week: '6 to 14 October', about: 'A normal week, then the ask', channels: ['instagram', 'facebook'] },
  ],
  posts: POSTS,
};

/** The plan as the customer exports it. Nothing else may reach this string. */
export function exportPlan(plan: Plan): string {
  const written = plan.posts.filter(isWritten);
  const ahead = plan.posts.filter(p => !isWritten(p));
  const lines = [`# ${plan.business}`, ''];

  lines.push('## What we suggest', '');
  lines.push(plan.recommendation
    ? [CADENCE_LABEL[plan.recommendation.cadence] + '.', ...plan.recommendation.because.map(r => r.text)].join(' ')
    : CADENCE_LABEL[plan.cadence] + '.');

  lines.push('', '## What you sound like', plan.voice, '', '## This week', '');
  for (const p of written) {
    lines.push(`### ${p.date}, ${p.channel}`, p.words ?? '', `Photograph: ${p.shot}`, `Why: ${p.why}`, '');
  }

  lines.push('## The rest of the month', '');
  for (const w of plan.weeks) lines.push(`| ${w.week} | ${w.about} | ${w.channels.join(', ')} |`);
  if (ahead.length) lines.push('', `${ahead.length} more posts, already dated. The words arrive the Monday of each week.`);

  // Listed only when the document runs past a week, so a blank cannot be
  // scrolled past. On one week the amber marks it and the count says how many.
  const gaps = written.flatMap(p => [...(p.words ?? '').matchAll(/\[([^\]]+)\]/g)].map(m => `- ${p.date}: ${m[1]}`));
  if (gaps.length && weeksCovered(plan) > 1) lines.push('', '## What to fill in', '', ...gaps);

  lines.push('', '## What we did not write', '');
  lines.push('- A customer quote or a review. You have not given us one.');
  lines.push('- How long you have been going. It is not on your site.');
  return lines.join('\n');
}


/** A copy with one post changed, so a test can break exactly one thing. */
export function planWith(changes: Partial<Post>[], base: Plan = PLAN): Plan {
  return { ...base, posts: base.posts.map((p, i) => ({ ...p, ...(changes[i] ?? {}) })) };
}
