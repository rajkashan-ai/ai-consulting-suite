# memory.md: build memory

> **What this is.** Where the build got to: decisions and why, what exists, what is next, what is
> still open. Read it at the start of a session, update it at the end.
>
> **What this is not.** It is not the product's data store. Customer business profiles, uploaded
> files and generated documents live in the database, one row per account, separated by row level
> security. A single markdown file cannot hold fifty paying customers' data, and should never try.
>
> **Last updated:** 2026-09-17

---

## Where we are

Two tools have guard-rail logic and a test suite: the Competitor Tracker (338 cases as at
2026-09-15) and, from 2026-09-14, the Content & Social Planner (321). **Both are libraries,
not applications.** Neither screen imports its own logic: `UI/workspace.html` is a mockup
whose numbers were read by hand on 14 September and typed in, and where it needed the
library's behaviour it reimplemented it in inline script, which contradicted the real
module the same day. There is no database, so the Tracker cannot do "what changed since
Monday" and the Planner cannot write a post. A green suite says the library is sound; it
says nothing about whether a customer can use any of this.

Both libraries are pure logic: no network, no install, no `node_modules`. No server, no
login. The one mockup, `UI/workspace.html`, carries both tools' screens. Folders still
have the old spaced names and need renaming to lower case with hyphens before anything
lands in an import or a URL.

## Decisions

| Date | Decision | Why |
|---|---|---|
| 2026-09-14 | This is a real paid web product, not a workspace Raj runs | Raj's call. Customers log in and use it themselves |
| 2026-09-14 | Build it one piece at a time, root files first | Avoids six half-finished tools |
| 2026-09-14 | Stack: Next.js, TypeScript, Tailwind, Supabase, Anthropic API, Stripe, Vercel | Boring and standard. Two people can build and debug all of it |
| 2026-09-14 | Root CLAUDE.md carries both the build rules and the runtime prompt, kept clearly apart | One place to look while the shape is still moving |
| 2026-09-14 | Global state is a database, not a markdown file | The original spec had shared client data in one file. That breaks the moment there are two customers |
| 2026-09-14 | No feedback footer inside any deliverable | Documents get forwarded to the customer's own clients. Feedback belongs in the app around the document |
| 2026-09-14 | Hard rule against invented market facts | A battlecard with a made up competitor price gets taken into a sales call and loses it |
| 2026-09-14 | Competitor data comes from public pages, licensed search, and official free APIs. No grey scraping | Raj's call: whatever we can get, but legally. Rules and sources are in CLAUDE.md 1.5 |
| 2026-09-14 | One workspace, and it is the customer's own business. No client switcher | The brief says 1 to 20 staff working on themselves (widened from 2 to 15 on 2026-09-14). A workspace dropdown is agency shaped and would have set the whole structure wrong |
| 2026-09-14 | Retention comes from telling them what changed: rivals re-checked weekly, only differences surfaced | Six documents generated once is a product people churn off in month two. We already fetch this data, so the weekly diff is close to free to build and must be priced in |
| 2026-09-14 | Brand is navy `#1c2b40` and berry `#a61e4d` on warm off-white `#fafaf8`, from the HIL slide template. Tokens live in `UI/brand.css` | Extracted by counting actual colour usage across the deck's slides. The theme block in the pptx is untouched Office default and is not the brand |
| 2026-09-14 | The coral palette in `HIL Practice/HIL-Service-Model.html` is superseded. Do not reintroduce it | It disagrees with the deck, and white on that coral measured 4.28:1, failing WCAG AA. White on berry is 7.21:1 with no workaround needed |
| 2026-09-14 | UI delivered as a clickable mockup in real brand colours, plus the written spec | Clean cannot be judged from a document. Raj looks at screens, a developer builds from the spec |
| 2026-09-14 | Designed against one real business: a commercial plumber in West London selling to property managers and homeowners | Taken from Raj's own spec example. Designing for a named person beats designing for a persona, and it decides how much jargon the copy can carry |
| 2026-09-14 | Moved out of the consulting practice folder. Now `Desktop/CLAUDE/AI Consulting for Small Businesses`, beside it rather than inside | Instruction files load from every folder above, so the practice's rules and seven skills were loading on product work. A written "ignore that" note relies on obedience. Filing makes it impossible |
| 2026-09-14 | Flat monthly price with a fair-use cap. No credits, no per-run charges | An owner nervous about surprise bills is the buyer. Flat means no counters, meters or upgrade nags on screen, which is the clean product. The cap contains the cost risk on heavy users |
| 2026-09-14 | No free-text prompt box in any tool. Two or three named options instead | Most owners do not know what to type in a blank box, and it is an open door into our own prompt |
| 2026-09-14 | Brand tokens taken from High Intent Labs' own file, not invented. Source sits outside this folder at `Desktop/CLAUDE/AI Set-up in Business/HIL Practice/HIL-Service-Model.html` | A full light and dark set already exists: navy `#16233f`, coral `#d0521f` as the single accent, teal `#0f6e56`, 14px radius, system fonts |
| 2026-09-14 | Two test systems, not one: tests for code, evals for what the tools write. Method in `TESTING.md` | Prompts are non-deterministic. An equality check on AI output fails at random, gets disabled, and then nothing is tested |
| 2026-09-14 | Test cases accumulate through the closing task, and the test files are the only ledger | A separate list of test cases goes stale and then lies. The files are the record |
| 2026-09-14 | Skills wired into CLAUDE.md 1.6, with an overlap table saying which skill owns which job | Two skills firing for one job fails silently. Checked each pair rather than assuming |
| 2026-09-14 | Runtime prompt split out to `Agents/_shared/base-prompt.md`. Reverses the earlier one-file call | CLAUDE.md hit 299 lines against a 200 line cap. Past that, instructions stop being reliably followed. The product needed that file anyway |
| 2026-09-14 | No traffic data in the product. The promise is dropped, not bought | Only Similarweb or Semrush sell it, from $125 a month, a fixed cost before the first customer. Everything else in the tool is free or near-free |

