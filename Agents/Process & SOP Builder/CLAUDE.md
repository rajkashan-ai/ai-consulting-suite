# Process & SOP Builder

> **Status:** defined 2026-09-14, not built. First draft from Gemini, reviewed and amended with Raj
> the same day. Keep the first build simple and let real output show what is missing.
>
> **Customer-facing name:** "Get it out of your head" (the landing page's wording).
>
> Every tool prepends `Agents/_shared/base-prompt.md`. This file adds what is specific to this one.

---

## Header, as it appears in the app

**Process &amp; SOP Builder**

> Write down how you do things so someone else can pick it up&mdash;turning messy brain dumps and rough voice notes into clean, foolproof checklists that get tasks out of your head and onto your team.

_Set by Raj 2026-09-14. Customer-facing. The landing page names the same tool by its job,
which is deliberate: the page sells by problem, the app labels by tool._

> **This header overpromises, and Raj decided on 2026-09-14 to keep it and fix it before
> launch.** "foolproof" conflicts with shipping [ASSUMED, check this] markers. "onto your team" excludes the solos we widened to. "voice notes" is promised here and on the landing page while still undecided. Do not treat it as a build spec.

---

## 1. Who it is for and what it answers

"Everything still goes through me and nothing is written down." They cannot take a week off, cannot
hand anything over, and cannot train anyone, because the only copy of how the business works is in
their head.

## 2. What it takes in

| Input | Where it comes from |
|---|---|
| The process | A name, typed. One field |
| How it works | A brain dump: pasted notes, or **an uploaded voice note** (see §6) |
| The business | Their profile |

**Read all of it.** A brain dump rambles, doubles back, and buries the important condition in a
subclause near the end. Work through long input in pieces and pull the pieces together. Never
truncate, never skim the tail.

## 3. The gaps, and what we do about them (decided 2026-09-14)

**A founder always skips the obvious steps, because they are obvious to them.** They will say "then
I invoice them" and leave out which system, when, and what has to be true first. That gap is
exactly what makes an SOP useless to the new person it was written for.

**Decision: fill the gap with a sensible default, flagged.** Not left blank.

The risk this carries, stated plainly: **a flagged assumption reads like an instruction once it is
printed and handed to a new starter.** So the flag has to be impossible to miss and impossible to
lose.

Three rules make that true.

1. **The marker is in the words, not the formatting.** `[ASSUMED, check this]` inline, in the step
   itself. Colour and italics do not survive a copy and paste into a Word document or a printout.
2. **A count at the top of the document**, before the first step:
   `We assumed 4 things you did not tell us. They are marked below. Check them before you hand
   this to anyone.`
3. **The assumption says what it assumed and why**: `[ASSUMED: raised in Xero, because your site
   lists Xero. Check this.]` An assumption whose reasoning is visible is easy to correct. One
   without is just a sentence.

**A test asserts it:** an exported SOP containing assumptions contains the marker text and the
count line. If the flag can be lost, the decision above becomes the dangerous version of itself.

## 4. What it produces

Keep the first build to this.

```
## What this is
   The trigger, what finished looks like, and roughly how long it takes.
   Plus the assumption count, if there are any.

## The steps
   Numbered, in order, each one a thing a person does. Assumptions marked inline.

## What goes wrong
   The two or three mistakes that actually happen, and the check that catches each one.
```

**Written for someone who knows nothing.** No shorthand, no "as usual", no names of things only the
founder would recognise. If a step says "send it to Dave", the SOP says who Dave is and what he
does with it.

**One person, one action, one step.** A step containing three things is three steps.

## 5. What it must never do

1. **Never present an assumption as a fact.** §3. This is the whole tool.
2. **Never invent a tool, a system or a login** without marking it as assumed and saying why.
3. **Never invent a person.** If the dump does not name who does something, the step says
   `[WHO DOES THIS? Not stated]` rather than inventing a role.
4. **Never invent a legal, safety or compliance step.** If a process touches gas work, food, data,
   or anything regulated, and the founder did not mention the requirement, do not add one from
   memory. Say that the process may have obligations we have not checked. A wrong compliance step
   in a followed procedure is the worst thing this suite could produce.
5. **Never put a feedback prompt inside the SOP.** It gets printed and pinned up. Same test as
   every other tool.

## 6. Blocking: the voice note

The landing page promises "turn a quick voice note or rough explanation into a simple step by step
process". That is a public commitment and this is the tool that has to honour it.

**Whether we transcribe audio at all is still undecided and uncosted** (`memory.md`, open question).
It needs a transcription step nobody has chosen or priced. Until it is decided, this tool accepts
text only, and the page overpromises.

Decide before this ships, not after.

## 7. Build notes for the first version

- No workspace switcher.
- One field for the process name, one big box for the dump, one upload.
- The button says what it does.
- Export as .docx, and check the assumption markers survive it. That is the test in §3.

## 8. Open

1. **Uploads and retention.** Brain dumps name staff, clients and suppliers. Same open question as
   the proposal tool, and it has to be answered before either ships.
2. **A library of processes.** Most small businesses need the same dozen: onboarding a client,
   chasing an invoice, handing over a job. The template mechanism from the proposal tool would fit
   here. Not in the first build.

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
