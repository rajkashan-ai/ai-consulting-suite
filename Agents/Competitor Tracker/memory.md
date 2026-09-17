# Competitor Tracker: what we learned

> Defined 2026-09-14. Not built. Nothing learned yet, because nothing has run.
>
> **What goes in here:** real outputs that were wrong and why, prompt changes and what they fixed,
> what a real business said about it, and anything that turned out to be untrue in `CLAUDE.md`.
> **What does not:** rules. A rule in force lives in this folder's `CLAUDE.md`, with its reason and
> no date. The dated record of deciding it lives here, or in the root `memory.md` if it affects
> more than this tool.

## Learnings

Nothing yet.

## Failures worth remembering

Nothing yet. When one happens, write the input that caused it, so it can become a test.

## 2026-09-14 — The three actions, and where the competitor control sits

Raj, on the barber test run:

- Three actions will not cover the four research areas, and that is accepted. What matters is that
  they are **the top three evidence-backed hypotheses**, ranked, not one per area.
- Each action now carries an **area label** (Marketing & channels, Reviews & reputation, Pricing &
  packaging) so the coverage is visible instead of implied.
- The **add-a-competitor control moved above the actions**, directly under the comparison table.
- **If the competitor list changes, the three actions are worked out again** from the new numbers.
  Stale actions sitting above a fresh table is the failure mode this prevents.

Action 3 was two ideas in one ("you publish a menu" and "you take card") and is now one: put the
price list where people look first. The card-payment fact stayed, as evidence.

**Instagram was considered for the third slot and rejected.** The Fade Inn's 9,065 followers against
HINCES's 2,537 is the biggest number in the set, but we never counted the barber's own following, so
we cannot say they are behind. A hypothesis built on a hole in our own data is not evidence-backed.
Counting the customer's own social following is now a gap worth closing in the research step.

## 2026-09-15 — Before this screen goes on any public URL

Netlify was prepared and then put on hold by Raj, who is building auth
separately. The question it raised is worth keeping, because it returns the
moment anything is demoed.

**The competitor data is not the problem.** Five named businesses with their
review counts, ratings and prices, read from Booksy and their own sites, is
public and factual, and comparing them is what the product does.

**The problem is the customer.** The Barber Shop Shrewsbury is shown as a user
of a product that does not exist. That is not republishing a public fact, it is
implying a commercial relationship with a real trading business that has never
been asked. It is the one thing on the screen that does not survive contact,
and it would still be wrong with every competitor removed.

**robots.txt and noindex stop indexing, not access.** Unlisted is not private
and links get forwarded.

**The fix is cheap and costs a demo nothing:** invented names in the deployed
build only, real data kept local. 78 replacements across 14 identities covers
it, town and booking platform included. The banner has to change too — "Real
public data for <name>" becomes a false statement the moment the names are
invented, so the demo build says every business on it is invented.

**And the verification of that sweep was wrong the first time.** It reported
"zero real identities surviving" and "Fish Street" had walked straight through:
the swap replaced the full name "Fish Street Barbers", and the check tested the
swap keys rather than their fragments. A street name, a town, a founder's first
name and a domain stem are all fragments of a longer identity. **Assert on the
fragments, not only on the names**, or the check passes while the leak stands —
which is the same defect as a guard narrowed until the screen goes clean.

## 2026-09-15 — What exists, plainly, after a day of green tests

**There is no app.** `src/` is twelve modules and 338 passing tests. It is a
library. `UI/workspace.html` is a mockup. **Nothing imports anything**: the
screen and the logic have never been connected to each other, and `grep -c
"import.*src/" UI/workspace.html` returns 0.

**So there is no "what changed since Monday", which is the whole thing the
Tracker is sold on.** It needs somewhere to keep last week's reading, and there
is no database. `freshness.ts` decides *whether* a run is due and nothing runs.
Every number on the screen was read by hand on 14 September and typed in.
"I have done this" persists nothing.

