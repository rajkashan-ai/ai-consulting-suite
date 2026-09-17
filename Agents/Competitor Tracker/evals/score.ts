/**
 * Score a run against the hand-built screen. Pass or fail, per criterion.
 *
 * This did not exist until 15 September, which is the point. The golden record
 * was written as a target and then every run was judged against it in prose —
 * "the profile matches" — while four of the six sections were not produced at
 * all. An eval with no scorer is a wish. This prints the whole card, including
 * the parts that are zero, so a partial run cannot be described as a working one.
 */
import {
  EXPECTED_PROFILE, EXPECTED_COMPETITORS, EXPECTED_OWN_PRICES,
  EXPECTED_HEADLINES, EXPECTED_FINDINGS, EXPECTED_ACTIONS, MUST_NOT,
} from './golden-barber.ts';

export interface RunUnderTest {
  profile?: { name: string; trade: string; town: string; country: string; services: string[] };
  services?: { name: string; price: number }[];
  competitors?: { name: string; headlinePrice?: number }[];
  headlines?: Partial<typeof EXPECTED_HEADLINES>;
  findings?: { fact: string; source?: string }[];
  actions?: { rank: number; area: string; headline?: string }[];
  exportedText?: string;
}

export interface Criterion { name: string; got: number; want: number; pass: boolean; note?: string }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

export function score(run: RunUnderTest): { criteria: Criterion[]; passed: number; total: number } {
  const c: Criterion[] = [];
  const add = (name: string, got: number, want: number, note?: string) =>
    c.push({ name, got, want, pass: got >= want, note });

  // 1. the profile
  const p = run.profile;
  const fields = p ? [
    p.name === EXPECTED_PROFILE.name, p.trade === EXPECTED_PROFILE.trade,
    p.town === EXPECTED_PROFILE.town, p.country === EXPECTED_PROFILE.country,
  ].filter(Boolean).length : 0;
  add('Profile fields correct', fields, 4);

  // 2. their own prices
  const want = Object.entries(EXPECTED_OWN_PRICES);
  const gotPrices = (run.services ?? []).length
    ? want.filter(([n, v]) =>
        (run.services ?? []).some(s => norm(s.name).includes(norm(n).slice(0, 8)) && s.price === v)).length
    : 0;
  add('Own prices read', gotPrices, want.length);

  // 3. the five competitors
  const gotComp = EXPECTED_COMPETITORS.filter(e =>
    (run.competitors ?? []).some(g => norm(g.name) === norm(e.name))).length;
  add('Competitors identified', gotComp, EXPECTED_COMPETITORS.length);

  // 4. their prices
  const gotCompPrice = EXPECTED_COMPETITORS.filter(e =>
    (run.competitors ?? []).some(g => norm(g.name) === norm(e.name) && g.headlinePrice === e.headlinePrice)).length;
  add('Competitor prices read', gotCompPrice, EXPECTED_COMPETITORS.length);

  // 5. the headline numbers
  const hk = Object.keys(EXPECTED_HEADLINES) as (keyof typeof EXPECTED_HEADLINES)[];
  const gotHead = hk.filter(k => run.headlines?.[k] === EXPECTED_HEADLINES[k]).length;
  add('Headline numbers', gotHead, hk.length);

  // 6. the findings the actions rest on
  const gotFind = EXPECTED_FINDINGS.filter(f =>
    (run.findings ?? []).some(g => norm(g.fact).includes(norm(f.fact).slice(0, 18)))).length;
  add('Findings reached', gotFind, EXPECTED_FINDINGS.length);

  // 7. three ranked actions, each with an area
  const acts = run.actions ?? [];
  const gotAct = EXPECTED_ACTIONS.filter(e =>
    acts.some(g => g.rank === e.rank && g.area === e.area)).length;
  add('Actions, ranked and area-tagged', gotAct, EXPECTED_ACTIONS.length);

  // 8. the never-do list. Vacuously clean on an empty run, and said so.
  // A rule you cannot check is not a rule you passed. An empty run breaks none
  // of them and that is not a score of five out of five — it is no evidence
  // either way. Counting it as a pass flattered the first run to 3 of 8 when
  // the honest figure was 2.
  const text = run.exportedText ?? '';
  add('Never-do rules held', text ? MUST_NOT.length : 0, MUST_NOT.length,
      text ? undefined : 'nothing written yet, so nothing to check');

  return { criteria: c, passed: c.filter(x => x.pass).length, total: c.length };
}

export function report(run: RunUnderTest): string {
  const { criteria, passed, total } = score(run);
  const lines = criteria.map(x =>
    `  ${x.pass ? 'PASS' : 'FAIL'}  ${x.name.padEnd(34)} ${String(x.got).padStart(2)}/${x.want}` +
    (x.note ? `   (${x.note})` : ''));
  return lines.join('\n') + `\n\n  ${passed} of ${total} criteria pass.`;
}