## The six tools, defined 2026-09-14

Drafts came from Gemini, reviewed with Raj one at a time. Each tool's decisions and reasoning are
in its own `Agents/<Tool>/CLAUDE.md`. What follows is only what crosses tools.

| Tool | The decision that shaped it |
|---|---|
| See what competitors charge | Every claim about a named business is quoted and dated. An empty cell is a finding. "What changed since" sits at the top of the card. Self-contained, no hand-off yet |
| Plan what to post | Finished posts, not hooks. Cadence asked once and planned to. A shot instruction per post, never a generated image. 30 days, not 90 |
| Win the job | A template per business category, built on first use and reused after. Prices come from the Pricing tool or are asked for. Never inferred from competitors |
| Turn visitors into enquiries | Render the site and look at it, at phone and desktop width. Write the actual lead magnet, not a concept |
| Price your work | Two numbers asked, with the reason given: current price and cost to deliver. Hard floor, never price below their cost |
| Get it out of your head | Gaps filled with flagged assumptions. The flag is in the words, not the formatting, with a count at the top |

**What repeated across all six, and should move to `Agents/_shared/base-prompt.md` rather than live
in six files:** no feedback prompt inside any deliverable, no workspace switcher, currency is the
customer's, never invent a client, a credential, a result or a number, and the button says what it
does.

**What the six now require that the skeleton does not have:**

1. **Shared state.** Pricing feeds the proposal tool. Competitor data feeds pricing. Without it
   each tool starts from nothing and the suite is six tabs.
2. **Somewhere to store the last run**, or "what changed since" cannot exist.
3. **A headless browser**, for the website audit. First tool that needs one.
4. **A decision on uploads**, which two tools depend on and which is still open.
5. **A decision on audio**, which the landing page already promises.

## The workspace, defined 2026-09-14

Lives in `UI/CLAUDE.md`. It is the app, not a seventh tool, so it is not in `Agents/`.

- **Greeting says nothing clever:** business name and the date. Quiet and never wrong, which puts
  all the weight on the "what moved" block directly under it.
- **Warmth from colour and light, not a photograph.** Two soft berry pools at low opacity, high on
  the page, faded out before any content. A photo behind a working screen fights the text and dates
  within a year, and `#fafaf8` is already a warm ground.
