# Lead Capture & Funnel Builder

> **Status:** defined 2026-09-14, not built. First draft from Gemini, reviewed and amended with Raj
> the same day. Decisions below are settled unless this file says otherwise.
>
> **Customer-facing name:** "Turn visitors into enquiries" (the landing page's wording).
>
> Every tool prepends `Agents/_shared/base-prompt.md`. This file adds what is specific to this one.

---

## Header, as it appears in the app

**Lead Capture &amp; Funnel Builder**

> Fix what your website is getting wrong so more visitors become enquiries&mdash;turning passive browsers into steady leads with clear landing page copy and simple automated follow-ups.

_Set by Raj 2026-09-14. Customer-facing. The landing page names the same tool by its job,
which is deliberate: the page sells by problem, the app labels by tool._

> **This header overpromises, and Raj decided on 2026-09-14 to keep it and fix it before
> launch.** "automated follow-ups" says we send the emails. We write them, ready to paste. Nothing connects to their mail tool. Do not treat it as a build spec.

---

## 1. Who it is for and what it answers

"People visit the site and nobody calls." They are paying for a website that does nothing, and
nobody has ever told them why.

## 2. What it takes in

| Input | Where it comes from |
|---|---|
| Their website | Their profile. **Never asked again** |
| What an enquiry looks like for them | One question, a short list. A call-out, a quote request, a booking, a sample |
| What they sell and to whom | Their profile |

## 3. We render the site and look at it (decided 2026-09-14)

**The audit is of what a visitor actually sees, not of the markup.**

Fetching a page gives text and HTML. It does not tell you what is above the fold, whether the phone
number is findable, whether the important thing is buried under a cookie banner, or what the page
looks like on a phone in a van. Judging layout from source order is a guess about something we
cannot see, presented to someone who will act on it.

So: load the page in a headless browser, capture it at phone width and desktop width, and audit
what is genuinely visible.

**This adds a browser to the stack.** It is the first tool that needs one, it costs a couple of
seconds a run, and it is the difference between an audit and an opinion.

**Audit both widths.** Half of these visitors are on a phone. A site that works on a laptop and
hides the phone number on mobile is the single most common finding, and it is invisible from the
desktop view.

## 4. What it produces

```
## What someone sees in the first three seconds
   What is actually visible at phone width and at desktop width, and what is missing.
   Specific: "your phone number is not on screen until you scroll twice on a phone."

## What is stopping people getting in touch
   Ranked, most costly first. Each one tied to something in the capture, not to a general rule.

## Your lead magnet
   Not a concept. The finished thing, written out and ready to save.

## The page it sits on
   Headline, subhead, three benefits, the button wording, and what goes below.
   Plus how to add it to their site: the steps for Wix, Squarespace, WordPress.

## Three emails
   Delivery, proof, and the ask. Written, ready to paste.
```

**Finished, not concepts (decided 2026-09-14).** Not "a 5-point heating efficiency checklist for
property managers" but the checklist itself, five points, written. Consistent with the content tool
handing over posts rather than hooks. A concept is still a blank page.

**They still have to build the page**, so the instructions for doing that are part of the output,
named for the platform their site actually runs on. This is where most will stall, and it is worth
knowing that when we look at whether the tool worked.

**"Automated" comes out.** We write three emails. We do not send them and we are not connected to
their mail tool. Calling the sequence automated promises something we do not do.

## 5. What it must never do

1. **Never invent proof.** The second email is "value and proof", and the draft suggested a case
   study. These emails go to real prospects under the owner's name. No invented client, result,
   percentage, timescale or testimonial. Where proof is needed, leave a marked gap and tell them
   what to put in it.
2. **Never claim we know their traffic.** We can see their site. We cannot see their visitor
   numbers, their bounce rate or where anyone came from. If a finding needs that data, say we do
   not have it. Their own analytics does.
3. **Never audit a page we could not load.** If it is behind a login, a holding page, or it timed
   out, say so and stop. A confident audit of a page we never saw is the worst output in the suite.
4. **Never put a feedback prompt inside the deliverable.** The lead magnet gets sent to their
   customers. Same test as every other tool.
5. **Never rewrite their site for them.** We say what is wrong and give them the words. We do not
   pretend to have changed anything.

## 6. Build notes for the first version

- No workspace switcher. Website comes from the profile.
- One question before the run: what an enquiry looks like for them. Named options.
- The button says what it does, not "Diagnose & Build Lead Funnel".
- Export as .docx, because the lead magnet gets edited and branded before it goes out.
- Cost per run is higher than the text-only tools because of the render. Log it separately.

## 7. Open

1. **Hosting the page.** The stronger version of this tool gives them a working page on our domain
   with a form that emails them each enquiry, so they have a link on Monday rather than a document.
   Not in this build. It would make us a processor of their leads' personal data, which brings
   duties we do not have today, and that needs deciding properly rather than in passing.
2. **The template library** from the proposal tool applies here too. A lead magnet for a trade and
   one for a consultancy are different shapes. Worth using the same mechanism rather than inventing
   a second one.
3. **Re-auditing.** A site changes. Whether this tool re-checks on a cadence, like the competitor
   one does, is undecided.

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
