# Competitor Tracker

> **Status:** defined 2026-09-14, not built. First draft came from Gemini, reviewed and amended
> with Raj the same day. Decisions below are settled unless this file says otherwise.
>
> **One internal name (settled 2026-09-14).** Folder, file title and app header are all
> "Competitor Tracker". The landing page sells the same tool by its job, and that wording is set by
> testing, so it will differ.
>
> Every tool prepends `Agents/_shared/base-prompt.md`. This file adds what is specific to this one.

---

## Header, as it appears in the app

**Competitor Tracker**

> Check what your competitors charge and promise so you know where you stand before you quote&mdash;and get an automatic scan every Monday so you hear about a market change the week it happens.

_Set by Raj 2026-09-14. Customer-facing. The landing page names the same tool by its job,
which is deliberate: the page sells by problem, the app labels by tool._

---

## 1. Who it is for and what it answers

A business of one to twenty people that does not know where it stands. The owner's question is
"am I losing work to someone, and why?" They have never looked at a competitor's pricing page on
purpose, and they have no idea what is being said about those competitors in public.

## 2. What it takes in

Almost nothing, deliberately.

| Input | Where it comes from |
|---|---|
| The business | Their website, or their name and town. Nothing else is required |
| What they do, who they sell to, where they work | Inferred from the site or their Google Business Profile |
| Who their competitors are | **We work it out.** Never a form |
| What their customers search for | Worked out from their trade, town and services. Shown, and correctable |

**How competitors are chosen.** Work it out from the business, then let them correct it.

- A business that serves an area (a plumber, a clinic, a salon) gets competitors within a sensible
  radius of where they work.
- A business that sells beyond its doorstep (a studio, a consultancy, an online shop) gets the
  businesses ranking and advertising for the same work, wherever they are.
- We pick **five**, name them, and say how we picked them. The customer can swap any of them, and
  their choices are permanent. See 2a.
- Never ask them to type competitor names: the whole onboarding promise is no forms. But the
  weekly search finds businesses the review-count pick missed, and those are offered under the
  table. See `channel-coverage.md`.

## 2a. How often it runs, and what is remembered (decided 2026-09-14)

**Fresh research happens once a week. Never more.**

- The result is stored for **7 days**. Opening the tool inside that week shows the stored answer.
  We do not re-search because someone came back, and there is no refresh button.
- The screen always says **when it last ran and when it runs next**, at the top, before anything else.
  A dated answer with no date on it is just an assertion.
- A new run only happens after 7 days.

Three reasons this is a rule and not a setting. It is the cost control, because a fetch-heavy run
on every visit is the one thing that could make a flat price unprofitable. It is the honesty
control, because a customer should not get different answers on Tuesday and Thursday from the same
question. And it is what makes "what changed since last week" mean anything.

**Five competitors, and the ones they chose are permanent.**

- We propose **five**, and we say how we picked them.
- **Any competitor the customer adds is remembered forever** and survives every weekly run. We never
  quietly drop someone they told us mattered.
- If they add a sixth, we ask **which of the five it replaces.** We never silently evict one, and we
  never grow the list past five, because six is a cost we did not price.

**Changing the list re-runs the analysis (decided 2026-09-14).** The comparison table and the three
actions are both read off the same five competitors. If the five change, the table is rebuilt and
**the three actions are worked out again from the new numbers.** Leaving yesterday's actions above
today's table is how a tool starts lying quietly. The screen says so, on the control itself.

**Where the control sits.** Directly under the comparison table, not at the foot of the page. An
owner decides the list is wrong at the moment they have finished reading it, and the actions below
depend on it, so the control belongs between the two.

## 3. What it produces

A battlecard, in this order.

```
## Since <date of the last run>
   What moved, with the source and date. Or "Nothing moved. We checked 5 competitors
   and 19 pages." Omitted entirely on a first run.

## Where the market stands
   Two sentences on the competitive picture in their niche.

## The five of them, side by side
   | Competitor | What they promise | What they charge | What people say |

## Three things to do about it
   1..3, each concrete, each tied to something in the table above.
```

**The "Since" section is at the top.** It is the reason someone opens this on a Monday, and it
travels with the document when they export it.

**The table columns**

| Column | Rule |
|---|---|
| Competitor | The trading name, as it appears on their own site |
| What they promise | Their own words, quoted, 25 words maximum. Never our paraphrase of their positioning |
| What they charge | The figure and the page it is on. "No prices published" is a complete and useful answer |
| What people say | **Quoted and dated, every time.** See §4 |

