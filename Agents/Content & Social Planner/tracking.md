# Tracking a post, and learning from it

> Written 2026-09-15 on Raj's ask: count what has gone out per channel with the
> last date, show how a post did, let the owner paste the live link and press
> Posted, and feed that back into later posts so a solid learning never has to
> be given twice. The rule is `CLAUDE.md` §6a. This is the method and the
> reasoning.

---

## Two routes in, and they give different things

**The link they paste.** Since 15 June 2026 Meta's oEmbed works with no token
and no app review, so a pasted link gives us the caption **as they actually
published it**. It gives no engagement at all: oEmbed returns the embed and
nothing else. That is not a disappointment. What they published, against what we
wrote, is the strongest signal this tool has, and it needs no account, no
permission and no statistics.

**A connected account.** Reach, likes, comments and saves need a Business or
Creator account joined to a Facebook page, OAuth, `instagram_manage_insights`,
and a 60-day token that has to be refreshed. **A personal account cannot give
these at all.** That is Meta's rule, not ours, and the screen says so plainly
rather than showing an empty box.

So there are three states per channel and not two: connected, not connected yet,
and cannot be connected. Every one that shows no numbers carries its reason, in
the customer's terms, and "switching to a business account is free and takes a
minute" is more use to them than "not available".

## Proved, not taken from a write-up

On 15 September the endpoint was called with no access token and no `url`
parameter. It answered **"(#100) The parameter url is required"**, not "an
access token is required". So it accepts unauthenticated calls and the tokenless
claim holds. Calling it with a post id that does not exist answers code **24**,
which is also what a private or deleted post gives.

`src/oembed.ts` is built on those two observed codes and nothing else. **No live
call is made from the test suite**: a test that needs Instagram to be up fails on
a Tuesday for a reason nobody can fix, and then gets disabled.

## What is actually behind "Connect Instagram"

Raj, 15 September: what action is behind the button? It was on the screen with
nothing defined behind it, which is the clickable-row fault again.

**The flow, in order.**

1. **Check they can, before sending them anywhere.** A personal account cannot
   give insights at all. Sending someone through a sign-in that ends in nothing
   is worse than telling them first, so the eligibility check comes before the
   button does anything.
2. They sign in at Meta and approve a named list of permissions.
3. We get a short-lived user token, about an hour, and exchange it for a
   long-lived one of **60 days**.
4. We read their media and its insights. Nothing else.
5. **At 60 days it stops.** The token is refreshable after 24 hours and expires
   after 60 days of disuse, so a customer who does not open the tool for two
   months comes back to a lapsed connection. The `expired` state exists for this
   and says "reconnect and the numbers come back".

**What we ask for, and what each one is for.**

| Permission | What it buys us |
|---|---|
| `instagram_basic` | The account, and the list of posts on it |
| `instagram_manage_insights` | Reach, likes, comments and saves per post |
| `pages_show_list` | Finding the Facebook page the account is joined to |
| `pages_read_engagement` | The Facebook side of the same numbers |
| `pages_read_user_content` | Reading the posts themselves on the page |

**Not verified against Meta's own documentation.** That list came from secondary
sources on 15 September. Meta moves permissions between tiers, and asking for
one we do not need is both a review risk and a thing the customer has to read.
**Confirm against Meta's docs before any of this is built**, and drop anything
not on the list above that is genuinely used.

**What we never get, and the screen says so before they press it.** We cannot
post as them, read their messages, or see who follows them. Saying it up front
costs one sentence and is the difference between a permission screen that reads
as reasonable and one that reads as a land grab. `findOverclaimedAccess` refuses
any copy that implies otherwise.

## The count has to say what it is counting

Raj, 15 September, on the render: *"Are there no existing posts for this
client?"* The top section said **2 posted** for a barber who has run an Instagram
account for years. It was counting posts that went out through this tool and
labelling it as if it were their whole history.

**`throughUs` and `onTheAccount` are two different numbers** and the screen never
shows one as the other:

