# Content & Social Planner: what we learned

> Defined and built 2026-09-14. The tool's rules live in this folder's
> `CLAUDE.md`, with their reasons and no dates. This file holds the dated record
> of deciding them, real outputs that were wrong and why, and anything that
> turned out to be untrue in `CLAUDE.md`.

## 2026-09-14 — Reviewing the second Gemini draft

A four-phase pipeline with a critique loop. One idea in it is worth more than
everything we had. Most of the rest breaks a decision already made.

### Kept

**The critique loop, and the memory behind it.** The best idea in either draft.
An owner clicking "too salesy" on post two should change posts three onwards, and
more than that, the correction should still hold next month and in the Proposal
Builder. That became §2a, the voice note, which lives on the business profile
rather than inside a plan. It is the only part of this tool that gets better
over time.

**Repetition is the real failure of a thirty-day plan.** The draft called it the
twist rule. Right diagnosis. Now §3a, as an angle on every post, checked in code.

**Named critique options rather than a text box**, which is the same reasoning
as the feedback panel in `UI/CLAUDE.md` §6a: a count is actionable, a mood is not.

### Cut

**Brand fingerprinting from uploaded designs.** A multimodal pass logging palette,
typography and layout. Nothing downstream would ever read it, because we do not
generate images. A business of one to twenty people has no design references to
upload, and the upload itself is the form the onboarding promise avoids.

**The brand bible: lexicon and anti-persona.** A questionnaire. The good half of
it, the words they will not say, is now read off their own copy and confirmed in
one pass.

**The mandated three-channel audit.** "You must explicitly analyse LinkedIn,
Instagram/Facebook and short-form video. Do not omit any." It contradicts the
channel rule we already had, it writes for channels the business does not have,
and "current platform realities" is market fact with no source behind it, which
`base-prompt.md` forbids outright.

**Competitor gap analysis inside this tool, with a quota of two findings.** It
duplicates the Competitor Tracker, doubles the cost of a plan, and gives two
tools one question to answer two ways. The quota is the worse half: "at least
two verified wins or blind spots" forces an invention on the run where there is
nothing to find, which is the lesson the Tracker already learned as "coverage is
never forced". Reading the stored battlecard is settled and sits in §8.

**Per-format asset specs.** 9:16 scripts, 1:1 crops, multi-slide PDFs, for a
plumber who will film none of them.

### Changed

**70/20/10 became counts.** The ratio is arithmetic that cannot be satisfied at
the sizes we actually produce. Seventy per cent of four posts is 2.8 posts. §3a
is whole posts per cadence, and it adds up.

**"Rewrite all subsequent posts" became an offer with two exceptions.** As
drafted, one click rewrote twenty-six posts, including the ones the owner had
already fixed by hand and the ones they had marked done. Their words beat ours.
It now says how many it will change before it changes them, and it is one
batched call, because a full regeneration per click at `most days` is the case
that makes a flat price a loss.

**"Reject output and restart pipeline" became tests.** A prompt cannot reliably
police its own output. Those conditions are `src/guards.ts` and the suite.

**The prompt's own voice.** It banned buzzwords while being written in them:
platinum-standard, co-pilot, absolute rigor, zero tolerance. "Co-pilot" also
collides with a Microsoft product name. And "deterministic" is not true of any
of this.

### What neither draft mentioned

**Nothing in either stopped a claim being invented**, which is the one rule that
governs this tool, because the owner posts every word of it under their own name.

## 2026-09-15 — Posts: recommend, and write a week at a time

Raj: the tool should recommend how often to post from data and evidence; the
dates are recommendations too; and nine posts stacked on top of each other is
overwhelming, you cannot see the wood for the trees.

**The recommendation is right and the evidence was thinner than it looked.** We
cannot count what they post now, on any run: Instagram's `robots.txt` names
`ClaudeBot` with `Disallow: /` and Facebook returns 400 logged out, recorded on
the Tracker on 14 September and true of our own customer's profile for exactly
the same reason. And no benchmark has been bought. So the recommendation rests
on arithmetic, their own answer, which channels are quiet, and from month two on
how much of our own last plan they marked done. **That last one is the only
measured evidence in the feature and it arrives free**, which is worth carrying
to the other five tools: our own output becomes our evidence base in month two.