- **Navigation uses the app names** Raj set, not the landing page's job phrases. Two naming systems
  on purpose: the page sells to a problem, the app labels a product.

## Open questions

Nothing here is blocking the next step, but each one costs money or time if it is decided late.

1. **Settled 2026-09-14: flat monthly, fair-use cap.** The number itself is still open. What is not
   yet known is where the cap sits, and that needs the measured cost per run first. The weekly
   change-check is the cost that runs whether or not they log in: estimate £1 to £2 a month per
   customer, every customer.
2. **Settled 2026-09-14: no traffic data.** Revisit only if paying customers ask for it by name.
3. **Do we store uploaded transcripts and voice notes, and for how long?** Blocking two tools now,
   not one. Proposals ingest discovery calls and SOPs ingest brain dumps, both full of other
   people's names, prices and private conversations. Must be answered before either ships.
4. **Which tool goes first?** Proposal, Pricing and SOP are the cheap, reliable ones. Competitor
   Research is the one that sells. Different answers depending on whether the aim is revenue or a demo.
5. **Voice notes: are we transcribing audio?** Now urgent rather than open. The landing page
   copy promises "turn a quick voice note or rough explanation into a step by step process", so it
   is a public commitment, and the SOP tool has to honour it. Still needs a transcription step
   nobody has chosen or costed. Until then that tool takes text only and the page overpromises.

6. **Raj confirms his identity at `facebook.com/ID`, and then we know.** Raised 2026-09-14 on
   seeing "Nobody's advertising was checked" in the barber run. Researched the same day: it is
   free, there is no paid tier, and the blocker turned out to be smaller than assumed. No business
   verification and, on the better sources, no app review either. One identity confirmation with a
   passport and proof of address, 2 to 7 business days.

   **What that unlocks is still unsettled, and it decides the feature.** Meta's own reference says
   ads that did not reach the EU return only if they are political. Three write-ups say the UK
   counts alongside the EU; a fourth says commercial ads are EU-only. Meta 403s every automated
   read, so it could not be settled from the primary source. Every customer we have is UK, so this
   is the single most consequential unknown in the tool.

   The integration is built and tested (`src/ad-library.ts`, 20 cases) and
   `probeCommercialCoverage` answers the question in one call on the day a token exists. Steps:
   `Agents/Competitor Tracker/ad-library-access.md`.

7. **Settled 2026-09-14: search visibility is built.** Three real searches for the Shrewsbury barber
   turned up a flaw in the tool itself, so this is here rather than in the tool's own notes. **Four
   of the five competitors came up in none of the searches**, and four businesses that did come up
   were on nobody's list. We pick competitors by Booksy review count, which finds the businesses
   that are good at Booksy rather than the businesses taking the work. The search now feeds the
   list back, offered under the table and never added silently. Open: whether review count should
   stay the primary way we pick at all.

   **Last-post date came off the list.** It was written down as free and unblocked and is neither.
   Instagram's `robots.txt` prohibits automated collection and names `ClaudeBot` with
   `Disallow: /`; a logged-out profile returns 623KB and nine characters of text; Facebook returns
   400. The follower numbers we already show stay less meaningful than they look.


## Sources checked 2026-09-14

Re-check before launch. Prices and terms move.

- Claude API web search tool: $10 per 1,000 searches. Web fetch: tokens only, no separate charge. https://claude.com/pricing
- Google Places policies, storage and caching limits: https://developers.google.com/maps/documentation/places/web-service/policies
- Trustpilot bans automated collection in its terms and blocks it
- Similarweb traffic tier from roughly $125 a month annual; Semrush API behind a $549 a month tier
- Meta Ad Library API free, needs app review and business verification. Google Ads Transparency Center free, no mature API
- Logged-out scraping of public pages protected from US computer-misuse claims by hiQ v LinkedIn and Meta v Bright Data. Contract, copyright and UK GDPR claims all survive. UK kept the database right after Brexit

## Next actions

**The hold was lifted 2026-09-14** when Raj said to build the Content & Social Planner. That tool
now has its spec, its guards, 66 tests and a workspace screen.