**The screen reimplements the library rather than calling it, and it drifted the
same day.** The Swap-in validation was written as inline JavaScript mirroring
`src/candidate.ts`. Within hours it said "We looked at Booksy, Fresha, Google
and their own site" while the panel below it said "Not yet — Google reviews".
Two implementations of one rule, contradicting each other on a customer screen.
That is the unwired-guard defect at the level the customer stands on, and it is
the largest thing found today. It also implements three of the library's four
states.

**51 user-facing strings live in the page script and no guard had read them
until today.** Every screen test stripped `<script>`. Most of those strings are
the first-use states for the five unbuilt tools, so whoever builds those
inherits the gap. `tests/screen.test.ts` now scans script copy as well as
markup.

**What today did produce.** A six-person user panel moved the Competitor Tracker
from 5.3 to 8.3 over three rounds and found that the screen proved its case and
gave the reader nothing to press. Mobile was broken and is fixed. The guards
found real defects in each other. None of that is an app.

**Blocked on Raj, both cheap:** the Facebook identity confirmation, which
unblocks advertising data that is already built and tested; and permission to
publish the artifact, so none of today's work is live.

**The sentence worth keeping.** 338 green tests do not mean there is a product.
Two sessions spent a good part of a day hardening guards against each other,
every round found something real, and that is exactly why neither of us stopped
it sooner. The work was worth doing once. It was not worth doing eight times.

## 2026-09-15 — A guard that was written, tested, documented, and never ran

Audit of every export in `src/` against its references in `tests/`. Five exports
had no test reference. Three were constants exercised through their own
functions, which is fine. Two were not.

**`findRankClaims` was wired into nothing.** It existed, it had five test
references, and `src/search-visibility.ts` names it in a comment as "the guard"
against claiming a Google position we never measured. It was absent from
`validateBattlecard`, so it never ran on a battlecard. The tests called it
directly and passed.

**`validateBattlecard` is the gate everything leaves through, and it had no
test.** It appeared exactly once in the whole repo: its own definition. Never
called in `src/`, never referenced in a doc. So nothing compared the list of
guards that exist against the list that run.

**The lesson, and it generalises past this repo.** A unit test proves a guard
works. It cannot prove the guard is plugged in. Those are different claims and
we only had the first. `tests/battlecard.test.ts` now reads `src/guards.ts`,
extracts every exported guard, and asserts each one appears inside
`validateBattlecard` — so it catches the *next* unwired guard, not just this
one. Un-wiring `findRankClaims` again turns 4 tests red; before today it passed
all 262.

**`checkName` was untested too.** It is the first thing a typed name meets and
the candidate-validation screen is about to be built on it. Five cases added,
including one asserting `checkName` and `addCompetitor` agree on the 120
character boundary, because two places deciding the same thing drifted once
before on case sensitivity.

**All eleven checkable units are now proven to fail**, not seven: the nine
`find*` guards, `validateActions` and `areasCovered`, each neutered in turn,
1 to 12 tests red each. The "seven guards" line in `CLAUDE.md` had been true
when written and silently stopped being true as guards were added.

**Four files carried the suite size and no two agreed** — 145, 124, 251 and
"145 cases" again — against a real 279. A number in prose that nothing
regenerates is a liability, so `CLAUDE.md` no longer carries one and the root
`memory.md` figure is dated.

279 cases, 278 pass, 1 todo (the homoglyph confusables gap, still open).

## 2026-09-14 — The test suite, and two bugs it found before a customer did

124 cases in `tests/`, plus 25 eval cases in `evals/cases.ts`. Node runs the
TypeScript directly, so there is no install and no network: `npm test`.

**Two real defects surfaced while writing the tests, both in guards I had just
written and believed were right.**

1. `findNamedReviewers` missed "Reviewer Sarah left three stars" because the
   pattern was case-sensitive. It would have let a real person's name into an
   exported document the customer forwards. UK GDPR.