**`ReasonSource` has no 'benchmark' member on purpose.** A type that cannot
express the claim is a better guard than a rule saying not to make it.

**Raj asked for capacity "with suggestions for improvement", which is the
two-lens rule.** Capacity alone is efficiency-only. So the step up has two
sentences under different rules: what it costs, which is our arithmetic and
always safe, and what it covers, which has to point at a channel they own and
are not using or a subject our own plan cannot fit. What happens next is
refused, including the polite forms: "tends to", "should help you", "often
leads to" are the same claim with a hedge in front.

**Splitting the shape from the words solved both downsides of writing weekly.**
Every slot's date, channel, angle and purpose exists from the first run, costs
nothing, and is what the mix and the no-repeat rule are checked against. So the
spine is real rather than a promise, a mid-month export can show the written
weeks plus the shape of the rest, and the reservation problem disappears. It
also mostly dissolves the critique cascade: an unwritten week is written
correctly instead of rewritten afterwards.

**"Never date a post in the past" was the wrong rule.** The date moving is fine,
which is the whole point of a recommended day. What goes stale is an occasion,
so the occasion became data on the post with the day it stops making sense, and
the guard checks that instead of the date.

## 2026-09-15 — A unit test proves a guard works, never that it runs

The Competitor Tracker audited its exports against its references and found
`findRankClaims`: written, documented as the guard against claiming a Google
rank, five passing unit tests, and **missing from the aggregator**. It had never
run. That session ran the same audit over this tool and found `isWritten`.

**Ours was worse than theirs reported.** Two guards written that same morning,
`findOverdueLanguage` and `findPastOccasions`, were tested and not in
`validatePlan`. `findPromisedResults` and `findUnsourcedReasons` had no
aggregator to be in. And `ANGLES` and `WEEKS` sat unread, so an invented angle
and a week outside the month were both unguarded.

`tests/wiring.test.ts` now reads the source and asserts every exported guard
appears inside an aggregator, so it catches the next one rather than this one.
It also forces a decision on every export: wired inside `src`, or on the
declared entry-point list, which is what the app calls.

**Three things that only showed up by watching it fail.** The gate caught its
own gap first: `validateRecommendation` was added and nothing tested it. Then
the entry-point test named its test files in a list, which is the same defect
`design-rules.md` records for breakpoint rules that name their children, so it
reads the directory now. And the first breakage run showed **0 tests red** for
the newly wired angle guard, because wiring a guard and covering it are two
different jobs.

**Stop writing the suite size into files.** It was 66 in three places and is not
now. One dated number, in the root `memory.md`, and nowhere else.

## 2026-09-15 — Two things only a person looking at the screen found

Raj, on the render. Both were invisible to every check in the suite and to the
computed-style audits, which measure whether the page follows the system and
cannot measure whether it makes sense.

**Rows that look clickable and are not.** The month spine was five
`.feed__row` buttons with chevrons, and three of the five are weeks not written
yet, so there was nothing for a chevron to open. A control has to name what
pressing it does, and a row that does nothing must not look like one. Now
`<li class="feed__row feed__row--static">`: no chevron, no pointer, not
focusable. **If a row ever does open something, only that row gets the
affordance.**

**A section repeating what the screen already said.** "What to fill in" listed
the two blanks that were already visible in amber a few inches above and already
counted in a tile at the top. Three tellings of the same fact, and it is the
`design-rules.md` rule "say it once, and say it where it is used" broken on my
own screen while I was quoting that file at the Competitor Tracker.

**What replaced the rule rather than just deleting it.** A blank is *marked*
where it is and *counted* where the reader can see the count. That is twice, and
twice is right: a count to notice, a mark to find. It is *listed* separately only
on a document covering more than one week, where a blank can be scrolled past.
`weeksCovered` decides, and `validatePlan` only asks for the list above one week.

