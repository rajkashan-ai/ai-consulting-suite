# Building a tool

Read this before writing one. It is short on purpose.

## What the workspace already does, so you do not

Signing in. Who the customer is. Which business is open. Reading pages off the
web legally and politely. Storing what came back with its address and the date.
Measuring what the run cost. Drawing the result.

You write one function. It is handed a business and hands back a finished thing.

## Turning a tool on

1. Open `registry.ts` and find your tool.
2. Write `run`.
3. Set `built: true`.

Nothing else changes. The navigation, the page, the address and the styling all
already exist.

```ts
{
  slug: "competitor-tracker",
  name: "Competitor Tracker",
  does: "Who you are up against, what they charge, and what to do about it.",
  built: true,
  run: async (business, ctx) => {
    ctx.progress("Looking for competitors");
    const page = await ctx.read("https://booksy.com/...");
    ...
    return { title: "Battlecard", sections: [...] };
  },
}
```

## The three rules that are not negotiable

**1. You cannot reach the web except through `ctx.read`.** No `fetch`, no
library that fetches. `ctx.read` obeys robots.txt, sends no cookies so it can
only ever see what a stranger sees, waits between requests to the same site, and
honours the blocked domain list. That is CLAUDE.md 1.5, and routing every read
through one function is what makes it impossible to skip by accident.

`ctx.read` never throws. A refusal comes back as `ok: false` with a note in
plain English, because "they publish no prices" is a finding, not a failure.

**2. Nothing is invented.** Every number, name, price and date comes from a page
you read, and carries its `source`. If you cannot find something, say so with a
`nothing` section. A blank that explains itself is worth more than a plausible
guess, and the person reading it owns the business and will catch you.

**3. No named individuals from reviews, ever.** Themes and counts only. Run any
quote through `safeQuote` in `lib/privacy/redact.ts`, which drops it rather than
cleans it if anything personal is in there. Under UK GDPR "it was public" is not
a lawful basis. See `DATA.md`.

## What you hand back

Sections, not HTML. That way a tool never has to know the stylesheet, and a
design change does not mean editing six tools.

- `prose` — a heading and a paragraph
- `list` — items, each optionally with a note, a tone and a source
- `table` — columns and rows, same per cell
- `nothing` — a heading and why there is nothing. Use it. It is the honest one.

`tone` is `good`, `bad`, `warn` or `info`. It is never the only signal: always
write the word too, because a screen read by somebody who cannot tell red from
green has to say the same thing.

## Asking the model

`ctx.think` counts its own tokens into the run, which is how the fair use cap
will eventually get a real number. Pass a `shape` when you want structured data
back rather than prose. Pass `hard: true` only where the synthesis is genuinely
hard, because it costs more.

## Before you say it is done

`npm test`. Then add your own: a bug becomes a test before it is fixed, and a
feature arrives with its criteria as tests. See `TESTING.md` in the folder
above.
