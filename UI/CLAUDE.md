# UI: the workspace

> **Status:** defined 2026-09-14, not built. This folder holds the app. The workspace is not a
> seventh tool, it is the thing the six sit inside.
>
> **What is here now:** `brand.css` (the tokens, and the source of truth for them),
> `landing-page.html` (a published mockup), `landing-page-r1.html` (kept so panel rounds stay
> comparable). No Next.js app yet.
>
> Tool definitions live in `Agents/<Tool>/CLAUDE.md`. This file covers the shell around them.

---

## 1. The shell

Three parts. Nothing else.

```
┌────────────────────────────────────────────────────────┐
│  ● Suite                                    Account    │  header, 64px
├──────────────┬─────────────────────────────────────────┤
│              │                                         │
│  navigation  │   the tool, or the home screen          │
│  240px       │                                         │
│              │                                         │
└──────────────┴─────────────────────────────────────────┘
```

**No workspace switcher.** One business, theirs. No caret next to the name, no breadcrumb carrying
it, nothing that implies a second one exists.

**No status lines about our plumbing.** "Context synced across 6 tools" tells an owner nothing and
quietly invites them to worry about whether it synced.

## 2. Navigation

Named with the app names Raj set on 2026-09-14, which are in each tool's `CLAUDE.md` under
"Header, as it appears in the app".

| | |
|---|---|
| **Home** | The date, and what moved |
| **Competitor Tracker** | |
| **Content & Social Planner** | |
| **Proposal & Quote Builder** | |
| **Lead Capture & Funnel Builder** | |
| **Pricing & Package Builder** | |
| **Process & SOP Builder** | |
| **Documents** | Everything ever generated |
| **Your business** | The one profile every tool reads |
| **Account** | Billing, theme, export everything, delete everything |

