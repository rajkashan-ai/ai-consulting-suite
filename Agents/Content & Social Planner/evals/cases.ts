/**
 * The eval set: what the tool writes, which no equality check can test.
 *
 * TESTING.md section 3. Twenty real cases minimum before a score means
 * anything. Where a case can be graded by a plain check it names the function
 * in `src/guards.ts` that does it and costs nothing. Only what is left over
 * needs a judge.
 *
 * `held` marks cases we never tune against, so a rising score is not just a
 * measure of our own effort.
 */
export type Grader =
  | { by: 'code'; fn: string }
  | { by: 'judge'; question: string }
  | { by: 'human' };

export interface EvalCase {
  id: string;
  input: string;
  grades: string;
  grader: Grader;
  held?: true;
  origin: string;
}

export const CASES: EvalCase[] = [
  /* ── The rule that governs the tool ─────────────────────────────────────── */
  { id: 'acme-corp', origin: 'the first draft\'s own example, 14 Sep 2026',
    input: 'A heating engineer who has told us nothing about any job they have done.',
    grades: 'No post names a client or describes a job. Where one is needed, a gap asks for it.',
    grader: { by: 'code', fn: 'findInventedClaims' } },

  { id: 'years-nobody-gave-us', origin: 'rule, CLAUDE.md 4',
    input: 'A business whose website says nothing about how long it has traded.',
    grades: 'Nothing says "15 years" or "since 2011".',
    grader: { by: 'code', fn: 'findInventedClaims' } },

  { id: 'trade-fact-is-not-a-claim', origin: 'Competitor Tracker learning, 14 Sep 2026', held: true,
    input: 'A barber post about leaving eight weeks between cuts.',
    grades: 'The trade fact survives. Only claims about the business are stripped.',
    grader: { by: 'code', fn: 'findInventedClaims' } },

  { id: 'price-they-never-published', origin: 'rule, CLAUDE.md 4',
    input: 'A salon that publishes four prices. A post needs a fifth service.',
    grades: 'It names the service without a price, or leaves a gap. It does not guess a number.',
    grader: { by: 'code', fn: 'findInventedClaims' } },

  { id: 'review-in-their-mouth', origin: 'rule, CLAUDE.md 4',
    input: 'A business with 200 public reviews we have not been given.',
    grades: 'No post quotes a customer, even though the reviews exist and are public.',
    grader: { by: 'code', fn: 'findInventedClaims' } },

  /* ── Voice ──────────────────────────────────────────────────────────────── */
  { id: 'voice-read-not-invented', origin: 'rule, CLAUDE.md 2a',
    input: 'A plumber whose site is four short blunt sentences.',
    grades: 'The read-back describes how they already write. It is not a personality type.',
    grader: { by: 'judge', question: 'Could this read-back have been written without seeing their site?' } },

  { id: 'no-ai-speak', origin: 'base-prompt.md and the no-ai-speak skill',
    input: 'Any plan.',
    grades: 'No em dashes, no "passionate about", no "unlock", no "seamless", no "at scale".',
    grader: { by: 'code', fn: 'no-ai-speak word list' } },

  { id: 'critique-outlives-the-month', origin: 'rule, CLAUDE.md 5', held: true,
    input: 'An owner marked one post "too salesy" last month. This is next month\'s run.',
    grades: 'This month\'s posts are already less salesy, with no second critique.',
    grader: { by: 'human' } },

  { id: 'their-words-beat-ours', origin: 'rule, CLAUDE.md 5',
    input: 'An owner edits post 3, then marks post 5 "too formal".',
    grades: 'Post 3 comes back byte for byte as they left it.',
    grader: { by: 'code', fn: 'findOverwrites' } },

  /* ── Shape ──────────────────────────────────────────────────────────────── */
  { id: 'weekly-is-four-posts', origin: 'rule, CLAUDE.md 3a',
    input: 'An owner who picked "once a week".',
    grades: 'Four posts. Not thirty, and not four plus a note about what else they could do.',
    grader: { by: 'code', fn: 'validateShape' } },

  { id: 'one-ask-a-month', origin: 'rule, CLAUDE.md 3a',
    input: 'An owner who picked "once a week", so four posts.',
    grades: 'Exactly one of the four asks for the work.',
    grader: { by: 'code', fn: 'validateShape' } },

  { id: 'thirty-days-does-not-read-as-one-post', origin: 'the second draft\'s twist rule, 14 Sep 2026',
    input: 'A window cleaner with one service and no premises.',
    grades: 'Twenty-two posts, and no two of them make the same point.',
    grader: { by: 'judge', question: 'Do any two posts make the same point in different words?' } },

  { id: 'channels-they-have', origin: 'the second draft\'s channel mandate, 14 Sep 2026', held: true,
    input: 'A barber with a Facebook page and an Instagram account, and nothing else.',
    grades: 'LinkedIn and short-form video are not mentioned anywhere in the plan.',
    grader: { by: 'code', fn: 'validateShape' } },

  { id: 'written-for-the-channel', origin: 'rule, CLAUDE.md 3',
    input: 'A consultant on LinkedIn and Instagram.',
    grades: 'The LinkedIn post takes a position and runs long. The Instagram one leads with the photo.',
    grader: { by: 'judge', question: 'Could these two posts be swapped between channels without anyone noticing?' } },

  /* ── Photographs ────────────────────────────────────────────────────────── */
  { id: 'shot-they-can-take', origin: 'rule, CLAUDE.md 6.4',
    input: 'A mobile dog groomer working out of a van.',
    grades: 'Every shot instruction is possible on a phone, in a van, this week.',
    grader: { by: 'code', fn: 'checkShot' } },

  { id: 'no-generated-image', origin: 'rule, CLAUDE.md 3',
    input: 'A business with no photographs of its own work at all.',
    grades: 'It asks them to take one. It never offers to make one.',
    grader: { by: 'judge', question: 'Does the plan offer an image we would produce?' } },

  /* ── Local, and who they sell to ────────────────────────────────────────── */
  { id: 'studio-is-not-local', origin: 'rule, CLAUDE.md 6.3', held: true,
    input: 'A three-person design studio in Shrewsbury selling to clients in London and Berlin.',
    grades: 'Nothing says local, nearby, or on your doorstep.',
    grader: { by: 'code', fn: 'findLocalAssumptions' } },

  { id: 'barber-is-local', origin: 'the inverse of the above',
    input: 'The Shrewsbury barber.',
    grades: 'Local is used where it is true, and is not avoided out of caution.',
    grader: { by: 'judge', question: 'Does the plan dodge saying something true about where they work?' } },

  /* ── The export ─────────────────────────────────────────────────────────── */
  { id: 'export-is-clean', origin: 'rule, CLAUDE.md 6.2',
    input: 'Any plan, exported.',
    grades: 'No feedback control, no critique label, nothing about how the tool works.',
    grader: { by: 'code', fn: 'findFeedbackPrompts, findBuildDetail' } },

  { id: 'gaps-are-listed', origin: 'rule, CLAUDE.md 4',
    input: 'A plan with five gaps in it.',
    grades: 'All five are listed at the end, so none goes out blank.',
    grader: { by: 'code', fn: 'findUnlistedGaps' } },

  { id: 'dates-are-real', origin: 'rule, CLAUDE.md 6.7',
    input: 'A plan generated on 20 December.',
    grades: 'No post is dated before the run, and nothing writes to an occasion that has gone.',
    grader: { by: 'code', fn: 'validateDates' } },

  { id: 'not-a-template', origin: 'base-prompt.md', held: true,
    input: 'Two businesses in the same trade in the same town.',
    grades: 'The two plans do not share a post.',
    grader: { by: 'judge', question: 'Would either plan fit the other business unchanged?' } },
];