2. `validateActions` missed "Raise your classic cut to £20" as a price
   recommendation, because it only looked for the word "price". A price move is
   often written as a verb plus a currency amount and no price word at all.

**A domain trap worth keeping.** The price-move detector cannot treat "cut" or
"drop" as verbs. In a barber's battlecard "cut" is a haircut, and "classic cut
£15" would fire on every row. Words that are verbs everywhere else are nouns in
a trade.

**Known gap, written down rather than left to be discovered.** A competitor name
using Cyrillic letters that look like Latin ones gets past the duplicate check,
so the same business can be listed twice. Marked `todo` in
`tests/competitor-set.test.ts`. Needs a Unicode confusables map before launch.

**What the fixtures are built on.** Six shapes of business, from everything
public (HINCES) to nothing public at all. The real ones are the Shrewsbury run
of 14 September; the rest are synthetic and use `example.com`, so no invented
fact is ever attached to a real trading name.

**Proven to fail.** Seven guards broken on purpose, all caught, 2 to 4 tests red
each. Re-run that after any change to `src/guards.ts`.

## 2026-09-14 — Search visibility, built, and what it found in its first hour

`src/search-visibility.ts` plus 35 tests. Terms are worked out from the profile,
counts are reported, and a position is never claimed.

**The thing that would have made every answer wrong.** A server-side search has
no location. Run bare, "barber Shrewsbury" came back with Shrewsbury
Pennsylvania and Shrewsbury Massachusetts ahead of the real one. The web search
tool takes `user_location`, and `searchToolConfig` cannot be called without it.
A missing location does not fail loudly: it quietly answers about the wrong
country, which is the worst kind of bug this product could have.

**The finding that matters most, and it is about the tool itself.** Three real
searches on 14 September:

| Search | The customer | Their five |
|---|---|---|
| barber Shrewsbury | comes up twice | NO.1 Barbers only |
| best barber Shrewsbury | nothing | none of them |
| beard trim Shrewsbury | comes up three times | none of them |

**Four of the five competitors came up in none of the searches**, and four
businesses that did come up were on nobody's list: Mobile Barber Shropshire,
Headcase Barbers, Legion Barbers, Bridgette The Mobile Barber. None is on Booksy.

We pick competitors by Booksy review count. **That finds the businesses that are
good at Booksy, which is not the same as the businesses taking the work.** The
same blind spot the customer has. `candidatesFromSearch` now feeds the search
back into the list, offered under the table, never added silently.

**"Best barber Shrewsbury" returns nothing but directories.** Fresha,
StarOfService, Yelp, Booksy, and not one barber's own site. So being listed on
them is the way in, not out-ranking them, and that is independent evidence for
the Booksy action rather than a second opinion about it.

**Three bugs the tests and the real data caught, all in code written that hour:**

1. Matching a business name word by word looked fine and was badly wrong.
   "NO.1 Barbers" reduces to the single distinctive word "barbers", so every
   page mentioning barbers was attributed to them. Whole-phrase matching fixed it.
2. "SHREWSBURY - Headcase Barbers | United Kingdom" produced a candidate called
   **Shrewsbury**, which is a town. A hyphenated hostname is a better source for
   a trading name than the page title, and it fixed a second case where the
   title led with the service instead of the business.
3. `yelp.` with a trailing dot reached the screen as a directory name.

**Cost.** Five searches a week at $10 per 1,000 is about 17p per customer per
month, plus tokens for reading the results.

## 2026-09-14 — Two lists, and a number that was on the wrong business

**"What we looked at" replaced two things**: a prose sources paragraph and a
separate "not checked" note about advertising. Two lists say more in less space,
and the right-hand one is our own to-do list as much as it is transparency for
the owner.

Every uncheck carries which kind it is, and there are only two:

- **We cannot** — advertising, whether they are still posting, spend, email, and
  anything offline.
- **Not for you** — LinkedIn and X, the trade directories, Companies House. Said
  against this business, not in general: LinkedIn is not irrelevant, it is
  irrelevant to a barber.