**Two naming systems, on purpose.** The landing page names each tool by the job ("Turn visitors
into enquiries") because it is selling to someone who has a problem. The app names it as a product
because they have already bought and now need to find it again. Written down so it does not look
like drift in three months.

**Active state is never colour alone.** Fill, plus weight 600, plus a 2px berry rail on the left
edge. Three signals.

## 3. The home screen

**The greeting says nothing clever (decided 2026-09-14).**

> **Reed Plumbing**
> Monday 15 September

That is the whole header. It is quiet and it is never wrong.

**Which puts all the weight on what sits underneath.** A greeting that carries no information has
to be followed immediately by something that does, or the screen is empty furniture. So the first
block on the page is what changed:

```
Reed Plumbing
Monday 15 September

What moved
  PRICE    Drayton put their call-out fee up from £60 to £75.   drayton.co.uk · 8 Sep
  REVIEWS  Three new reviews for Kemp mention waiting.          Google · 14 Sep
  Nothing else moved. We checked 5 competitors and 23 pages.

Carry on
  [ the last three things they were working on ]
```

**"Nothing else moved" is not filler.** It is the line that makes a quiet week trustworthy, and it
is why the loud weeks get believed.

**Week one, before anything can have changed**, the block keeps its place and its heading, and
shows the dated baseline instead: what the five competitors charge today, each sourced. It proves
the product already ran rather than apologising for having nothing.

## 4. Warmth, without a photograph (decided 2026-09-14)

**Colour and light, not an image.** A photograph behind a working screen fights the text and dates
within a year. The ground is already warm: `#fafaf8` is a warm off-white, not a cold grey.

Two soft pools of berry at very low opacity, high on the page, fading out before any content
starts:

```css
.shell-top{
  background:
    radial-gradient(900px 320px at 18% -60px, rgba(166,30,77,.075), transparent 70%),
    radial-gradient(680px 260px at 82% -40px, rgba(166,30,77,.045), transparent 70%),
    var(--paper);
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]) .shell-top{
    background:
      radial-gradient(900px 320px at 18% -60px, rgba(201,55,106,.16), transparent 70%),
      radial-gradient(680px 260px at 82% -40px, rgba(201,55,106,.10), transparent 70%),
      var(--paper);
  }
}
```

**Rules.** Berry only, no invented colours. It never sits behind body text, a table or a document.
It fades to nothing by roughly 360px. It does not animate. If it makes anything harder to read,
it is too strong.

## 5. States every screen needs

| State | What it does |
|---|---|
| Empty, first use | Names the outcome, not the absence. "You have not written a quote here yet." Never an illustration, never the word "empty" |
| Loading, under 3s | Skeleton bars at the real line lengths. Never a spinner |
| Streaming | The document's real headings first, then the words filling in. Progress in their units: "2 of 5 competitors" |
| Nothing found | A result, not a gap. "Vale publish no prices. That is worth knowing." Plus what we checked |
| Partly failed | Keep what worked. Say what did not, name it, offer to retry just that part |
| Failed | The draft is saved. Carry on, or start again |
| Offline | A strip under the header. "Nothing is lost. We will keep trying." |

**No toasts anywhere.** Confirmation belongs at the thing that changed: a tick inside the button, a
flash on the row that saved. A toast appears where nobody is looking and leaves before it is read.

## 6. Under 768px

Header, scrolling content, and a four-item bottom bar: Home, Tools, Documents, Account. Six tools
do not fit in a tab bar, so Tools opens a sheet listing them.

An owner on a phone should be able to read what moved, act on it, read a finished document and
forward it, and start something running then walk away. Editing a month of posts is honestly
deferred with one line and a way out, never a dead end.

## 6a. Feedback that we can act on (decided 2026-09-14)

**"Yes" and "Not really" tell us nothing.** A thumbs-down cannot be turned into a change. Replaced
with three named things, because a count is actionable and a mood is not:

| They pick | We get | What we do with it |
|---|---|---|
| **Something here is wrong** | Which business, which row, and what it should say | Verify it, fix it in Monday's run, and turn it into a test so it cannot come back |
| **Something is missing** | A tick against a named list of things we could add, plus free text | Count it across everyone. What is asked for most is what gets built |
| **The actions do not fit** | Already doing it, cannot do it, not my biggest problem, do not believe the evidence, too vague | Goes to whoever writes the actions |

**Named options, not a text box.** A count of "twelve owners want to see advertising" is a decision.
Twelve paragraphs of prose is a reading job nobody does. Free text sits underneath each list for the
thing we did not think of.

**What we already know is missing is shown as known.** Advertising carries a "we know, it needs
Meta's approval" tag in the list. It still counts as a vote, and the customer is not left telling us
something we could have told them.

**It stays outside the document render tree**, so it can never reach an export. Section 7.2.

## 6b. Design

`design-rules.md` for the type system, the vertical rhythm, and how much there is
to read. `app.css` is the stylesheet and the record. Never hand-edit the CSS
inside an HTML file: edit `app.css` and run `python3 sync-styles.py`.

## 6c. Two sessions, shared files (decided 2026-09-15)

`app.css`, both HTML pages and the docs in this folder are edited by two Claude
sessions. Until 15 September they coordinated by messaging each other, which
worked and turned into its own activity. Raj: keep the shared assets consistent,
stop asking permission.

**Claim the lock before writing a shared file.** `python3 lock.py claim <who>`,
write, `release`. It exits 1 when someone else holds it, so a chained command
stops on its own. A lock older than five minutes is ignored, so a session that
dies mid-write cannot block the other.

**Otherwise decide independently.** No handshakes, no notifications, no waiting.

**Except for what is visible.** A change to a shared file that alters how the
other screen looks or reads goes to Raj, because it is a decision about the
product rather than about the code. Square buttons becoming pills was one.
Narrowing a guard, moving a test or renaming a class with no visual change is
not: settle it and get on.

**Each session's tests assert its own screen.** A test that asserts another
session's markup makes their legitimate change your red build, which is the
coupling this rule exists to remove.

## 7. What must never appear

1. A workspace switcher, or anything implying a second business.
2. A feedback control inside a document. It lives in the app around the document, and it is
   structurally outside the document render tree so it cannot reach an export.
3. A usage counter, credit balance or upgrade nag. The price is flat with a fair-use cap, chosen
   precisely so none of this exists.
4. A percentage or confidence score on anything we inferred. Uncertainty is said in words.
5. A spinner for anything under three seconds.
6. Any claim about a competitor's traffic.
7. Anything about how the product is built or how our work is going. Suppliers, approvals,
   paperwork, schedules, "we are working on it". The customer-facing reason for a gap is "we cannot
   see this yet" and nothing more. A status claim about our own work is the easiest false statement
   in the product to write, because nobody can check it. Tested by `findBuildDetail`.

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
