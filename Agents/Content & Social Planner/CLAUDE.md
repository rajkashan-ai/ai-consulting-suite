# Content & Social Planner

> **Status:** defined and built 2026-09-14. Two Gemini drafts, both reviewed with Raj the same day.
> What each review kept, cut and changed is in `memory.md`.
>
> **Customer-facing name:** "Plan what to post" (the landing page's wording).
>
> Every tool prepends `Agents/_shared/base-prompt.md`. This file adds what is specific to this one.

---

## Header, as it appears in the app

**Content &amp; Social Planner**

> Plan what to post so people can find you&mdash;turning your real-world expertise into steady authority content without staring at a blank screen.

_Set by Raj 2026-09-14. Customer-facing. The landing page sells the same tool by its job._

---

## 1. Who it is for and what it answers

An owner who has gone quiet online and does not know what to say. Their problem is not that they
lack ideas about their own trade. It is sitting down at nine at night in front of an empty box.

## 2. What it takes in

| Input | Where it comes from |
|---|---|
| The business, what it does, who it sells to | The business profile every tool reads |
| Their voice | Their own website copy, and the voice note (§2a) |
| **How often they post** | **We recommend one and say why** (§2b). They can change it |
| Tone, channels | Named options and detected-then-confirmed. Never a free-text box |

**Cadence is recommended, not asked (decided 2026-09-15, supersedes the three-option question).**
A month of posts written for someone who will manage three is worse than three they finish, and a
consultant who lists three options and waits is an order-taker. We recommend one and show the
arithmetic. They can change it in one press, and their choice always wins.

**Channels are the ones they have.** A barber with Facebook and Instagram gets a Facebook and
Instagram plan, and LinkedIn is not mentioned. Telling someone to start a channel is a claim about
their market with nothing behind it. Where a channel they have is a poor fit, say so once and plan
for it anyway. The one exception is §2b's step up, which may name a channel they already own and
are not posting to, because that is a gap we can see rather than a market claim.

**No uploads, no brand questionnaire.** Nothing to upload, no lexicon form, no anti-persona. We do
not generate images (§3), so nothing would ever read a palette, and a questionnaire is the thing the
onboarding promise avoids. §2a gets the same result from what they have already published.

## 2b. What the recommendation may rest on

Their own answer about their time, and from month two what they told us went out. Never a rate
counted off a platform. Why, and the correction that was itself corrected, in
`references/cadence-evidence.md`.

## 2a. The voice note: what they told us about how they write

One short block of prose on the business profile, in plain words: how they sound, the words they
use, and the words they will not say. It starts as our read of their own website copy. It is shown
back to them in one pass to confirm or correct, never asked for as a form.

**It gets better over time**, because every critique (§5) is written into it. A correction made in
September still holds in January, and in the other five tools, because it lives on the profile
rather than inside one plan.

## 3. What it produces

A 30-day plan, **shaped in full on day one and written a week at a time** (decided 2026-09-15).
Thirty days, not ninety: a small business planning a quarter of content in advance is planning for
a version of itself that will not exist by then.

**The shape and the words are separate.** Every slot, its date, channel, angle and purpose, exists
from the first run. It is arithmetic, it costs nothing, and it is what makes the mix and the
no-repeat rule hold across weeks nobody has written. The words arrive a week at a time, which is
cheaper and means a correction is picked up by writing next week correctly rather than by rewriting
work already done.

**Dates are recommendations.** The day carries its reason, a day late is fine and says so, and
**nothing is ever marked overdue, late or missed.** The screen says what is next, never what is
due. A plan that reproaches them is the thing this tool exists to avoid.

```
## What we suggest
   The cadence, what it costs, and the step up in one line. §2b.

## What you sound like
   The angle and the voice, read from their own site. Two or three sentences.
   Not a personality quiz result. What they already sound like, named back to them.

## This week
   The written posts, open and readable. Each one:
     - The day we suggest, its reason, and the channel
     - The finished words, in their voice, at the right length for that channel
     - What to photograph, in one line
     - Why this post, in one line

## The rest of the month
   One line per week: what it is about, how many posts, which channels.
   Real from day one, because the shape exists. The words arrive when they reach it.

## What to fill in
   Only on a document covering more than one week, where a blank can be
   scrolled past. On a week, the amber marks it and the count says how many.

## What we did not write

Deliberate omissions, each with its reason, in `references/not-written.md`. Read it before
adding something that looks missing: most of it was left out on purpose.

## 3a. The mix, and what stops it repeating

**Counts, not percentages.** Seventy per cent of four posts is 2.8 posts, and four posts is what a
weekly cadence means. So the mix is whole posts, per cadence:

| Cadence | Posts in 30 days | Useful | A question for them | An offer |
|---|---|---|---|---|
| Once a week | 4 | 3 | 0 | 1 |
| A couple of times a week | 9 | 6 | 2 | 1 |
| Most days | 22 | 15 | 5 | 2 |

**Never nought offers over a month, and never more than two.** A month with no ask in it has failed
at the job the tool exists for. Three is the one the owner is embarrassed to post. At four posts a
month the question post is what goes, because a poll is what you can least afford at four.

**No angle twice in a row, and none more than three times in a month.** Every slot carries one
angle from the named set in `src/types.ts`. **Checked on the shape, not on the words**, which is
what makes it hold for weeks nobody has written. Never explained to the customer: our working does
not belong in their export.

## 4. The rule that governs this tool

**Never put a claim in their mouth that they have not given us.**

This tool writes as the business. Whatever it produces, the owner posts under their own name, so
an invention here becomes their lie, not ours.

Never invent:

- a client name, or a job that was done for them
- a result, a saving, a percentage, a timescale
- a qualification, an accreditation, an award or a number of years
- a review or a quote from a customer
- a number of customers, jobs or followers

The example to test against, verbatim, is "How we solved a complex commercial heating failure for
Acme Corp". Where a post needs a real example it leaves a gap the owner fills, and the gap says what
to put in it: "[name the job you did last month]". **A blank is always marked where it is and
counted where the reader can see the count.** Listed again at the end only when the document runs
longer than a week.

**Facts about their trade are fine.** Boiler servicing intervals, what a regulation requires, when
people book. Checkable, and not claims about them.

## 5. Changing the plan: the critique loop

The owner edits any post in place, or names what is wrong: too salesy, too formal, not how I talk,
too long, I would not say that about myself.

| Rule | Why |
|---|---|
| **A critique is written into the voice note (§2a)** | The correction has to outlive this plan, or they make it again next month |
| **An unwritten week is written correctly, never rewritten** | Since 2026-09-15 most of the cascade is simply gone. Only this week's unwritten posts need redoing |
| **Rewriting is offered, never automatic** | One click once rewrote every later post, and the owner asked for none of them |
| **A post they have edited is never overwritten** | Their words beat ours. The one rule in the tool with no exception |
| **An approved post is never overwritten** | Changing it behind them is how they stop trusting the page. Approval is per post, on the post: there is no "approve the week", because that word promised publishing and only set a flag |
| **It says how many it will change, before it changes them** | "This will rewrite 2 of this week's 3." |
| **One batched rewrite, never one call per click** | Cost. `most days` at a flat price is the case that breaks if this is wrong |

**Named options, not a free-text box**, for the reason in `UI/CLAUDE.md` §6a: a count is actionable
and a mood is not. Free text sits underneath and goes into the voice note in their own words.

## 6. What it must never do

1. **Never invent anything about the business.** §4.
2. **Never put a feedback prompt inside the plan.** It gets exported. Feedback lives in the app
   around the document.
3. **Never assume they are local.** Wrong for a studio competing nationally. Work out which.
4. **Never write a post that needs a photo they cannot take** on their phone this week.
5. **Never produce more than the cadence they settled on.**
6. **Never overwrite a post the owner has edited or approved.** §5.
7. **Never mark a post overdue, late or missed**, and never write to an occasion that has gone.
   A day carries a reason, not a deadline. §3.
8. **Never promise a result.** Not from posting more, not from posting at all. The step up is
   costed and scoped, never sold. §2b.
9. **Never research a competitor here.** That is the Competitor Tracker's job, it costs a second
   research run, and two tools answering the same question is two answers. §8.
10. **Never an em dash, and never AI speak, in anything they post.** Added 2026-09-16 by Raj.
    `base-prompt.md` has said "no jargon, no buzzwords, no em dashes" since the first version and
    nothing checked it, so the first live run put eight em dashes and three en dashes into two
    posts. An em dash is the single clearest tell that a person did not write something, and the
    owner is putting their name on it. §6b says what happens to each.

## 6c. The bar, and who sets it (added 2026-09-16 by Raj)

Raj sets it, not the model and not me. The rules and the worked examples are in
`references/the-bar.md`.

## 6b. House style, enforced rather than asked for

Enforced by tests rather than asked for in a prompt, which is what stops it drifting. The rules
are in `references/house-style.md`.

## 6a. Tracking what went out

The owner pastes the live link and presses Posted. That needs no connected
account and gives us the caption **as published**, which drives the learning.

**The count says which count it is.** Posts through this tool and posts on their
account are two numbers, and showing the first as the second tells a barber of
four years that they have posted twice. Connecting an account is the only way to
see the second, and it is also the only way §2b's "we cannot count what they post
now" stops being true.
**Metrics need a connected account**, a business or creator one, and the screen
says so rather than showing an empty box.

**We report what happened and never why.** "Your 22 September post reached 412,
the most this month" is a reading. "Because it had a photo" is an inference off
nine data points with no control, and `findUnearnedInference` refuses it in every
phrasing. Not a threshold to raise later: more data would still not make us the
ones who ran the experiment.

**A solid learning is never given twice.** Learnings live on the profile, carry
their evidence, are applied to every later run, and cannot vanish, be rewritten
or be retired without a reason. Four guards, one per failure. Method, the API
constraints and what it costs to connect: `tracking.md`.

## 7. Build notes

`build-notes.md`. Read once, while building. `tests/README.md` says what the suite covers.

## 8. Open

1. **The repurposing playbook and the per-format asset specs** are both out. They told the owner to
   do more work, and posts written per channel leave nothing to repurpose. Revisit if asked.
2. **Scheduling.** This plans and writes. It does not post. That needs their account credentials
   and is not in this build. Connecting accounts would also make §2b measurable on run one.
3. **Reading the battlecard.** A gap in the Tracker's table is the best post idea in the product,
   and it is also the only route to a §2b reason drawn from outside the business. Settled rule:
   read the stored run, never search, carry the source and date. Not wired in v1.

## Never state a limit you have not tested (added 2026-09-16, applies to the whole suite)

A claim that something CANNOT be done is a factual claim and needs the same evidence as one that
says it can. "The prices are not readable", "Instagram blocks us", "there is no way to get the post
dates" were all said in one day and all three were wrong: the prices were on the page as `&pound;`,
the public profile loads without signing in, and Instagram encodes each post's date in its own
shortcode.

A limitation is never challenged, because it sounds like honesty rather than an assertion. That is
what makes it dangerous: an invented limit silently decides what the customer is never offered.

**Attempt it first. Report what you ran and what came back, not the conclusion alone.** If it truly
fails, say so with the evidence. See the suite `CLAUDE.md` 1.4.10 and the practice `CLAUDE.md` §1.
