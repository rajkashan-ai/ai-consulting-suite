# Tests for the Competitor Tracker

```bash
npm test          # or: node --test tests/*.test.ts
```

**Green is `ℹ fail 0`.** The run prints a stack trace and an `✖ failing tests:`
header for the one `todo` case, which is expected and is not a failure. Two
sessions have now read that header as a regression and stopped to investigate
nothing. Read the summary line, not the exit output.

No install, no network, no `node_modules`. Node runs the TypeScript directly.
The whole suite is well under a second, so there is no excuse not to run it.

## What is here

| File | Holds |
|---|---|
| `competitor-set.test.ts` | Five, never six. Permanence. Duplicates. Hostile names |
| `freshness.test.ts` | Once a week, never more. Clock skew. What changing the list does |
| `evidence.test.ts` | Sourced and dated. Empty cells. Stale. Named reviewers |
| `actions.test.ts` | Three, ranked, area-tagged, evidence-backed |
| `hard-rules.test.ts` | The never-do list in `CLAUDE.md` section 5 |
| `failures.test.ts` | 403, 404, timeout, robots, empty body, login, cost cap |
| `missing-data.test.ts` | Every shape of hole, and that nothing treats one as a zero |
| `adversarial.test.ts` | Injection, exfiltration, SSRF, one customer reading another's data |
| `wiring.test.ts` | That every guard is **plugged in**, **covered**, and that nothing is orphaned |
| `structure.test.ts` | That each screen still has the sections and bands it is meant to |
| `screen.test.ts` | Every guard over the real screen, **and** that each still fires on a real violation |
| `battlecard.test.ts` | What the gate reports once it is wired |
| `reviews.test.ts` | Themes not individuals, loyalty to a person, choice signals |
| `positioning.test.ts` | Self-claims labelled, predictions checkable, what counts as evidence |
| `activity.test.ts` | Still trading or gone quiet, and the sample size under it |
| `search-visibility.test.ts` | Who comes up for a term. Never a rank position |
| `ad-library.test.ts` | The Meta query, and what it may not ask for |
| `candidate.test.ts` | A name the customer typed, and whether we can find anything |
| `evals.test.ts` | Checks the eval set is trustworthy before its score means anything |
| `styles.test.ts` | The two pages carry one stylesheet and have not drifted |
| `fixtures/` | The company archetypes and the hostile pages |

This table listed 9 of 17 files until 15 September. The section below says a
list like this goes stale and then lies, and this one had. It is here because
it is a list of *files*, which change rarely; if it drifts again, delete it
rather than repair it.

Code tests live here. What the tool *writes* is graded by `evals/cases.ts`, because
an equality check on a prompt fails at random and then gets disabled.

## Real data and fixtures

Anything marked REAL was read by hand from the Shrewsbury barber run on
14 September 2026. Everything else is SYNTHETIC, uses `example.com`, and exists
to make one edge case happen. Nothing synthetic is ever stated as a fact about a
real business.

## The tests are the ledger

There is no separate list of test cases, on purpose. A document like that goes
stale and then lies. A bug becomes a test here before it is fixed, and no test is
ever deleted to make the build green.

## They have been proven to fail

Two kinds of breakage, both re-run on 15 September.

**Behaviour**, seven deliberate breakages, all caught:

| Breakage | Tests that went red |
|---|---|
| Let the list grow to six | 3 |
| Silently drop the customer's own picks | 3 |
| Re-run fresh on every visit | 4 |
| Stop checking that claims are sourced | 2 |
| Allow an action built on a field we never read | 2 |
| Allow discovery via a booking platform's search | 3 |
| Allow fetching an internal address | 3 |

**Every guard, neutered in turn** — each made to return a vacuous value, all
eleven caught:

| Neutered | Red | | Neutered | Red |
|---|---|---|---|---|
| `findRankClaims` | 2 | | `findBuildDetail` | 4 |
| `findUnboundedCounts` | 3 | | | |
| `findTrafficClaims` | 5 | | `findUnexplainedGaps` | 1 |
| `findFeedbackPrompts` | 1 | | `findNamedReviewers` | 3 |
| `findUnsourcedClaims` | 3 | | `validateActions` | 12 |
| `findImpossibleDates` | 2 | | `areasCovered` | 1 |
| `findStaleClaims` | 1 | | | |

Re-run both after any change to `src/guards.ts`. A guard nobody has watched fail
is decoration.

**Wiring and coverage are two different jobs.** A guard can be correctly
plugged into the gate and have no test at all; the wiring check passes it,
because it *is* in the aggregator. Only the breakage run, or the second
assertion in `wiring.test.ts`, tells the two apart. The Content & Social
Planner hit exactly this while copying the gate across: it wired a new angle
guard, the wiring test went green, and the breakage run came back `0 red`.

**And point them at the thing that ships.** Every guard had unit tests and none
had ever been run over the real screen. Doing that on 15 September found three
defects in one pass: an unbounded count the manual sweep missed, twelve false
positives from `findNamedReviewers` (an `/i` flag had switched its own
capitalisation test off), and a boundary list so narrow it flagged sentences
that already named their denominator. Two of those were guards crying wolf,
which is the failure that matters most: the suite stays green either way, and a
guard nobody reads protects nothing.

**And watch the wiring, not just the guard.** `findRankClaims` passed every one
of its five unit tests for a week while being called by nothing at all. A unit
test proves a guard works; it cannot prove the guard runs. That is what the
first test in `battlecard.test.ts` is for, and why it reads the source of
`guards.ts` rather than trusting a fixture to trigger every branch.

## One known gap

`competitor-set.test.ts` carries a `todo`: a name using Cyrillic letters that look
like Latin ones gets past the duplicate check, so the same business can appear
twice. Needs a Unicode confusables map. Written down rather than left for a
customer to find.
