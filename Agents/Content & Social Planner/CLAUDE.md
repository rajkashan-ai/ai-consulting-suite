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

**Say the number, then what it costs.** "Two a week. That is 9 posts and 9 photographs between now
and 13 October, across Instagram and Facebook." Every reason is a fact we hold: our own arithmetic,
their answer about their time, which channels are quiet, and from month two the only measured
evidence in the feature, how much of last month they actually posted.

**We CAN count what they post now. Corrected 2026-09-16, the old text was wrong.**

It said "we cannot count what they post now, and there is no benchmark. Both closed, both easy to
fake." The first half is false and it was never tested. A public Instagram profile loads without
signing in, and every post's creation date is encoded in its own shortcode, so the rate is
arithmetic on data anybody can see.

Measured on a real Hertfordshire bakery the same day, in about a minute:

    last posted      15 September, one day ago
    last 30 days     6 posts
    average gap      2.4 days

That is their current cadence, read rather than asked for. It changes the recommendation from a
guess against nothing into a comparison against what they already do, which is the whole point of
"step up" and "step down" meaning anything.

**What is still true:** there is no industry benchmark worth quoting, and counts can be inflated by
someone who wants to. So we say what we counted and when we counted it, the same as every other
claim in the suite, and we never compare them to an invented average.

**And it is still theirs to confirm.** Read it, show it back, let them correct it. What is allowed,
and the step-down case: `recommendation.md`.

Method: the profile is public, `lib/research/fetch.ts` rules apply, and nothing signs in to
anything. Decoding a shortcode is base64 over `A-Za-z0-9-_` to a media id, then
`(id >> 23) + 1314220021721` milliseconds.

**The step up is cost and coverage, never results.** "Three a week would let your beard work have
its own thread instead of one post a month" is ours to say. "Three a week will get you more
enquiries" is not, in any phrasing. `findPromisedResults` refuses it.

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
   Every gap with its reason beside it. Never a gap on its own.
```

**That list is the exported document**, which leaves the app and goes to their
customers. `tests/contract.test.ts` asserts the export carries exactly it, in
order, because a section can otherwise vanish and no test notices, which happened
to this export before anything checked.

### The screen is a different list, and it is also a contract

    What you have posted
    How often we suggest you post
    What you sound like
    This week
    Resize a photo
    The rest of the month
    What we did not write

The screen holds two things the document does not, and neither belongs in a file
sent to a customer: what has gone out so far, and the resizer.

**The resizer was on neither list until 2026-09-16 and was therefore dropped**,
silently, when the screen was rebuilt for the app. It had been built, tested and
on the mockup, and the contract that was supposed to protect it had never been
told it existed. A section on no list is a section nobody is keeping.

**This list is the contract**, and `tests/contract.test.ts` asserts the export carries exactly it,
in order. A section can otherwise vanish and no test notices, which happened to the screen on
15 September and to this export before anything checked.

**Finished posts, not hooks.** Each entry is the actual caption, long enough to paste straight in.
A theme and an opening line is still a blank page, and the blank page is the whole problem.

**Every post carries a shot instruction.** One line, plain: "a photo of the boiler before and
after, taken on your phone in daylight". We write the words, they supply the proof.

**We do not generate images.** A photo of a tradesperson who is not them, on a job that never
happened, is the same fabrication as an invented case study.

**Each post is written for its channel**, not written once and pasted three times. LinkedIn runs
long and takes a view, Instagram leads with the image, a Google Business Profile post is an offer
or an update. Word targets and character caps are in `src/types.ts`.

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

**Nothing here rests on this tool's taste.** Raj: whoever sets the bar sets it for
everything we write, and it is not our judgement.

**There is no single Cagan for content, and inventing one would be the fabrication
this product exists to avoid.** Product management is one discipline with one
canonical voice. Content splits into three questions and each has a different
best answer, so three people set the bar, one per question.

| The question | Who answers it | The bar |
|---|---|---|
| Is this post worth posting at all? | **Jay Baer, _Youtility_** | Useful enough that someone would pay for it, and useful to a reader who never buys. Help, do not sell |
| Is it written like a person? | **Ann Handley, _Everybody Writes_** | Clear, concrete, in their own voice. Already named in `base-prompt.md` |
| Is the month shaped right for the channel? | **Gary Vaynerchuk, _Jab, Jab, Jab, Right Hook_** | Give repeatedly, then ask once. Written for the platform, never written once and pasted |

**What each one already governs, and what now checks it:** `bar.ts`.

### The order of authority

1. **Measured evidence about this business** beats everything. What they actually
   posted, what they changed about our wording, and what the numbers said.
   `learning.ts` holds it, with its evidence, and a solid learning is never given
   twice.
2. **The three above**, where there is no evidence yet, which is every business on
   day one.
3. **This tool's judgement.** Never. If a rule is not one of the first two, it is
   not a rule, and a check that encodes our taste is worse than no check because
   it is invisible.

**Evidence replaces the default, it does not argue with it.** When the numbers say
something for this business, the number wins and carries its date and its source.
Until then the named bar applies and says whose it is.

### Honest about what is checkable

A rule that cannot be checked mechanically is a rule that holds until somebody is
in a hurry, so each is written as a check or admitted as unchecked:

- **Vaynerchuk's ratio and platform fit are fully checked**, in `MIX` and in the
  per-channel word targets and mediums. They were before anyone named him.
- **Baer is partly checked.** A post can be tested for whether it carries a fact a
  reader could use without buying. It cannot be tested for whether that fact is
  worth paying for.
- **Handley is partly checked.** Sentence length, jargon and the house style are
  mechanical. Whether a sentence sings is not, and no guard should pretend.

The unchecked remainder is the case for `build-notes.md`'s standing instruction to
read a full `most days` plan end to end, by hand.

## 6b. House style, enforced rather than asked for

**A dash is mechanical, a word is not, so they are handled differently.**

An em dash or an en dash between words is punctuation, and swapping it for what a
person would have typed changes nothing else in the sentence. So it is repaired,
silently and deterministically: a comma, or a full stop where the dash was doing
a full stop's work. Dropping a finished post over a typographic mark would cost
the owner a post to fix a keystroke.

**AI speak is a word choice and there is no safe swap**, so a post carrying one
is refused the same way an invented claim is, and the reason says which word.
"Leverage" is not a worse way of saying something true; it is the sentence a
person would not have written, and rewriting it here would be us guessing what
they meant.

**Asked for in the schema as well as the prompt.** A length or a ban asked for
politely drifts (`CLAUDE.md` 1.4a). The schema pattern refuses a dash outright,
so the model usually cannot return one in the first place, and the check
afterwards exists because a schema is the model's constraint and not a promise.

The list is `HOUSE` in `web/tools/content-social-planner/scrub.ts`, beside the
guards it runs with. It is the root `CLAUDE.md` §10 list plus the words that
turn up in social copy.

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