**And a process failure worth more than either.** The edit that scoped that rule
was a string replacement that matched one of its two targets and silently did
nothing for the other, so `weeksCovered` was called and never defined. I did not
assert on the replacement. Worse, deleting the section by replacing a range
swallowed the band after it, and "What we did not write" disappeared without a
single test noticing, because no test asserts what sections a screen has.
**Assert on every edit that matches by string, and never delete by range.**

## 2026-09-15 — A test proves a thing works. Only an inventory test proves it is there

Three of these in one day, at three levels, and every suite stayed green through
all of them. The Competitor Tracker found the first, Raj found the second by
looking at the screen, and the third turned up while checking the gate built for
the second.

| Level | What went missing | What noticed |
|---|---|---|
| A guard | `findRankClaims`, and four of ours, written and tested and never called | An audit of exports against references |
| A screen section | "What we did not write", deleted by a range replacement | Measuring the rendered bands, by hand |
| A document section | The export said "The month" and "The posts" while the spec had said "This week" and "The rest of the month" since that morning | `contract.test.ts`, once it existed |

**Every test we had checked what a section contained. None checked it was
there.** That is the whole lesson, and it generalises past this product: an
assertion about behaviour cannot fail when the behaviour has been deleted.

`contract.test.ts` also asserts the section list **against `CLAUDE.md` itself**,
so the spec and the export cannot drift again without a red test. They had
already drifted within a day of my writing both.

## 2026-09-15 — Post tracking, and what a pasted link can actually tell us

Raj asked for per-channel counts with the last date, metrics per post, a paste
box with a Posted button, and the analytics fed back into later posts so a solid
learning never has to be given twice.

**Verified before designing any of it**, because the whole feature rests on one
fact. Instagram post insights need a Business or Creator account joined to a
Facebook page, OAuth, `instagram_manage_insights` and a 60-day refreshable
token. There is no route to reach or likes from a public URL.

**But oEmbed went tokenless on 15 June 2026**, which nobody here knew, and it
changes the shape of the feature. A pasted link gives the caption **as actually
published**. No engagement, ever, but what they published against what we wrote
is the strongest signal this tool has, and it costs nothing: no account, no
permission, no statistics. **Verify the constraint before designing around it.
Ours had moved three months ago.**

**Raj chose to build account connection.** I raised the statistics problem and
he took the decision, which is his to take. What I did not do is build an
inference engine on top of it. The rule that went in instead: **we report what
happened and never why.** "Reached 412, the most this month" is a reading with a
source and a date. "Because it had a photo" is a claim nine points cannot carry.
`findUnearnedInference` refuses the second, hedges included, and **it is not a
threshold to raise once there is more data**: more data would still not make us
the ones who ran the experiment. The learning comes from behaviour instead, where
three repetitions is a habit and no metric is involved.

**"Do not regress" is a property, and a property needs a guard.** Four ways a
learning is lost, one test each: never applied, learned twice (which means the
first was never applied), vanished or quietly rewritten or retired with no reason
given, and asked for again. Eleven new guards, all eleven broken on purpose and
watched to fail.

**And the gate I built this morning did not cover the code I wrote this
afternoon.** `wiring.test.ts` named its five source files in a list, so
`tracking.ts` and `learning.ts` were invisible to it — in the same file that
cites that exact lesson for its test files, two tests further down. It reads the
directory now. **A rule that lists its members does not stop applying to the
person who wrote the rule.** Once it could see them it immediately found two
unwired guards in the new code.

## 2026-09-15 — A button with nothing behind it

Raj: *"What does Connect Instagram do? What action is behind the button?"* It was
on the screen with no defined action, which is the clickable-row fault from two
hours earlier, repeated. **Putting a control on a screen before deciding what it
does is a habit, not an accident**, and it is worth checking for every time a
screen gains a button.

