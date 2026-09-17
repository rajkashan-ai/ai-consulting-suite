# Tests for the Content & Social Planner

```bash
npm test          # or: node --test tests/*.test.ts
```

No install, no network, no `node_modules`. Node runs the TypeScript directly.
The whole suite is a tenth of a second, so there is no excuse not to run it.

**Green is `ℹ fail 0`.** The runner prints a stack trace and an `✖ failing
tests:` header for every `todo` case, which is expected and is not a failure.
Two sessions have misread that line as a regression. **And the suite size is not
written down here**, because it was 66 in three files on the day it was 199.

## What is here

| File | Holds |
|---|---|
| `plan-shape.test.ts` | How many posts, on what dates, in what mix, and no angle twice |
| `guards.test.ts` | Section 4: never put a claim in their mouth that they have not given us |
| `voice.test.ts` | The critique loop, and that their words are never overwritten |
| `hard-rules.test.ts` | The never-do list in `CLAUDE.md` section 6, one test each |
| `missing-data.test.ts` | Every shape of hole, and that nothing treats one as a zero |
| `adversarial.test.ts` | Instructions hidden in the copy we read, and claims dressed as quotes |
| `recommend.test.ts` | The cadence recommendation, its sources, and the promise guard |
| `contract.test.ts` | The export carries the sections `CLAUDE.md` §3 names, in order, and each has something under it |
| `tracking.test.ts` | What went out, the three connection states, and the line between a reading and an inference |
| `learning.test.ts` | The four ways a learning is lost, one test each |
| `screen.test.ts` | Every guard, run over the real rendered screen rather than sentences we chose |
| `oembed.test.ts` | Reading the published caption back, with the network injected out |
| `wiring.test.ts` | Every guard is plugged into an aggregator, and every export is wired or declared |
| `evals.test.ts` | Checks the eval set is trustworthy before its score means anything |
| `fixtures/` | Two businesses and one clean plan |

Code tests live here. What the tool *writes* is graded by `evals/cases.ts`, because
an equality check on a prompt fails at random and then gets disabled.

## Real data and fixtures

Anything marked REAL was read by hand from The Barber Shop Shrewsbury on
14 September 2026, the same run the Competitor Tracker suite uses. Everything
else is SYNTHETIC and exists to make one edge case happen. Nothing synthetic is
ever stated as a fact about a real business.

The posts in `fixtures/businesses.ts` are what the tool should produce for that
barber: they use only the services and prices on his own site, and every place
where a real example is needed is a gap rather than an invention.

## The tests are the ledger

There is no separate list of test cases, on purpose. A document like that goes
stale and then lies. A bug becomes a test here before it is fixed, and no test
is ever deleted to make the build green.

## They have been proven to fail

Seven deliberate breakages, all caught:

| Breakage | Tests that went red |
|---|---|
| Let the plan run past the cadence | 3 |
| Overwrite a post the owner edited | 4 |
| Stop checking prices against what we read | 2 |
| Allow the same angle twice running | 1 |
| Allow a shot they cannot take | 2 |
| Let a feedback prompt into the export | 2 |
| Allow a post dated before the run | 2 |

Seven more on 15 September, for the recommendation and the recommended dates,
all caught: a promised result let through (6 red), a reason's source unchecked,
a step down of more than one notch, their stated time ignored, the cost line
dropped, overdue language allowed, a gone occasion left standing.

Six more on 15 September, for the wiring: unwire a guard from `validatePlan`
(2 red), unwire one from `validateRecommendation` (3), add an export nothing
calls (1), grade unwritten slots as prose (1), let an invented angle through,
let a week outside the month stand (1).

**That run is why `wiring.test.ts` exists.** The invented-angle breakage came
back **0 red** the first time: the guard had just been wired and nothing covered
it. Wiring a guard and covering it are two different jobs, and only the
breakage run tells them apart.

Re-run that check after any change to `src/guards.ts` or `src/recommend.ts`.
A guard nobody has watched fail is decoration, and a guard nothing calls is not
even that.

## Defects the suite found on the day it was written

Three, all in code written minutes earlier and believed correct.

1. `%\b` never matched "30%", because neither side of that boundary is a word
   character. The percentage rule read correctly and caught nothing.
2. The count pattern needed two digits, so "0 jobs" got through. A zero is the
   number a tool is most likely to invent.
3. `weekly` produced five posting days against a mix that adds up to four.

## And thirteen the suite did not: `breakit.test.ts`

An independent pass on the same day, written blind against `CLAUDE.md` before
its author read a line of `src/`. 105 cases, 20 red. Four mattered.

1. **`CLAUDE.md` §4's own worked example was not caught.** The suffix list held
   `Ltd` and not `Corp`, and `guards.test.ts` quoted the real example in a
   comment and then asserted a different one. An assertion shaped to the code
   rather than to the requirement, which is why nothing noticed.
2. **`rewriteCallCount` could not go red.** It returned
   `critiques.length === 0 ? 0 : 1` and never observed a call, so the cost
   control `build-notes.md` calls the line item that decides the price had no
   live check. Now `checkRewriteCalls`, which takes the calls actually made.
3. **`[]` was not a gap.** `[^\]]+` needs a character, so the emptiest bracket
   was the one that got through. `[ ]` and `[TBC]` were both caught.
4. **`\bpurpose:\b` matches nothing**, the same word-boundary defect as `%\b`,
   in a second place. And `BUILD_WORDS` held `oauth` but not one angle name.

The rest were word-list holes: `Corp`, "twenty years", "200 pounds",
`Gas-Safe`, `500+`, "0 complaints", "near you", "tell us what you think", the
thumb emoji, and a zero-width space closing "Gas Safe" into "GasSafe". Text is
now normalised before any word list touches it (`flatten`).

Two more that were not word lists: a critique on the later of two posts sharing
a date swept the earlier one into the rewrite, and `findOverwrites` matched by
date alone and so could compare the wrong pair.

**`hard-rules.test.ts` §6.3 was a test that could not fail.** It asserted the
clean plan carries no local words, which is true whether or not
`findLocalAssumptions` works. Proven by gutting the function to `return []` and
watching the file stay green.

## What the suite does not tell you

It does not tell you the product works. There is no writing engine and no app:
the guards are correct about output nothing currently produces, and the screen
is markup generated once from the fixture rather than by the library it mirrors.
A green run means the rules hold, not that anything runs.

## One known gap

The claim detector reads English. A post written in Welsh, Polish or Urdu gets
none of section 4's protection, and the tool would happily produce one. `A30`
and `A31` in `breakit.test.ts` are marked `todo` against it, the same way the
Competitor Tracker marks its Unicode gap. Written down rather than left for a
customer to find.