## 3a. The analysis itself

`analysis-method.md`. Two parts: how the three actions are chosen, and the five
things a snapshot cannot say, which were added on 2026-09-14 after researching
what good competitor analysis actually contains. Read it before changing what
the tool produces.

## 4. The rule that governs this tool

**Nothing goes in that we cannot point at.**

The original draft had a "Known Vulnerability / Gap" column carrying claims like "poor review
ratings for follow-through". That is an unsourced negative claim about a named trading business, in
a document the customer can export and forward to their own clients. It is out.

What replaces it, decided 2026-09-14: **quote it and date it, every time.**

- Good: `4 of 12 Google reviews since June mention waiting for a callback. google.com/... 14 Sep`
- Not allowed: `Poor follow-through`
- **An empty cell is a finding, not a failure.** "We found nothing public about how they deliver"
  is honest and is itself worth knowing.

**Reviews give themes, never named individuals.** UK GDPR: "it was public" is not a lawful basis.

**The three strategies are our read, not fact.** They are labelled as ours, and each one points at
the row in the table it came from. A strategy with no evidence behind it does not ship.

## 5. What it must never do

1. **Never claim to know a competitor's website traffic**, nor their spend, clicks or engagement.
   Nobody publishes those outside the political ad tiers, and panel data we did not buy is the only
   other route. A test asserts those words never appear about a named competitor.
2. **Never put a feedback prompt inside the battlecard.** It gets exported and forwarded. Feedback
   lives in the app around the document. A test renders the export and asserts "How did this output
   land", "Was this any use" and "feedback" appear nowhere in it.
3. **Never invent a price, a promise or a review.** If we did not read it, it does not exist.
4. **Never state a count without saying where it stops.** "You have none" is a claim about every
   platform there is, made by something that read two of them. On 15 September the screen carried
   four of these while the same screen said Google was not checked, so a barber with forty Google
   reviews would have been told he had none. The number never gets softened or dropped: the
   boundary gets named, in the same sentence, because a stat tile and a feed row are read alone.
   `findUnboundedCounts` is the test, and it is sentence-scoped for that reason.
4. **Never fetch what `robots.txt` disallows**, and never a login, a paywall or a captcha.
5. **Never assume the business is local.** Half of them are not.
6. **Never state a search position.** We can say who comes up and count it across several
   searches. "You are ninth on Google" is a number nobody gave us. `findRankClaims` tests it.
7. **Never run a search without a location.** A server-side search has no location and quietly
   answers about the wrong country: on 14 September "barber Shrewsbury" returned Pennsylvania and
   Massachusetts. `searchToolConfig` cannot be built without `user_location`.

## 6. Build notes

`build-notes.md`. Read once, while building. Companion files: `ad-library-access.md`
for the advertising source, `channel-coverage.md` for what we cover and what is
closed to us, `tests/README.md` for the suite.

## 7. How it is tested

`npm test` runs the suite. No install, no network, under a second, so there is no
reason to skip them. `tests/README.md` says what is where. Read the summary line,
`ℹ fail 0`, not the exit output: the suite prints a stack trace and an
`✘ failing tests:` header for the one `todo` case, which is expected. No case
count is written down here, because the one that was drifted to four different
numbers in four files before anyone noticed.

Every rule in section 5 is a test, because a rule in prose is a hope. What the
tool *writes* is graded by `evals/cases.ts` instead, since an equality check on a
prompt fails at random and then gets disabled. All twelve checkable units in
`src/guards.ts` — the ten `find*` guards, `validateActions` and `areasCovered` —
have been neutered on purpose and watched to fail, 1 to 12 tests red each
(15 September). Do that again after touching the file, and count the guards
first: this line said "seven" while the file held nine, and the two it did not
cover included one that was wired into nothing.

## 8. Open

1. **What "since last time" compares against** needs somewhere to store the last run. That is the
   first thing in this tool that needs a database.
2. **Advertising.** Built and tested, waiting on one identity confirmation and on whether GB returns
   commercial ads at all. Steps and the probe: `ad-library-access.md`.
3. **The rest of the marketing picture.** What we cover, what is closed to us and why, and the two
   free unbuilt gaps that are worth more than every ad library: `channel-coverage.md`.

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
