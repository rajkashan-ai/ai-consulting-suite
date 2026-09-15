# What we hold, why, and what you still have to do

Written 15 September 2026. This is the record of processing UK GDPR Article 30
asks for, in plain English rather than legal English.

---

## First, the thing you asked about

**We store no passwords, because we never take one.** There is no password
field anywhere in the product, no password reset, and nothing to hash. You sign
in with Google, and Google verifies you, or we email a six digit code and you
prove you can read that inbox.

That removes a whole category of risk rather than managing it. There is nothing
to leak in a breach, nothing to stuff with credentials from someone else's
breach, and no reset flow, which is usually the weakest part of any login.

**We store no usernames either.** The only identifier we hold is an email
address. There is no separate username to choose, remember, or lose.

So the real question is not how we protect passwords. It is what we do hold,
which is below.

---

## Everything we hold

| What | Personal data? | Why we have it | Lawful basis | How long |
|---|---|---|---|---|
| Email address | Yes | It is the account | Contract | Until the account is closed |
| Which emails may sign in | Yes | Nobody uninvited can get in during testing | Legitimate interests | Until testing ends |
| Business name, website, trade, town | Usually not. Yes for a sole trader trading under their own name | Every tool reads it | Contract | Until the account is closed |
| Documents the tools produced | Only if a tool put a person in one, which is what the controls below prevent | It is the customer's work | Contract | Until they delete it |
| Addresses and dates of public pages we read | No | So any figure can be traced to its source | Legitimate interests | 400 days |
| What each run cost | No | So the fair use cap gets a real number | Legitimate interests | 400 days |

Three things we deliberately do **not** hold: card details, which Stripe holds
and we never see; any password; and any page we have read, as opposed to our
own summary of it.

---

## The risk that is actually ours

It is not the login. It is **other people's reviews.**

A review is written by a real person who has never heard of us, agreed to
nothing, and is often naming a member of staff. CLAUDE.md 1.5 rule 6 already
says reviews give themes and never named individuals, and that under UK GDPR
"it was public" is not a lawful basis for anything.

That rule is now enforced by code, in three layers, because a rule in a
document is a rule until somebody is in a hurry.

1. **The model is told.** Every prompt that reads a review asks for themes and
   counts, never a name.
2. **`lib/privacy/redact.ts` strips what a model is bad at spotting.** Email
   addresses, UK phone numbers in every shape people write them, full postcodes
   (the district is kept, because that is a place and not a household), social
   handles other than the business's own, and any name we were actually given.
3. **`assertNoContactDetails` throws before anything is written.** It refuses
   rather than cleans, so a fault upstream is a loud failure instead of a quiet
   one.

A quote that still carries anything personal is dropped whole, not tidied up.
One quote is not worth finding out what else in that sentence identifies
somebody. Quotes over 25 words are also dropped: past that it stops being a
citation and becomes a copy of somebody's writing, which is rule 5 and the UK
database right.

Twenty-two tests cover this and the robots.txt gate. `npm test`.

---

## What the database does on its own

Nothing here depends on anybody remembering it.

**Isolation.** Row Level Security on every table. A table with RLS and no policy
denies everything, which is the safe failure. It is the database that refuses,
not our code, so a bug in a query returns nothing rather than somebody else's
business.

**Nobody uninvited.** A trigger on `auth.users` refuses anyone not on the
allowlist, inside the signup transaction, so they leave no row behind at all.
An account we never wanted is still somebody's personal data we would be
holding.

**Get everything.** `export_my_data()` returns the lot as JSON, and the account
page downloads it. Articles 15 and 20.

**Delete everything.** `delete_my_account()` deletes the auth user and every
table cascades from it, so no table can be missed by a list nobody updated.
Article 17. It is behind a typed confirmation, checked on the server.

**Keep it no longer than needed.** `purge_old_research()` deletes sources and
runs past 400 days. Article 5(1)(e).

> **This one is not switched on yet.** It does nothing until pg_cron calls it.
> Until that line is run, retention is a promise and not a control. The command
> is in `supabase/003_privacy.sql`, and `select * from cron.job;` says whether
> it is really scheduled.

**The record stays true.** The Article 30 entries are `comment on` statements
on the tables themselves, so `\d+ public.profiles` tells the truth for ever,
rather than a document that goes stale the first time somebody adds a column.

---

## What I cannot do, and you must

None of these are code. All of them are needed before a real customer signs up.

1. **A privacy policy and a cookie notice**, linked from the sign-in page. We
   currently have neither. Until we do, we are collecting email addresses with
   no notice, which fails Article 13 on its own.

2. **Data processing agreements** with the three companies that process data on
   our behalf. Each publishes one and accepting it is a form:
   **Supabase** (the database), **Vercel** (hosting), **Anthropic** (the model
   reads the page text we send it).

3. **Where the data sits.** Choose London or Ireland for the Supabase region.
   Anthropic processes in the US, which needs a transfer mechanism, and the
   agreement in point 2 is normally where that is covered. Check that rather
   than assume it.

4. **Ask Anthropic about retention.** Whether they retain what we send has a
   direct answer and I have not verified it, so I am not going to state it.
   Zero data retention usually has to be asked for.

5. **The ICO.** A UK business processing personal data normally has to register
   and pay an annual data protection fee. Check whether we are in scope before
   the first paying customer.

6. **A breach plan on one page.** 72 hours is the deadline for telling the ICO,
   and it starts when you become aware, not when you have worked out what
   happened. Who is called, who decides, where it is written down.

7. **Turn off the pause on Google's consent screen.** Publish it before real
   customers arrive, or an unverified app caps you at a small number of users.

8. **Read the retention job is scheduled.** Point above. It is one line and it
   is the difference between a policy and a control.

---

## Honest limits

Redaction finds patterns. It cannot reliably find a first name in running text,
because a first name looks like an ordinary word, and it cannot find a name
nobody told us about. That is why the model is instructed first and why quotes
are dropped rather than cleaned. It is a strong control, not a guarantee, and
anyone who tells you a regular expression guarantees this is wrong.

The 400 day retention is a decision, not a law. It is a year plus a margin so a
tool can always say what changed since this time last year. If that turns out
to be longer than we need, shorten it: keeping data because it might be useful
is the thing Article 5(1)(e) exists to stop.