What it does is now written down: the eligibility check that comes *before* the
button so nobody is sent through a sign-in that ends in nothing, the five
permissions and what each buys, the 60-day token, and what the screen says when
it lapses. And the screen says the three things that decide whether someone
presses it: what we will see, **what we cannot do**, and what it needs first.

**`findOverclaimedAccess` exists because this copy sits next to Meta's own
permission screen**, which lists exactly what we asked for. A sentence promising
more is caught out one click later and there is no recovering it.

**Two fixes to my own guards while writing it, both the same shape.** The denial
check looked back thirty characters, so "We cannot post as you, read your
messages, or see who follows you" cleared the first clause and flagged the other
two: one "cannot" governs three clauses and the scope has to be the sentence.
And the breakage run for the count came back **0 red** on `0 posted`, because the
zero case, **the exact sentence Raj had objected to**, was the one my tests did
not cover. A guard is only as good as its least interesting case.

## 2026-09-15 — "Are there no existing posts for this client?"

Raj, on the render, and it was two faults at once.

**The tracking section was not on the screen at all.** I built the module, the
guards and the tests, and never rendered any of it. Nothing failed, because every
test checked the logic and none checked the screen used it. The same family as
the unwired guards and the deleted band, at a third level: **code that works,
tested, and not reachable by a customer.**

**And the count was wrong in a way that insults the customer.** It counted posts
that went out through this tool and labelled it "2 posted" for a barber who has
run an Instagram account for years. `throughUs` and `onTheAccount` are now two
fields, the line says which it is counting, and the last date is the later of
theirs and ours.

**The correction that matters most is the one behind it.** Connecting an account
does not only buy metrics, it buys *what they already do*, and that is worth
more. §2b was built on "we cannot count what they post now", which was true of
every route we had and stops being true the moment an account is connected.

## 2026-09-15 — "Why can't you wire it?"

Raj, on being told the connect buttons do nothing. The answer was that I had
conflated **"the last mile needs your credentials"** with **"nothing can be
built"**, and they are not the same sentence.

**Genuinely blocked, and it is exactly one thing:** registering a Meta app for an
App ID and Secret, and App Review for `instagram_manage_insights`. Both need
Raj's own login and neither is something to do on someone's behalf. Without a
`client_id` there is no OAuth URL to send anyone to.

**Not blocked, and it is the more valuable half:** the paste-a-link route. The
endpoint was called live and takes unauthenticated requests, so Posted → caption
→ diff → learning needs no app, no OAuth and no review. `src/oembed.ts` is built
and tested. **Check what is actually blocked before reporting a blocker**: most
of this was buildable the whole time.

**The gate could not see `export async function`.** Every pattern in
`wiring.test.ts` missed it, so an async guard would have been invisible and an
async entry point was reported as not existing. Fixed, and the breakage run
returned **0 red** because there is no async guard in src today — so the fix is
asserted directly instead. **A defensive fix still needs a test, precisely
because nothing exercises it yet.**

## 2026-09-15 — The same unbounded count, in my code and in my own documentation

The Competitor Tracker found four unbounded counts on its screens: "You have
none anywhere public" on a page that says in its own words that Google is not
checked. A barber with forty Google reviews would have been told he had none.

**The same defect was in code I had written that morning.** `bestBy` named a top
post out of the posts we could read, and the sentence said "the most this
month". With four posted and two readable, that asserts past what was read.

**And `tracking.md` gave that exact sentence as the ALLOWED example**, in the
table whose whole purpose is to separate a reading from a claim. The
documentation was teaching the defect while the code committed it.

`bestBy` now builds the sentence with its denominator, so nothing downstream has
to remember, and `findUnboundedSuperlatives` catches anything that does not come
from there. **Sentence-scoped**, because these lines are read alone, one in a
tile and one in a row: a denominator in the next sentence does not rescue this
one. The Tracker reached the same conclusion independently and fixed its test
rather than loosening its guard.

**A superlative is a claim about a set, and the set is never every post.** It is
the posts we could read, and the sentence has to say which.