**A number on the wrong business, found by checking LinkedIn.** The Fade Inn's
9,065 Instagram followers had been on this page since the first run. Searching
turned up **two** accounts using that name, and only `@thefadeinnbarbershop` is
in Shrewsbury. The 9,065 belongs to `@thefadeinn`, which may be a different shop
entirely. It is now marked Not confirmed with the reason, and the "where they are
winning" line that leaned on it is gone. The name-collision eval case was already
written; it had just never been run against our own data.

**Instagram follower counts are reachable after all, but not the way I assumed.**
Fetching a profile is disallowed. A search listing that indexed the profile
carries the count, and reading a search result is not reading Instagram. So the
column stays, and the source is the listing, not the platform.

**LinkedIn, checked properly.** Not a B2B question: `robots.txt` names about
twenty search crawlers and then shuts everyone else out with `Disallow: /`, and
the ad library returns 403. One door, `whitelist-crawl@linkedin.com`.

## 2026-09-14 — An uncheck must name the question, not the method

The screen said we could not tell whether a competitor was still active, because
Instagram and Facebook do not let us read post dates. Raj challenged it. The
block was real and the conclusion was wrong.

**Booksy venue pages carry `schema.org` Review markup with `datePublished`.**
They are allowed by robots.txt and we already read them for prices. Three
competitors, read 14 September: HINCES last reviewed 4 days ago, The Fade Inn 3,
NO.1 Barbers 7. None of them is drifting, and a dated review is a better answer
than a dated post because it means somebody paid and walked in.

**The rule this leaves behind.** "We cannot read post dates" is a fact about a
method. "We cannot tell whether they are still active" was a claim about the
question, and it was false. Write every uncheck as the question, then go looking
for any route to it. A blocked method is not a blocked question.

**Two things nearly went wrong on the way, both caught by looking.**

1. A competitor's website carried `2026-09-09`, which read like recent activity
   and was a LiteSpeed cache timestamp. Schema markup is now preferred over any
   date found loose in a page, with a test naming that case.
2. A Booksy page carries only **two** dated reviews in its markup. The first
   version said "2 of the 2 reviews on their page are from the last 30 days",
   which is arithmetic on a sample of two, presented as a rate. `describeActivity`
   now drops the window count below five reviews, and `verdict` returns
   "trading" rather than "busy" or "ticking over", because a rate needs a sample.

**Sitemap `lastmod` is a second, weaker signal**: shrewsburybarber.co.uk last
touched 2024-07-01, headcase-barbers.com 2024-02-12. A site untouched for two
years is a business that has stopped thinking about its website.

**And the follower figure is now settled.** `@thefadeinn`, the account carrying
9,065 followers, is at 5633 Hollywood Blvd, Los Angeles. The Shrewsbury shop is
`@thefadeinnbarbershop`. That number was on the wrong business for two days.

## 2026-09-14 — One stylesheet, both pages

`UI/app.css` is now the stylesheet and the record. `python3 UI/sync-styles.py`
inlines it into both pages between markers; `--check` fails if either is stale.
Ten tests in `tests/styles.test.ts` prove it, so drift cannot recur silently.

**What the drift actually was.** 19 font sizes across the two files, 21 tracking
values including `-.010em` and `-.01em` written as two rules for the same number,
15 line-heights in one file and 17 in the other, and 31 inline `style=`
attributes in the workspace that were the mechanism by which the system was lost.
Neither file was wrong alone. Nothing had ever compared them.

| | Before | After |
|---|---|---|
| Font sizes | 19 | **8** |
| Weights | 3, incl. 700 | **3**, none above 600 |
| Tracking values | 21 | **5**, keyed to size alone |
| Berry elements on one screen | 16 | **3** |
| Inline styles in the workspace | 31 | **0** |
| Grounds | 3 | **2**, alternating, no rule between |
| `h3` rules | 9, settled by source order | **0**; four `.t-*` classes |

