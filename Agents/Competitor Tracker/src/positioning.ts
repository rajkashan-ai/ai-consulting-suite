/**
 * Three things a snapshot cannot say, and the rules that keep them honest.
 *
 *   1. When you win, and when you lose      (conditional positioning)
 *   2. What a competitor is likely to do next (Porter's four corners)
 *   3. What the owner believes that nobody has checked (bias)
 *
 * All three are judgement rather than fact, which is exactly why they need
 * harder rules than the facts do. A sourced price is self-evidently a price. A
 * prediction reads like a fact unless something forces it to admit it is not.
 */
import type { Claim, Source } from './types.ts';

/* ── 1. When you win ──────────────────────────────────────────────────────── */

/**
 * Battlecard practice is specific about the shape of this: "we win when the
 * team is under 100 users and values ease of setup over feature depth" is
 * usable, "we have a better product" is not. The condition is the whole value.
 *
 * The same research explains why: a battlecard that claims you win on every
 * dimension gets ignored, so `lose` is not optional here.
 */
export interface Positioning {
  /** "Someone who knows what they want and books a specific service." */
  win: string;
  /** "Someone choosing on reputation who has never been to any of you." */
  lose: string;
  evidence: Claim[];
}

const VAGUE = /\b(better|best|superior|great|excellent|higher quality|more professional|good value)\b/i;

export type PositioningProblem =
  | { kind: 'vague'; side: 'win' | 'lose'; text: string }
  | { kind: 'no-condition'; side: 'win' | 'lose'; text: string }
  | { kind: 'no-lose' }
  | { kind: 'unsupported' };

export function validatePositioning(p: Positioning): PositioningProblem[] {
  const out: PositioningProblem[] = [];
  if (!p.lose || !p.lose.trim()) out.push({ kind: 'no-lose' });

  for (const side of ['win', 'lose'] as const) {
    const text = p[side];
    if (!text) continue;
    if (VAGUE.test(text)) out.push({ kind: 'vague', side, text });
    // A condition describes a customer or a situation, not a quality. It has to
    // say *when*, or it is a boast with a "when" bolted on the front.
    if (!/\b(when|someone|anyone|customers? who|people who|if )\b/i.test(text)) {
      out.push({ kind: 'no-condition', side, text });
    }
  }
  if (!p.evidence?.some(e => e.source)) out.push({ kind: 'unsupported' });
  return out;
}

/* ── 2. What they are likely to do next ───────────────────────────────────── */

/**
 * Porter's four corners exists because current strategy and capabilities alone
 * under-predict: you also need to know what drives a competitor and what they
 * believe. Our weekly check notices a change after it has happened. This is the
 * only part of the tool that looks forward, and so it is the only part that can
 * be wrong in a way the customer cannot see.
 *
 * Hence `checkOn`. A prediction with no date to be judged on is an opinion.
 */
export interface Prediction {
  /** The four corners, each from something we actually read. */
  drives: Claim;          // what the competitor is optimising for
  believes: Claim;        // what they appear to assume about the market
  doing: Claim;           // their current strategy, observed
  couldDo: Claim;         // what their resources allow
  /** The call itself, in plain words. */
  expect: string;
  /** The date we find out. Never absent. */
  checkOn: string;
  /** What would show this was wrong. */
  wrongIf: string;
}

export type PredictionProblem =
  | { kind: 'corner-unsourced'; corner: string }
  | { kind: 'no-check-date' }
  | { kind: 'not-falsifiable' }
  | { kind: 'stated-as-fact'; text: string };

/** Words that turn a guess into an assertion. */
const ASSERTED = /\b(will|is going to|are going to|definitely|certainly|plans to)\b/i;

export function validatePrediction(p: Prediction, now: Date): PredictionProblem[] {
  const out: PredictionProblem[] = [];
  for (const [corner, claim] of Object.entries({ drives: p.drives, believes: p.believes, doing: p.doing, couldDo: p.couldDo })) {
    if (!claim || (claim.value !== null && !claim.source)) out.push({ kind: 'corner-unsourced', corner });
  }
  const when = Date.parse(p.checkOn);
  if (!p.checkOn || Number.isNaN(when) || when <= now.getTime()) out.push({ kind: 'no-check-date' });
  if (!p.wrongIf || p.wrongIf.trim().length < 12) out.push({ kind: 'not-falsifiable' });
  // "They will raise prices" is a claim about the future stated as a fact.
  if (ASSERTED.test(p.expect)) out.push({ kind: 'stated-as-fact', text: p.expect });
  return out;
}

/** How a prediction must read on screen. */
export function sayPrediction(p: Prediction): string {
  return `Our read, not a fact: ${p.expect} We will know by ${p.checkOn}. ` +
         `It is wrong if ${p.wrongIf}`;
}

/* ── 3. What the owner believes ───────────────────────────────────────────── */

/**
 * More than 85 per cent of people rate themselves less biased than average, and
 * in competitor work that shows up as a steady over-reading of your own
 * position. The tool takes the owner's description of their business at face
 * value everywhere else, so this is the one place it does not.
 */
export interface SelfClaim {
  /** What the owner told us. */
  says: string;
  /** What we found, if we looked. */
  checkedAgainst: Source | null;
  /** true only where a source agrees with them. */
  holdsUp: boolean | null;
}

export function labelSelfClaim(c: SelfClaim): Claim {
  if (c.checkedAgainst === null) {
    return {
      text: `You told us: "${c.says}". We have not checked this against anything`,
      value: null,
      source: null,
    };
  }
  return {
    text: c.holdsUp
      ? `You told us: "${c.says}". That holds up`
      : `You told us: "${c.says}". What we found does not support it`,
    value: c.holdsUp ? 'confirmed' : 'contradicted',
    source: c.checkedAgainst,
  };
}

/** An unchecked self-claim may never be used as evidence for an action. */
export function usableAsEvidence(c: SelfClaim): boolean {
  return c.checkedAgainst !== null && c.holdsUp === true;
}