## 2026-09-15 — Point the guards at the real screen, not at sentences you chose

The Competitor Tracker ran its guards over its own rendered screens and found
three defects in an afternoon, two of them **guards crying wolf**. Its GDPR
guard had twelve false positives on a clean screen, because an `/i` flag added
to fix one miss had switched off its own capitalisation test.

**Mine found three on the first run, and all three were the guard, not the
screen.**

1. `"since"` fired on *"anything you have told us since"*. It is causal in
   "since it had a photo" and temporal here, and the screen uses the second.
   Dropped: the causal senses that matter are all still listed.
2. `"overdue"` fired on **"Nothing here is overdue"**, the sentence that exists
   to prevent the problem. `findOverclaimedAccess` had had denial-scoping for a
   day and it was never carried across. **A fix to one guard is a question about
   every other guard of the same shape.**
3. `"late"` fired inside *"every later week"*. `includes` with no word boundary.

**Then fixing 2 broke a test that was right.** Sentence-scoped denial swallowed
*"You have not posted since June, time to catch up"*, where the negation is part
of the accusation rather than a denial of it. The clause now stops at the comma
and excludes the matched phrase, so a phrase cannot use its own "not" to excuse
itself. **The guard was wrong and the old test was right**, which is the way
round that is easy to get backwards when you are the one who wrote both.

**A guard with false positives on a clean screen is one nobody reads by the
third week, and then it protects nothing.** Same end state as a guard nothing
calls, reached from the opposite direction.

**And the extraction is checked before the guards are**, because a bad one
produces findings that are entirely artefacts of itself: tables dropped rather
than flattened, closing block tags turned into full stops, then an assertion
that there are sentences at all before anything reads them.

## 2026-09-15 — Prove a defensive fix by building the thing it defends against

My async fix came back 0 red under mutation, because there is no async guard in
`src` yet, so I asserted the regexes directly. The Competitor Tracker's answer is
better: **create the condition the fix defends against.** An orphaned
`export async function` added to `src/` is 0 red with the async-blind patterns
and 1 red with the fix. That proves the fix does something. Asserting a pattern
only proves it compiles.

**My first attempt at their method proved nothing, and it is worth knowing why.**
I left the direct assertion in place, so both arms came back 1 red for different
reasons: one from the orphan being missed, one from the assertion failing on its
own account. **A mutation with two possible causes measures neither.** Removing
the other cause first gave 0 red then 1 red, which is the clean result.

That is a fourth face of the same trap: not a mutation that does nothing, not one
that does the wrong thing, not a correct one with nothing to exercise it, but one
whose result is real and unattributable.

## 2026-09-15 — A word means something else in the trade, and a boundary will not save it

The Competitor Tracker asked its own guards the "same shape" question and found
five more: `obsessions` containing `sessions`, and then the ones a word boundary
cannot fix, because **in analytics a session is a visit and in a barber's price
list it is an appointment.** Same for impressions.

**Running plausible trade copy through every guard found four of mine**, none of
them on the screen, all of them waiting for the first real customer:

| Fired on | Why it was wrong |
|---|---|
| "Your **feedback** is what tells us what to do more of" | A barber asking his own customers. Our rule is about our furniture leaking into his document |
| "He is the **best in** the chair on a busy Saturday" | Colour, not a claim of an award |
| "We are open **late** on Thursday" | Opening hours. My word-boundary fix had already failed here and I had not noticed |
| "what to **do more** of" | A quantifier, not a comparison |

**`late` is the one worth keeping.** I had fixed it that morning by adding a word
boundary, which stopped `later` and did nothing for `open late`. The boundary
was the right fix for the wrong half of the problem. **What makes it nagging is
late AGAINST something**, so the phrases say so: `is late`, `was late`,
`running late`.

**And my first narrowing overshot.** Requiring a digit near a superlative
cleaned the screen and let "That was your best post" through, which is the
vaguest version of the thing the guard exists for. Metric *context* rather than a
digit. **Loosening a guard until the screen is clean is the failure that looks
exactly like fixing it**, so every narrowing now has a second test asserting the
real violations still fire.