1. **Run the planner against three real businesses** and read every output by hand. A `most days`
   plan is twenty-two posts, and no guard can tell you two of them make the same point in different
   words. `Agents/Content & Social Planner/build-notes.md`.
2. **Move `findFeedbackPrompts` and `findBuildDetail` to `Agents/_shared/`** the moment a third tool
   needs them. There are two copies today, deliberately, and three would drift.
3. **Stand up the Next.js app**: login, an empty dashboard, and the two screens the mockup already
   holds. Rename the folders to lower case with hyphens at the same time.
4. **Measure cost per run** for the planner at each cadence before setting a price.

## Learnings

**2026-09-15 — A test that reads a stylesheet cannot see a browser default.**
"Three weights, and none of them 700" passed for a day while seven elements
across both screens rendered at 700, because `<strong>` and `<b>` default to
bold and a browser default is declared nowhere in the file. Five of the seven
predated the rule. Found by measuring `getComputedStyle` on the rendered page
rather than grepping the CSS. **A rule about what the reader sees has to be
checked against what is drawn, not against what is written.**

**2026-09-15 — A guard can be satisfied by the wrong selector and look green.**
The first version of the fix's own test asserted app.css contains
`strong{font-weight:600}`. It passed with the fix deliberately removed, because
`.tablewrap td strong{font-weight:600}` matched it: a rule covering table cells
only. Anchoring the pattern to the start of a line made it demand a top-level
reset, and it then went red on cue. Two guards in two days that read correctly
and caught nothing. **Watch every guard fail before believing it.**

**2026-09-14 — The builder's tests encode the builder's mistakes, and they pass
every other check.** An independent `break-it` pass on the Content Planner found
that `CLAUDE.md` §4's own worked example, the one sentence the spec names as the
thing that must never be written, was not caught. The test for it quoted the
real example in a comment and then asserted a different one. That test has an
assertion, mocks nothing out, varies its fixture and is not a duplicate. It was
simply shaped to what the code did. Nothing in a self-review finds this, because
the same reading produced both. **Check every expected value against the
requirement, not against the code, and test the example the spec names
verbatim.** 20 of 105 blind cases went red against a suite that was green.

**2026-09-14 — A word boundary only exists next to a word character.** `%\b` and
`\bpurpose:\b` both match nothing, ever. Two rules in one tool read correctly
and caught nothing at all. Grep for `\b` beside punctuation in every tool.

**2026-09-14 — A quota is how a good rule starts inventing things.** The Gemini draft for the
Content Planner required "at least 2 verified competitor wins or blind spots" per plan, and a strict
70/20/10 content ratio. Both look like rigour and both force output where there is nothing to say:
the quota invents a finding on the run that has none, and the ratio is arithmetic nobody can satisfy
at four posts a month. The Competitor Tracker had already learned the same thing as "coverage is
never forced". Expect it in every draft: a number that sounds disciplined and is actually a licence
to fill.

**2026-09-14 — A regeneration that is correct can still be wrong.** The same draft said a critique
on one post must rewrite every later post. Right about the cascade, wrong about the scope: it takes
back the posts the owner already fixed by hand, and at `most days` it is twenty-two rewrites per
click on a flat price. The rule that survived is that their words beat ours, and the tool says how
many it will change before it changes them.

**2026-09-14 — A prompt cannot police its own output.** That draft's "system failure conditions"
told the model to reject and restart its own pipeline. Those became `src/guards.ts` and 66 tests,
which is the only version of that idea that ever fires.

**2026-09-14 — A guard you have not watched fail is decoration.** Writing the
Competitor Tracker suite turned up two defects in guards written minutes earlier
and believed correct: a case-sensitive pattern that would have let a real
reviewer's name into an exported document, and a price-move check that only
looked for the word "price" and so missed "raise your classic cut to £20". Both
were found by a test, not by reading the code. Seven deliberate breakages were
then run through the suite to prove it catches them. Do that on every tool.

**2026-09-14 — Words that are verbs everywhere else are nouns in a trade.** The
price-move detector cannot treat "cut" as a verb, or "classic cut £15" fires on
every row of a barber's battlecard. Expect this in every category template.

