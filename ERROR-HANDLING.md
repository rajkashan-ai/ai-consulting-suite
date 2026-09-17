# How this suite handles errors

**Status:** decided 2026-09-17. Supersedes nothing: there was no position before this.

This exists because the same question got two different answers from me an hour apart. A decision
that lives in a conversation is re-derived from scratch every time it is asked about, and lands
somewhere slightly different each time. A decision in the repository is checked rather than
reinvented.

Everything in **The standard** is quoted or paraphrased from a primary source, with the link.
Everything in **What we do** is a choice, with the reason it was made and what was rejected.
Read the difference: the first part does not move, the second can, but only deliberately and by
editing this file.

---

## The standard

### 1. Catching an error and doing nothing is a named weakness

**CWE-390, "Detection of Error Condition Without Action"**: *"The product detects a specific error,
but takes no actions to handle the error."*

Its stated consequence: *"An attacker could utilize an ignored error condition to place the system
in an unexpected state that could lead to the execution of unintended logic and could cause other
unintended behavior."*

Its stated mitigations, in MITRE's own words:

- *"Properly handle each exception. This is the recommended solution. Ensure that all exceptions
  are handled in such a way that you can be sure of the state of your system at any given moment."*
- *"If a function returns an error, it is important to either fix the problem and try again, alert
  the user that an error has happened and let the program continue, or alert the user and close and
  cleanup the program."*
- *"Subject the product to extensive testing to discover some of the possible instances of
  where/how errors or return values are not handled."*

Note what that second one does **not** include: carry on silently. Three options, and all three
either fix it or tell somebody.

Source: <https://cwe.mitre.org/data/definitions/390.html>

### 2. What a log event has to carry

**OWASP Logging Cheat Sheet.** Every entry captures **when, where, who and what**:

| | Fields |
|---|---|
| When | Log timestamp, event timestamp, interaction identifier |
| Where | Application name and version, server address, page or URL, code location |
| Who | User device identifier, IP address, authenticated user identity |
| What | Event type, severity, description, action, affected object, result status, reason |

Application errors and system events are on its list of things to log.

Its "never log" list matters as much: source code, session IDs, access tokens and passwords,
database connection strings and encryption keys, payment card and bank details, sensitive personal
data and certain PII, and anything the user has not consented to.

Source: <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>

### 3. What the framework provides

Next.js 16.3.5 documents three mechanisms, and we use this version.

| Mechanism | Catches | Documented purpose |
|---|---|---|
| `error.tsx` in a route segment | Uncaught render errors in that segment's children | Show a fallback instead of the crashed tree; the docs' own example logs the error in a `useEffect` |
| `global-error.tsx` in the app root | Errors in the root layout | Must define its own `<html>` and `<body>` |
| `onRequestError` in `instrumentation.ts` | Server errors: Server Components, Route Handlers, Server Actions | *"track server errors to any custom observability provider"* |

The docs are explicit about two limits: error boundaries *"don't catch errors inside event
handlers"*, and *"errors in event handlers or async code aren't handled by error boundaries because
they run after rendering"*. Those have to be caught by hand and put into state.

`onRequestError` receives `error`, `request` (path, method, headers) and `context` (routerKind,
routePath, routeType, renderSource, revalidateReason, renderType). The docs warn that the error
*"might not be the original error instance thrown, as it may be processed by React"*, and that the
`digest` property identifies the actual error type.

Sources: <https://nextjs.org/docs/app/getting-started/error-handling> and
<https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation>

### 4. Correlation is what makes records useful