**Two test corrections, opposite directions.** One asserted a count (`>= 2`)
rather than a behaviour and broke when the count changed for a good reason. One
used "You are late" as its example, which is not a sentence this product writes.
Both were the test, where the previous round's was the guard.

## 2026-09-15 — I wrote the warning, then found I had already done it

I told the Competitor Tracker that loosening a guard until the screen is clean is
the failure that looks exactly like fixing it. They audited their five narrowings
and found one had silently broken their GDPR guard. **I audited my four and found
six real violations I had narrowed away an hour earlier**, including:

- **"Your carousels get more saves"** — the single sentence `findUnearnedInference`
  exists to stop. Gone, because I removed `more` from a verb pattern to clear
  "what to do more of".
- "Leave feedback below", our own furniture, lost with bare `feedback`.
- "Your post is three days late", lost with bare `late`.
- "Best in Shropshire", lost with `best in`.

**The fix for every one of them is the same move:** narrow the *context*, never
the keyword. `get more` + a metric we read. `feedback` + a verb. `late` + a
duration. `best in` + a place. The keyword was never the false positive; the
keyword with no idea what surrounded it was.

**And the place pattern needed both cases spelled longhand, not `/i`.** With the
flag, the `[A-Z][a-z]+` that requires a place name matches any word and the
pattern silently stops testing the thing it was written for. That is the
Tracker's headline finding on its own guard, which they then made a second time
within the hour. Knowing about a trap does not stop you walking into it; a test
that fails does.

**Every narrowing now ships with a paired test**, in a block sitting directly
under the clean-screen assertions, because that is where the temptation is.

## 2026-09-15 — Where this actually got to, said plainly

Two sessions spent the back half of the day hardening guards against each
other's findings. **Every round found something real, which is exactly why
neither of us stopped**, and the last few converged on guards checking guards.
The Competitor Tracker called it first.

**What is real in this tool:** the spec, `src/` (shape, guards, voice,
recommendation, tracking, learning, oEmbed), 321 tests, and one screen.

**What is not:** there is no writing engine, so the planner cannot write a post.
There is no app, so nothing on the screen does anything. Nineteen controls are
inert. **321 green tests do not change either sentence** and should never be
quoted as if they did.

**The largest finding of the day was the Tracker's last one**, and it applies
here: their screen reimplements a library rule in inline JavaScript and the two
copies contradicted each other within hours. **My screen is markup generated
from the fixture once**, so every number on it is a copy of the library's output
rather than the library's output. It has not drifted because nothing under it
has changed. It will. That is the unwired guard again, at the level the customer
stands on, and it is the thing to fix before the screen grows.

**Five ways a mutation run lied to us today**, and they are different failures:
it did nothing; it did the wrong thing; it was correct with nothing to exercise
it; it was real but unattributable; and it was real while the assertion looked
for the wrong string. **Read what the mutation actually did before believing the
number** is the only rule that held in all five.

## 2026-09-15 — Test the fragments, not just the keys

The Competitor Tracker anonymised the mockup for a possible public build and
asserted zero real identities surviving. It was not true: **"Fish Street" got
through**, because the check tested the swap keys ("Fish Street Barbers") and not
their fragments. The sweep was right and the assertion that confirmed it was
wrong, which is the same shape as my apostrophe bug in the script scan.

**If we ever anonymise anything here, test for the fragments as well as the
names**: a street, a town, a booking platform, a first name inside a full one.

**And the substantive point, which was theirs and is better than mine.** I
objected to publishing competitor data. They pointed out the competitor data is
public and factual and largely defensible, and the real problem is that a named
business is depicted as a **customer of a product that does not exist**. That is
not publishing public data, it is implying a commercial relationship. Aim at that
if it comes up again.

**Deployment is on hold**, so none of it needs deciding today.

## 2026-09-15 — "What does Approve this week actually do?"