---

## Where we got to, 16 September 2026

**Read the git log first.** Every commit message says what broke, why, and what
changed. That is the real record; this is the map.

### Working
The Competitor Tracker runs end to end. Last good run: 162s wall, 5 competitors
from 91 found, 4 grid areas, 3 actions, ~£1.10. Sign-in, workspace, run,
document and the scheduled tick all work. 468 tests, run before every commit.

### Design: Option C, chosen today
One dark warm-navy frame (`--chrome`) carrying the identity and all six tools,
continuing past the tool name. Sand ground (`--sand: #f9f7f4`), paper as the
lift. Inter and IBM Plex Mono via next/font in `app/layout.tsx`, nowhere else.
Figures in mono at 32px. Berry is brand, teal is a good-news figure, the four
status colours mean status only. Hairline borders, no shadow tokens.

`web/app/design.css` is the only stylesheet. It used to be a hand copy of
`UI/app.css` and that copy is how Inter, sand and teal were silently lost. UI/
is a mockup workspace now. Nothing is copied.

Mockups: A editorial, B instrument, C the chosen merge.

### Rules added today, all in CLAUDE.md
- 1.4a Readable by an owner, not just correct. Nielsen's heuristics, not house
  rules. Enforce shape limits in the JSON schema, not in the prompt.
- 1.4.8 Nothing we run for our own purposes touches real rows.
- 1.4.9 Print the raw thing beside the number before reporting it.
- TESTING.md: a test that cannot fail; commit before breaking on purpose.

### Faults fixed today, so they are not rediscovered
Citations attributed to the wrong business; a short trading name deleting real
competitors; unsourced claims on the grid and the two columns; raw exception
text on screen; the watchdog killing a resumed run; an American listing read
for a UK town; a whole platform skipped; the writing step deciding who was on
the card; prices never checked against the page they cite.

- **A model told to refuse writes something anyway.** Told "if the photo is not that service,
  say false and write nothing", it answered `shows: false` and wrote a full post in the same
  reply. The design that works is to ask it to observe and to decide ourselves: the boolean is
  read, the post is discarded. Never build a refusal that depends on the model withholding
  output.
- **The guards cannot see a mismatched source.** A post about a desk carrying the real £51 cut
  price, cited to the real price list page, passes every check in `unsafe`: the price is
  published, the page was read, the numbers are right. What was wrong was that the photo did not
  show the service. Nothing numeric or named was false, and that is the only kind of false those
  guards test for.

### Pending
1. Prompt caching. Input went 78k to 179k when the grid split into four
   parallel calls. Time halved, money roughly flat. This buys it back.
2. Five of six tools do nothing.
3. "What moved since last week" does not exist. Only appears on run two.
4. A stopped run does not resume; reopening starts from zero.
5. Cross-customer data leak untested. Needs the live tables, which 1.4.8 puts
   out of bounds. Needs a deliberate safe method.
6. Not deployed. No privacy policy, no processor agreements, retention job
   unscheduled. Minute-level cron needs a Vercel Pro plan.
7. Landing page still shows Reed Plumbing in its workspace preview.

---

## Where we got to, 17 September 2026

### The Competitor Tracker finished a run for the first time

Five named St Albans competitors, two comparison grids, three actions, five sources, 6.5
minutes, 199,910 billed against a 300,000 ceiling. Before today it had never produced a
document from a run anyone watched.

The Content & Social Planner also ran live and succeeded at 20:43: 12,227 tokens, 30
seconds, two posts written and none dropped. The same salon on 16 September had both its
posts dropped for inventing prices of £126 and £89.

### Faults fixed today, so they are not rediscovered

Each was found by counting run records rather than reading code, and each has a test that
was broken on purpose and watched go red.

- The setup stored a comparison key as the website, so every later `new URL()` threw. Five
  of eleven substantive failures.
- Five search terms went in one request and the results accumulated turn on turn: 127,351
  input tokens for one call. One term per call now.
- The naming call asked a model who the competitors were before crawling. It never once met
  its threshold in five runs, cost between 42 seconds and 19.5 minutes, and is off behind
  `ASK_FIRST`.