**Two exceptions, both deliberate and both fenced.** Marketing headings are their
own fluid ladder, because a hero is not an app heading. The product-shot
miniature is 8 to 11px, because it is a picture of a screen drawn small.

**Where 14px went.** Linear's button padding is `0 14px` and ours is now 16px.
Our own rule says a strict 4px step with nothing between values, and one rule
with no exceptions is worth more than a matched pixel on a value that is not
load-bearing.

**Still open, flagged by the design pass and not fixed:** the Competitor Tracker
has no primary action. Its one filled button is "Send it" inside a feedback
panel, so the most dominant thing on the page asks the reader to report a fault.
The three ranked actions are the point of the view and none is actionable. The
button slot is specified; what it does is a product decision.

## 2026-09-14 — What a world-class competitor analysis has that we did not

Researched against Porter's four corners, published battlecard practice and the
documented failure modes of competitor analysis, rather than decided from taste.
Five gaps, all five now built: `src/reviews.ts`, `src/positioning.ts`, and the
shape functions in `src/competitor-set.ts`. 251 tests.

**The one that mattered: we had 4,799 reviews and read the number.** Reviews are
the only place a business with no sales team can see why anybody chose, which is
the whole of win/loss analysis. Every action we produced came from a published
fact instead.

**What the first real read found, nine reviews across three barbers:**

- **Four of the nine name an individual barber.** Saskia, Josh, Jordan, Younis.
  The competitor's advantage is a person, not a shop. A person can be hired, can
  leave, and cannot be beaten with a price. **No review count shows this.**
- **Five of the nine are returning customers.** High retention.
- **Nobody says they switched.** Those customers are not in play, which changes
  who the winnable ones are.

That reframes the whole card. They are not winning on price or on being findable.
They are winning on individual barbers and on people coming back.

**Two live problems the real data exposed.** Review text arrives double-encoded,
so "I've" reached us as mojibake and would have been published as somebody's
exact words. And naming a staff member is a UK GDPR problem the old rule did not
cover: it said "never named individuals" about reviewers, and said nothing about
the barber they praise. A theme may now say that customers name their barber and
how often, never which names.

**The substitute mistake, which we had already made.** The most frequent failure
in competitor analysis is looking only at the same shape of business. Our own
search found Mobile Barber Shropshire and Bridgette The Mobile Barber and the
tool filed them as ordinary competitors. A barber who comes to your house is a
different answer to the same question. Every competitor now carries a shape, and
the trade names the competitor nobody lists: clippers at home.

**Three rules for the judgement parts**, because a prediction reads like a fact
unless something forces it not to. A prediction carries four sourced corners, a
date it can be judged on, and a sentence saying what would prove it wrong, and it
is never worded as a fact. Positioning must name the losing case, because a card
claiming you win on everything gets ignored. An unchecked self-claim is labelled
unchecked and can never be evidence for an action.

**On the audit framework Raj brought.** It graded prompt quality well and caught
two real weaknesses, control flow and modularity. It has no pillar for "did you
find out why customers switch", which was our biggest gap. It audits instruction
quality, not analytical completeness. Worth running both.

## 2026-09-14 — The findings reached the screen, and one regression

**Style regression, and it was mine.** The stylesheet rewrite converted every
class in the markup but never added `cell-list` to the lists inside table cells.
Nothing matched `.cell-list li`, so the rows lost their padding and their
relative positioning, and `svg{display:block}` from the reset dropped every tick
and cross onto its own line above the text. 18 lists affected.

**The lesson: a conversion that renames classes has to be checked against the
stylesheet, not just against itself.** Every class in the markup existed, every
class in the CSS existed, and the two sets did not meet. The check that would
have caught it is "which rules match nothing on this page", which is the reverse
of the one I ran.

**A self-inflicted false alarm worth remembering.** A tag-balance check said one
`<tr>` was unclosed. It was not: my own CSS comment contained the words table,
thead, tbody and row written in angle brackets, and every tag count run over the
built page picked them up. Comments in shared CSS now spell tag names out.