**OpenTelemetry logs specification.** Logs are tied to the rest of the picture three ways:
temporally, by execution context (trace and span identifiers, so *"logs and traces that correspond
to the same execution context"* can be read together), and by resource context.

Source: <https://opentelemetry.io/docs/specs/otel/logs/>

---

## What we do

### Rule 1. No error is discarded

Every `catch` does one of exactly four things, and says which in a comment:

| | When | What it must do |
|---|---|---|
| **Fix and retry** | A transient failure with a known recovery | Retry, and record it if it keeps happening |
| **Tell the customer and continue** | An expected outcome: a page refuses us, a source is blocked | Put it on the screen in their words; record our words |
| **Tell the customer and stop** | The run cannot produce anything honest | Fail the run with a reason, both halves |
| **Expected and uninteresting** | A parse that is allowed to fail and has a correct fallback | Say so in a comment. This is the only silent option |

This is CWE-390's three options plus one, and the fourth is narrow on purpose: a `catch` with no
comment saying why it is silent is a bug, not a style preference.

`} catch {` with no error binding is banned outside the fourth case, because it throws the evidence
away before any line of code could use it.

### Rule 2. Two readers, always

Already in `CLAUDE.md` 1.4 and repeated here because error handling is where it gets broken. Every
failure produces two texts:

- **`say`**, for the customer. Plain, no machinery, no blame. Translated by `lib/plainly.ts`.
- **`why`**, for us. The real reason, kept on the record, never rendered.

A run stores both: `runs.error` and `runs.state.watch.stopped`.

### Rule 3. What is recorded, and what never is

We follow OWASP's when/where/who/what, cut to what we can honestly fill in:

| | Ours |
|---|---|
| When | Timestamp |
| Where | Route or stage, and the code location |
| Who | Workspace id and run id. **Never the email, never the IP** |
| What | The message, the digest where Next gives one, and the reason |

The "never log" list is not a judgement call here: `lib/privacy/redact.ts` already exists and
already strips contact details, and it applies to anything recorded. A run's own state must never
be written into an error record wholesale, because it holds page text read off the web.

### Rule 4. The framework hooks are not optional

`app/error.tsx`, `app/global-error.tsx` and `instrumentation.ts` with `onRequestError` exist and
write to the same place. Without them an uncaught render error has nowhere to go: on 2026-09-16 a
React crash reached a customer's screen and the only record of it anywhere was a screenshot.

The crash is worth naming, because it shows why this is not paperwork. The tool screen returns a
different component from each branch into the same slot. React reconciled the finished card with
the live progress panel, which has five hooks to its none, and threw. The progress panel is what
drives the run, one step per request, so the crash stopped the run, and reloading started a new one
from zero. 434,000 tokens became 508,000, and nothing anywhere said why.

### Rule 5. Counting is what answers "is it still happening"

A single record says an error happened once. It cannot say whether it is still happening, which
needs the same error grouped across occurrences with a first-seen, a last-seen and a count.

So an error record carries a **fingerprint**: a stable key built from the message and the code
location, not from the timestamp or the ids. Same fault, same fingerprint, one row, a count that
goes up.

### Rule 6. Recording is not preventing

Deliberately stated, because it is the thing most easily assumed. A record makes a fault findable
and countable. What stops it coming back is a test that goes red when it does, which is CWE-390's
own third mitigation.

Every fault that reaches this record and is then fixed gets a test in the same commit. No
exceptions: the fix without the test is half the work.

---

## What was rejected, and why

**OpenTelemetry with a collector and a tracing backend.** It is the standard, and it is the right
answer for a system with services that call each other. This is one Next.js app with one database
and no customers yet. The correlation OTel provides by trace id, we get from the run id, because
almost everything expensive happens inside a run. Revisit when there is a second service or a
support queue.

**A hosted error tracker.** Solves rule 5 properly and out of the box. Not yet: it is a third party
receiving our errors, and our errors can contain page text read off small businesses' websites.
That needs the redaction rule proven first, and a processor agreement, neither of which exists.

**Auditing all 28 `catch` blocks before anything else.** This was my own first proposal and it is
the wrong order. There is no evidence which of them ever fire. Put the record in first, then fix
what actually happens. Writing 28 decisions on suspicion is how the last expensive mistake started.

---

## How to check this is still true

Four of these are enforced by `web/test/error-handling.test.ts`. The fifth is a convention, and is
listed separately because a rule that claims to be checked and is not is worse than one that admits
it.

**Enforced by a test:**

1. Every `catch` in `app`, `lib` and `tools` either binds the error or carries a comment saying why
   it is silent.
2. No error record includes an email address, an IP address or a token, and the `Problem` type has
   no field that could carry one.
3. `app/error.tsx`, `app/global-error.tsx` and `instrumentation.ts` exist and reach the recorder.
4. Every client component that catches an error either reports it or explains every catch, the
   retry loop gives up and says so, and signing in is not a silent failure.

**A convention, enforced by nobody:**

5. Every fault fixed after being recorded has a test committed alongside it.

This was written as a check in the first version of this file. It cannot honestly be one: no script
can tell whether a given test covers a given fault. Saying so is the point. If it is ever worth
enforcing, the honest mechanism is a commit convention, not a grep.

---

## Where we actually are

Scored against the sources above rather than against an impression, so this answers the same way
twice. Last checked 2026-09-17.

### CWE-390, 3 of 3

| Requirement | |
|---|---|
| Properly handle each exception | Done, check 1 |
| Fix and retry, tell and continue, or tell and stop | Done, plus our declared fourth case |
| Subject the product to extensive testing | 698 tests |

### Next.js, 4 of 4

| Requirement | |
|---|---|
| `error.tsx` | Done |
| `global-error.tsx` | Done |
| `onRequestError` | Done |
| Event handlers and async work caught by hand and reported | Done, check 4 |

### OWASP, what to log: 3 of 12

The weakest column, and the one to be honest about. Their list is a **security logging** standard
and ours is an **error tracker**, so scoring one against the other is partly unfair. But these are
on their list for a reason.

| Category | |
|---|---|
| Application errors and system events | Done |
| Authentication failures | Done, client side. A failed sign-in is recorded |
| Authentication successes | Not done |
| Authorisation failures | **Done.** Asking for a business or a run that is not yours is recorded as refused |
| Session management failures | Not done |
| Input and output validation failures | Not done |
| Network connection failures | Done for our own server; not for pages we read |
| Administrative actions | None exist yet |
| Access to sensitive data, encryption key use | Not done |
| Data import and export, file uploads | Not done |
| Deserialization failures | Not done |
| Consent and opt-in | Not done |
| Suspicious business logic | Not done |

### OWASP, never log: full

Enforced by check 2 and by `lib/privacy/redact.ts` on the shared path in `messageOf`, so no caller
has to remember. No stack trace is kept: a stack carries absolute paths, and self-hosted that is
somebody's home directory.

### OWASP, required fields: 14 of 17

| | Have | Missing |
|---|---|---|
| When | Timestamp, first and last seen, **interaction id** | Event timestamp |
| Where | Page or route, code location, **release** | Application name, server address |
| Who | Workspace, run | Device id. IP and identity omitted **on purpose**, see rule 3 |
| What | Event type, severity, description, reason, affected object, **action**, **outcome** | — |

### OpenTelemetry: partial, deliberately

Run id and workspace id correlate everything inside a run, which is where almost all the cost and
nearly all the failure lives. An interaction id, one per page load, now ties a browser report to
the server error from the same visit. No trace or span id, and no propagation into the model calls.
See the rejected list.

### Proven, and how

Not "the tests pass". These were done against the running product and the real table:

| Claim | How it was shown |
|---|---|
| A real crash is recorded | A page made to throw, loaded for real, HTTP 500, one row with the right route and message |
| A repeat counts rather than duplicating | The same page loaded twice: one row, `seen` 2, `last_seen` after `first_seen` |
| A page that would not load is `stopped`, not `fault` | The same crash after a server restart: `severity` stopped, `action` "render /preview/selftest", `outcome` failed |
| Nothing personal survives | An email arrived as `[email]`, a phone as `[phone]` |
| Two faults differing by a number are one | Two messages, one row |

Each selftest row was deleted afterwards, per `CLAUDE.md` 1.4.8.

**One thing to know for next time:** `instrumentation.ts` is loaded once at server start, so a
change to `onRequestError` does nothing until the dev server restarts. The first attempt at proving
this showed the old behaviour and looked like a failed fix.

### What that adds up to

Solid on capturing application errors, which is what this was for, and now covering the one
security event that had a real consequence. Still thin on the rest of OWASP's list, which is a
security logging standard this was never trying to be.

Next, in order: retention, since the table grows forever; authentication successes; and a way to
mark something fixed, since `fixed_at` exists and nothing sets it.

---

## Changelog

- **2026-09-17** Written. Prompted by a React crash that reached a customer's screen with no record
  of it anywhere, and by the same question getting two different answers from me an hour apart.
- **2026-09-17** Implemented. `public.problems` and `note_problem()`, `lib/problems.ts`,
  `app/error.tsx`, `app/global-error.tsx`, `instrumentation.ts`, `app/api/problem/route.ts`,
  `app/report.ts`, and the engine records a thrown run. The four checks are enforced by
  `web/test/error-handling.test.ts`, the recorder by `web/test/problems.test.ts`. Verified against
  the real database: two messages differing only by a number landed as one fault with `seen: 2`,
  an email arrived as `[email]` and a phone as `[phone]`.
- **2026-09-17** Finished off. The run loop gave up retrying our own server in silence: it now
  stops after three consecutive failures, records it and says so, which is the failure mode that
  had somebody watching a spinner for sixteen minutes. Sign-in reports. Severity and release added,
  the two field gaps from OWASP's list worth closing. Check 4 added for the browser, and check 5
  demoted from a check to a convention because no script can enforce it. The scorecard above is now
  part of this file so the question "is this good enough" is read rather than re-formed.
- **2026-09-17** One correction on the record. The CWE-390 check found a `catch` in
  `lib/research/robots.ts` where a pattern that would not compile counted as "this Disallow does
  not apply", so a rule we failed to understand would have read as consent. The fallback now goes
  with the direction of the rule, and both directions err towards not fetching. I first reported
  this as a live bug: it is not. Every regex metacharacter is escaped before the pattern is
  compiled, so the branch is unreachable with the current escaper, and the test says so rather than
  implying a hole was closed.
