# Getting this running

**To sign in and reach the workspace you need Supabase and nothing else.** Not
Google, not Vercel, not Anthropic. That is section 1, and it is about ten
minutes. Everything after it can wait.

Nothing below asks you to send me a key. Put them in `.env.local` yourself.

## Two commands

If you have a Supabase account, this is the whole thing:

```
npx supabase login
npm run setup
```

The first opens your browser and asks you to paste a token back. The second
makes the project, runs all the SQL, switches the sign-in email to a six digit
code, and writes `.env.local`. Then `npm run dev`.

**It never prints a key.** Everything it fetches goes straight into
`.env.local`, which is gitignored, so this output is safe to paste anywhere.

It cannot create your Supabase account or log you in. Both need your password,
and a password is not something to hand to a script somebody else wrote. If you
would rather do it by hand, section 1 below is the same thing clicked.

Both your addresses are already on the list and already marked staff, so you
are let straight in and can point the tools at any website.

---

## 1. Supabase

Create a project. Pick **London** or **Ireland** as the region: our customers
are UK businesses and so is their data.

Then open the SQL editor and run these two files, in order:

- `supabase/001_schema.sql` — the tables, and the isolation
- `supabase/002_seed.sql` — who is let in, and who is staff

Run each one once. There is no second step and nothing to come back for. An
earlier version of the seed had to be run twice and reported "UPDATE 0" the
first time, which looks like a failure and is not. Staff is now set on the
invitation and copied across when you first sign in.

From Project Settings, API, copy three values:

| What the dashboard calls it | Also called | Goes in |
|---|---|---|
| Project URL | | `NEXT_PUBLIC_SUPABASE_URL` |
| Publishable key | `anon` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Secret key | `service_role` | `SUPABASE_SERVICE_ROLE_KEY` |

**One template change.** In Authentication, Email Templates, open *Magic Link*
and replace the link with `{{ .Token }}`. That turns the email into a six digit
code instead of a link. We want the code: mail scanners in company inboxes
follow links before a person reads them, which spends a one-time login and
produces a failure nobody can explain.

## 2. Google

Create a Google Cloud project. Set up an OAuth consent screen as **External**.

Ask for `email`, `profile` and `openid` only. Those are non-sensitive, which
means you skip Google's app verification review completely. Ask for anything
more and you are into a review that takes weeks.

Then create an **OAuth client ID**, type **Web application**, with this
authorised redirect URI, putting your own project reference in:

```
https://<your-project-ref>.supabase.co/auth/v1/callback
```

That gives you a Client ID and a Client Secret. Google charges nothing for any
of this.

## 3. Back in Supabase

Authentication, Providers, Google. Turn it on, paste in the Client ID and
Client Secret. That is the Google button working.

## 4. Anthropic

An API key from the console. Use a key that nothing else uses, so this
product's spend can be read on its own.

---

## Run it

```bash
cp .env.local.example .env.local   # then fill in the four values
npm install
npm run dev
```

Open http://localhost:3000. You should be sent to the sign-in screen.

Sign in with Google. Then go back to Supabase and run the `is_staff` line from
`002_seed.sql`, so you can point the tools at any company rather than only your
own.

## Put it on the internet

Vercel, connect the repository, set the root directory to `web`. Add the same
four environment variables. The keys without `NEXT_PUBLIC_` must be added as
server variables and never as build-time public ones.

Then add your Vercel URL to two places, or Google sign-in will refuse:

- Supabase, Authentication, URL Configuration: site URL and redirect URLs
- Google Cloud, your OAuth client: authorised JavaScript origins

---

## Adding a tester

```sql
insert into public.allowed_emails (email, note)
values ('them@example.com', 'who they are');
```

Nobody else can create an account. Removing the row stops a new sign-in but
does not end a session someone already holds, so also delete their user under
Authentication if you mean it immediately.

## A site asks us to stop

```sql
insert into public.blocked_domains (domain, reason)
values ('example.co.uk', 'emailed 15 Sep');
```

Takes effect within a minute, everywhere, for everyone.