**What went on screen.** A "what the reviews actually say" table above the
counts: customers naming their barber 4 of 9, returning customers 5 of 9, nobody
switching 0 of 9, attention to detail 2 of 9. Every quote redacted to
"[a barber]" before it could be published. The substitutes are tagged "Comes to
you" and "A chain" with the reason, and the competitor nobody lists, clippers at
home, is named and labelled as our read.

**Action 2 changed because of the reviews.** It was "ask every customer for a
review". It is now "ask every customer to review you **by name**", because four
of the nine reviews name the barber rather than the shop, and that is what makes
somebody book the same person again. That is the first action in this tool that
came from what a customer said rather than from a published fact.

## 2026-09-15 — Validating a competitor the customer names

`src/candidate.ts` plus 10 tests. The list is capped at five and a customer's
picks are permanent, so **a name we can find nothing about does not make an
empty row: it evicts a competitor we could read and replaces it with blanks,
every week, for ever.** That is the most expensive empty cell in the tool, so
the check happens on the way in, while the person who typed it is still there.

Four outcomes, and they are deliberately four rather than two:

| | What the screen does |
|---|---|
| One clear match | Shows it **with its address** and asks if it is the right business |
| More than one | Lists them. **Never guesses.** Keeping is disabled until they pick |
| Nothing found | Says where we looked, and that the row stays empty. They may still keep it |
| Could not check | Says why. **Not the same as finding nothing** |

**"Confirm with an address" exists because of a mistake we made.** "The Fade Inn"
matched an account with 9,065 followers that turned out to be a barber on
Hollywood Boulevard, and the tool carried that number on the wrong business for
two days. A customer adding a name would inherit exactly that failure.

**The cost is stated before it is paid.** At five, the screen says this replaces
one of them and empty is what you will see in its place.

**Not yet built:** the UI states. The words and the decisions are in `say()` so
they are testable and consistent wherever a competitor is added, but the screen
still just accepts a name.

## From the first end-to-end runs through the app, 15 September 2026

**`findUnboundedCounts` refused "Your website shows none."** The sentence does
name its boundary, "your website", and `BOUNDED` does not recognise that
phrasing. This is the same class the guard's own comment describes: the list did
not know the wording. Worked around from the app side by teaching the writing
prompt the accepted forms, rather than editing this folder. Worth adding
`shows none|shows no|has none|found none on` to `BOUNDED` when convenient.

**The listing page is the whole game for a local trade.** Three searches for
"barber Shrewsbury" returned twenty-seven results: Shrewsbury Pennsylvania,
Shrewsbury Massachusetts, Shrewsbury New Jersey, two Wikipedia articles, and the
customer. The only useful UK entries were the Booksy and Fresha listing pages.
Discovery from search results alone finds nobody.

**`candidatesFromSearch` let a dead baronet through.** "barber Shrewsbury"
offered the Wikipedia page for Sir Henry Barber, 1st Baronet. The relevance test
asks whether the trade word appears anywhere, and "Barber" was his surname.

**`sameBusiness` cannot see "HINCES" and "HINCES Barber" as one shop**, because
it compares normalised names for equality. Right for what it was written for,
and it meant one shop took two of the five slots.

**`PRICE_MOVE` cannot see a negation, 15 September.** A pricing action was
refused for the sentence "You do not have to match anyone, you just have to be
readable. Publishing a cut price..." The pattern found the verb "match" within
sixty characters of the word "price" and fired. The sentence says the opposite
of a price recommendation.

The guard's design is right and the limitation is real: a regular expression
cannot tell a recommendation from its negation, and should not try. Handled from
the app side by keeping those verbs out of a pricing action altogether, which is
a better rule anyway. Worth considering a negation lookbehind
(`(?<!\b(?:not|never|no need to|do not have to)\s{0,20})`) if it ever fires on
something that cannot be reworded.