| State | What it says |
|---|---|
| Not connected, nothing yet | "Nothing through here yet. We cannot see what is already on your account." |
| Not connected, two through us | "2 through here. We cannot see the rest of your account yet." |
| Connected | "148 on the account, 2 of them through here." |

**The last date is the later of theirs and ours**, not whichever we happened to
read. A post of theirs from last week beats ours from a fortnight ago, and the
reverse, and getting that backwards makes the tool look like it is not watching.

**This is the second thing connecting an account unlocks**, and it is worth more
than the metrics: it is the only way to see what they already do. §2b says we
cannot count what they post now, which was true of every route we had. With a
connection it stops being true, and `their-history` exists as a reason source for
exactly that — **valid only once connected**, because there is no other way to
read it.

## We report what happened. We never say why

**This is the rule the whole feature turns on.** At nine posts a month,
engagement is decided by the time of day, the follower count and whether the
algorithm surfaced it. "Before-and-afters do better" off nine points with no
control is the invented benchmark again, wearing our own data as a disguise, and
the owner will act on it.

| Allowed | Refused |
|---|---|
| | *(the first row was the other way round until 15 September: this file taught the defect)* |
| "412 reached on 22 September, the most of the 2 we have numbers for, out of 4 posted" | "Your 22 September post reached 412, the most this month" |
| "4 posted on Instagram, the last on 22 September" | "Carousels tend to do better for you" |
| "Read from Instagram on 29 September" | "Stick to the shorter ones" |

`findUnearnedInference` refuses the second column, including the hedged forms.
**This is not a threshold to be raised once there is more data.** It is the
difference between a reading and an inference, and more data would not make us
the ones who ran the experiment.

**A number carries where it came from and when we read it**, the same as any
Competitor Tracker claim. And `undefined` (we never asked) is not `null` (we
asked and it was not there) and neither is `0`. Rendering a missing number as
nought is the defect an owner spots immediately.

## Where a learning actually comes from

Not from metrics. From four things, all of them behaviour, all free:

| Source | What it tells us |
|---|---|
| **The caption diff** | What they cut, added or rewrote on the way to posting |
| **Never posted** | A kind of post they skip every time. Louder than any number |
| **Edited** | A critique, or their own rewrite. Already feeds the voice note |
| **Completion** | How much of a month they finished. Already drives the cadence |

**Three is a habit, two is a coincidence, and one is a Tuesday.** A pattern needs
three, and three is enough because they did the same deliberate thing three
times. No metric is involved in that sentence and none is needed.

## Do not regress: the four failures, each one a test

A learning lives on the business profile beside the voice note, never inside a
plan, because a plan is thrown away every month and this must not be.

1. **A learning is made and never applied.** `findUnappliedLearnings` checks the
   built writing instruction carries every live rule, verbatim. The failure is
   silent otherwise: the plan still writes, it is just wrong in the way they
   already told us about.
2. **The same thing is learned twice**, which means 1 already happened.
   `findRepeatedLearnings`, normalised so punctuation cannot hide it.
3. **A learning disappears with nobody deciding it should.** `findRegressions`
   catches it vanishing, its rule being rewritten, its evidence being trimmed,
   and its being retired with no reason given. **Retiring is allowed. Forgetting
   is not**, and the record of a retired learning is kept for ever.
4. **We ask for something we were already told.** `alreadyKnown`, which is
   `base-prompt.md`'s "never ask twice for the same fact" made checkable.

**Every learning carries its evidence**, and a learning with nothing under it is
a preference we invented for them.

## Open

- **The OAuth flow itself.** None of this runs until there is a server. The data
  layer, the states and the guards are done; connecting an account is not.
- **Google Business Profile and LinkedIn** have their own APIs and their own
  eligibility rules. Neither is checked yet, and the channel list assumes
  nothing about them beyond the three states.
- **What a lapsed token does to a month of numbers.** A 60-day token over a
  30-day plan means a customer can lose the connection mid-month. The state
  exists; what the screen does about it is not designed.