Nothing. No handler, and by design it only set the flag the per-post Done toggle
already sets. **The most consequential-sounding word on the screen, on the least
consequential action**, kept because the first spec said a plan is never final
without approval and I never asked what approval was for once posts became
individually markable.

Replaced with **Send me this week**, which is what an owner needs on a Monday:
the words where they will be when they post. It reads the posts out of the page
rather than holding a second copy, offers the file, and falls back to the
clipboard so a failed save never loses them. Approval stays per post, where the
judgement actually happens.

**The email path is proved, separately.** Agent mail sent the real week to Raj on
15 September: both posts, both photograph lines, both blanks. That is the version
that ships once there is a server; the file is what works without one.

**And three variants of one mistake in a single test.** Asserting the button is
wired failed three times: an over-escaped regex that reported "no handler" on a
button that had one, then `indexOf` finding the FIRST mention of `rz-go` (its
`disabled` line in refresh) rather than the one with the handler. **A
first-occurrence search lied three times today** — here, in a mutation that hit
the Tracker's screen instead of mine, and in a slice that started inside a
comment. When a search can match more than once, take them all.

## Failures worth remembering

**2026-09-14 — Three defects in guards written minutes earlier.** All found by
the tests, none by reading the code.

1. `%\b` never matches "30%", because neither side of that boundary is a word
   character. The percentage rule read correctly and caught nothing.
2. The count pattern required two digits, so "0 jobs" got through. Nought is the
   number a tool is most likely to invent.
3. `weekly` produced five posting days against a mix that adds up to four.

Then seven deliberate breakages, all caught. `tests/README.md` has the table.

**2026-09-14 — Scoping a claim to a first-person sentence is not enough.**
"Fifteen years, 3,000 customers and a five-star rating" says "we" nowhere and is
entirely a CV. But dropping the scoping altogether would flag "leaving it eight
weeks between cuts", which is about hair. The fix was a third test: a sentence
already listing counts, credentials or awards is a CV. Same family as the
Tracker's "cut is a noun in a barber's shop".

## 2026-09-14 — An independent pass, and what it found

`break-it`, run by a fresh tester that had not seen `src/`. 105 cases written
blind against `CLAUDE.md`, 20 red. The full list is in `tests/README.md`. What
is worth carrying to the other five tools:

**The spec's own worked example was not caught.** §4 names one sentence as the
thing that must never be written, and it passed clean, because the suffix list
held `Ltd` and not `Corp`. Worse, `guards.test.ts` quoted the real example in a
comment and asserted a different one. That assertion has an assertion, mocks
nothing, is not a duplicate and varies its fixture. It was simply wrong, shaped
to what the code did rather than to what the spec said. **Test the example the
spec names, verbatim, before anything else.**

**A guard that recomputes its own intention is not a guard.** `rewriteCallCount`
returned `critiques.length === 0 ? 0 : 1` and never observed a call, so the one
cost control in the tool reported itself green whatever the runtime did. Now
`checkRewriteCalls`, which takes the calls the run actually made. Any check
whose inputs come only from the same place as its expectation is decoration.

**The same word-boundary defect, in two places.** `%\b` and `\bpurpose:\b` both
match nothing, because a word boundary only exists next to a word character.
Found once by the build's own tests and once by the independent pass. Grep for
`\b` next to punctuation in every tool.

**`hard-rules.test.ts` §6.3 could not fail.** It asserted the clean plan carries
no local words, which is true whether or not the rule works. Gutting the
function left the file green. A "never does X" rule has to be tested by making X
happen, never by confirming it is absent from a fixture that never had it.

**A word list only knows the spellings somebody thought of.** `Gas-Safe`,
`twenty years`, `200 pounds`, `500+`, `near you`, a zero-width space closing
"Gas Safe" into "GasSafe". Text is now normalised by `flatten` before any list
touches it. The residual gap is language: the detector reads English, and `A30`
and `A31` are marked `todo` against it.

## Learnings

Nothing yet from a real run. Nothing has been put in front of a business.