- `\bbarbers?\b` does not match "Barbering", so three barbers were compared against a
  women's salon.
- A Melbourne listing and a New York one were accepted because the country test was a
  blocklist. One rule now, positively checked, in `resultCountry`.
- **The town key kept punctuation**, so "St. Albans" refused every UK listing and accepted
  the American one, whose path happens to write the stop. One rule now, in `tools/place.ts`,
  which also handles apostrophes and accents: King's Lynn and Ynys Môn both failed the first
  fix.
- Search result page titles were offered as businesses. "Hairdressers in St Albans" reached
  a real owner's screen.
- The token ceiling counted `input` and ignored cache writes, so it read 87,274 for a run
  that cost about 146,000. It counts what is billed now.
- `enough()` stopped on names, leaving unopened the one page carrying 38 ratings, 34 prices
  and 40 profile links. It counts usable rows now.
- The lookup took whatever search ranked first, so a Cylex directory beat a Fresha profile.
  Three tiers, read from the source registry rather than a new list.
- `judge()` refused a business's own profile because the url named their village. It accepts
  the locality we already hold; the country stays absolute.
- A run left overnight was resumed, so rows gathered before a fix arrived as findings after
  it. Screens and the scheduler now share one age limit.
- The planner's writer was never told which prices it could state, while the guard checking
  it knew. Both halves agree now.

### Added today

- **The competitor picker.** 24 candidates, 10 shown, our five pre-ticked, add your own by
  name, 48 hours then ours stand. Built because one listing record in twenty is factually
  wrong about the business and no rule reading that record can tell.
- **A `finding` stage** that looks up a page for each chosen competitor, after the pick
  rather than before, which is what makes five searches affordable where 24 were not.
- **Three ways to ask for a post** in the planner: eight intent categories, a rough thought
  expanded, and starting from a photo shown disabled. The month plan stays as the prompter.

- **A model told to refuse writes something anyway.** Told "if the photo is not that service,
  say false and write nothing", it answered `shows: false` and wrote a full post in the same
  reply. The design that works is to ask it to observe and to decide ourselves: the boolean is
  read, the post is discarded. Never build a refusal that depends on the model withholding
  output.
- **The guards cannot see a mismatched source.** A post about a desk carrying the real £51 cut
  price, cited to the real price list page, passes every check in `unsafe`: the price is
  published, the page was read, the numbers are right. What was wrong was that the photo did not
  show the service. Nothing numeric or named was false, and that is the only kind of false those
  guards test for.

### Pending

- **Workspace `2b6a7451-57fd-4cab-bf3a-c36d1e95e589` is a duplicate of A Cut Above and must
  not be used.** Its documents and `found_via` were moved to
  `5f42eff6-7536-4f13-83d7-a0a841750f1b` on 17 September; the empty row was deliberately
  left in place because its 11 runs are the only record of the New York screen, the town
  bug and the first tracker run that reached `done`. Delete it once that evidence is no
  longer wanted. Summaries are in the session scratchpad as `2b6a7451-runs.json`.
- Starting a post from a photo needs a storage bucket, an upload route and an image in the
  model call. None of it exists; the path is on screen and refused by name.
- The `finding` stage's token estimate is arithmetic, not measurement. Revisit the 300,000
  ceiling once three runs have been through it.
- Two of the five discovery search terms produced nothing on the one run measured. Two more
  runs would say whether to cut them, and they are the largest single line in the bill.
- `state.knownHosts` is written by the `choosing` stage and read by no production code.
  Its only consumer was `trusted`, which the country test replaced. Three tests in
  `fallback-wiring.test.ts` still assert it is populated and excludes blocked hosts, so it
  reads as a live feature and is not one. Left in place on 18 September because deleting it
  deletes those assertions too. Either give it a consumer or drop it with its tests, but do
  not leave it looking wired up.
- A Cut Above's services read off their site are twelve long names ("Ladies Cut & Finish -
  Graduate Stylist" through to "- Creative Director"), which is twelve long buttons on the photo
  path. Correct, and awkward to pick from on a phone. Grouping by service with the stylist grade
  as a second choice would be the fix, and it needs Raj's call before building.
