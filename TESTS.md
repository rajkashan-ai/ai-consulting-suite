# Tests

`npm test` runs them. The pre-commit hook runs them too, and stops the commit if
any fail. To skip it deliberately: `git commit --no-verify`.

## Why the hook exists

On 15 September a commit went in with a failing test. The test was right and the
code was wrong, and it was noticed only because the next command happened to
print the failure. Nothing was checking.

Tests that run when somebody remembers are a habit, not a safety net, and habits
go first on the day you are in a hurry.

## What is covered

| | |
|---|---|
| robots.txt matching | The rules with legal weight. Longest match, Allow beating Disallow on a tie, our group winning over `*` |
| One request at a time per site | The rule owed to a small business on shared hosting. Proven, including that different sites do not wait for each other |
| Redaction | Emails, UK phone numbers in every shape, postcodes, handles, names |
| Prompt injection | A competitor's page is data, never an instruction |
| Turning a page into words | Prices stay on separate lines, navigation goes, script never reaches the model |
| Routing | Where you land signed in and signed out, and that a redirect cannot leave the site |
| Ranking | That near beats far, that a blank scores zero, and that a national business ignores distance |
| Categories | That "barber", "barbershop" and "barbers" are one playbook |
| The playbook | That it says when it has only seen one town |
| The three questions | That they change what they are supposed to change |
| Environment settings | That no file reads them through a variable, and no browser file touches the secret key |
| SQL | That all seven files parse against the real Postgres grammar |

## What is not covered, and why

**The engine and the stages end to end.** They need a database and an Anthropic
key, so they are integration tests rather than unit tests. Today they are
covered by running the thing and watching. That is not good enough and it is the
biggest gap.

**Anything that needs the model to answer well.** Whether a battlecard is any
good is an eval, not a test. The dividing line is in TESTING.md: whether a fault
*can* happen is a test, how *often* it happens is an eval.

## The database

`npm run db` applies any SQL file that has never been run, or has changed since
it was. `npm run db -- --check` says what is outstanding and changes nothing.
The pre-commit hook runs the check and warns, but does not block: the database
may simply be unreachable.

It goes through the Supabase CLI on the linked project, so it needs
`npx supabase login` once and no database password ever.

Two things were wrong with the first version and both are worth remembering.

**`create policy` has no "if not exists" in Postgres**, so every file with a
policy in it failed on a second run. They now drop first.

**The Supabase CLI exits 0 when the SQL fails.** It prints the error as JSON on
stdout and reports success. Anything trusting the exit code says "applied" for a
statement the database refused, which is exactly what my first few apply
messages did. The runner reads the answer now, not the exit code.

## A pattern worth knowing

Three times now, a pure function has been untestable because it sat in a file
that also imported a database client or a `server-only` guard. Each time the fix
was to move it out: `robots.ts`, `queue.ts`, `text.ts`.

Each time, moving it immediately found a real bug that had been invisible.
`queue.ts` was the clearest: the fetcher stripped `www.` when naming a domain
and then queued on the raw hostname, so one site had two queues and could be
fetched twice at once.

If something cannot be tested, that is usually the finding.
