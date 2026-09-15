-- =============================================================================
-- 001_schema.sql  --  the whole database, and the isolation that protects it.
--
-- READ THIS BEFORE CHANGING ANYTHING HERE.
-- Every business's competitor research, prices and documents sit in one
-- database. The thing that stops one customer reading another's rows is Row
-- Level Security, enforced by Postgres itself. It is not enforced by the
-- application code, on purpose: application code has bugs, and a bug in a
-- query should return nothing rather than return somebody else's business.
--
-- So: every table has RLS enabled, and every table has a policy. A table with
-- RLS enabled and no policy denies everything, which is the safe failure.
-- A table with no RLS at all is readable by anyone holding the publishable
-- key, which is in the browser. Never add a table without a policy.
--
-- Run this once, in the Supabase SQL editor.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. WHO IS ALLOWED IN
--
-- While we are testing, only emails in this table can create an account at all.
-- The check is a trigger on auth.users below, not a check in our application,
-- because an application check can be skipped by any route that forgets it.
--
-- RLS is enabled and there is no policy, deliberately. That means no signed-in
-- user can read this table, ever. It is a list of people's email addresses,
-- which is personal data, and nobody using the product has a reason to see it.
-- You manage it from the Supabase dashboard, which uses the secret key and
-- bypasses RLS.
-- -----------------------------------------------------------------------------
create table if not exists public.allowed_emails (
  email    text primary key,
  note     text,                                    -- who they are, so the list stays readable
  -- Staff is decided here, at invitation, not on the profile. A profile does
  -- not exist until the person first signs in, so setting it there meant
  -- running the seed twice and getting "UPDATE 0" the first time.
  staff    boolean not null default false,
  added_at timestamptz not null default now()
);

alter table public.allowed_emails enable row level security;


-- -----------------------------------------------------------------------------
-- 2. PEOPLE
--
-- auth.users is Supabase's and we do not touch it. This is our row per person.
--
-- is_staff is the test mode flag. It is the only difference between Raj's
-- account and a customer's: staff may own more than one workspace and may point
-- the tools at any website. A customer has exactly one business, which is why
-- UI/CLAUDE.md forbids a workspace switcher. Staff see one, customers do not.
--
-- It is a column here rather than something the browser can set, so a customer
-- cannot make themselves staff. Only the secret key can change it.
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  is_staff   boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "read your own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- No insert policy: rows are made by the trigger below, which runs as the
-- definer and does not need one. No update policy: nothing on a profile is the
-- user's to change yet, and is_staff must never be.


-- -----------------------------------------------------------------------------
-- 3. THE GATE
--
-- Fires when Supabase creates a user, whether they came through Google or an
-- email code. Two jobs: turn away anyone not on the list, and make their
-- profile row if they are on it.
--
-- Raising here aborts the whole signup inside one transaction, so a stranger
-- who is turned away leaves no auth.users row behind. That matters: an account
-- we did not want is still personal data we would be holding.
--
-- security definer so it can read allowed_emails despite that table's RLS.
-- The empty search_path is not decoration. Without it, someone who can create
-- objects could shadow a table name and have this function run their code with
-- the definer's rights, so every name below is written out in full.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Not called is_staff. A variable with the same name as the column it is
  -- inserted into is ambiguous inside plpgsql, and Postgres can refuse the
  -- whole statement. The first sign-in is a bad place to find that out.
  invited_as_staff boolean;
begin
  select a.staff into invited_as_staff
  from public.allowed_emails a
  where lower(a.email) = lower(new.email);

  -- Not on the list at all, as opposed to on it and not staff.
  if not found then
    raise exception 'not_invited' using errcode = '42501';
  end if;

  insert into public.profiles (id, email, is_staff)
  values (new.id, new.email, coalesce(invited_as_staff, false))
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- -----------------------------------------------------------------------------
-- 4. A BUSINESS
--
-- One row is one business the tools run against. A customer owns exactly one.
-- Staff own one per company they are testing, which is how "point it at any
-- website" works without changing what a customer sees.
--
-- website is what we ask for at sign-up and the only thing we ask for. Every
-- other column here is something we worked out by reading that website, and
-- confirmed_at is the moment the owner agreed we got it right. Null means we
-- have guessed and they have not looked yet, so nothing should be presented as
-- fact until it is set.
-- -----------------------------------------------------------------------------
create table if not exists public.workspaces (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  website      text,
  name         text,
  trade        text,          -- "barber", "plumber". Decides where we even look
  town         text,
  one_liner    text,
  confirmed_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists workspaces_owner_idx on public.workspaces(owner_id);

alter table public.workspaces enable row level security;

create policy "your own businesses"
  on public.workspaces for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- `for all` with both using and with check covers select, insert, update and
-- delete in one policy. with check is the half people forget: without it a user
-- can update a row they own and set owner_id to somebody else, which hands
-- their data away.


-- -----------------------------------------------------------------------------
-- 5. EVERYTHING A TOOL PRODUCES
--
-- One row per finished thing: a battlecard, a month of posts, a quote.
-- Keyed to a workspace, never to a user, so the isolation question is always
-- the same question and is answered in exactly one place (the helper below).
-- -----------------------------------------------------------------------------
create table if not exists public.documents (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  tool         text not null,          -- folder name in Agents/, so there is one name to search
  title        text,
  body         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists documents_workspace_idx on public.documents(workspace_id, tool, created_at desc);

alter table public.documents enable row level security;


-- -----------------------------------------------------------------------------
-- 6. WHERE EVERY FACT CAME FROM
--
-- CLAUDE.md 1.5 rule 7: every stored fact carries its URL and the date it was
-- fetched. This is that rule as a table, so a fact with no source cannot be
-- stored, and a takedown request can be answered by deleting a domain.
--
-- We keep a summary, never the page. Rule 5: copyright applies, and the UK kept
-- the database right after Brexit.
-- -----------------------------------------------------------------------------
create table if not exists public.sources (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  url          text not null,
  domain       text not null,          -- so a takedown is one delete, not a search
  fetched_at   timestamptz not null default now(),
  summary      text,                   -- our words. Never the page's
  robots_ok    boolean not null,       -- what robots.txt said when we asked
  status       integer                 -- what the server actually answered
);

create index if not exists sources_workspace_idx on public.sources(workspace_id, fetched_at desc);
create index if not exists sources_domain_idx on public.sources(domain);

alter table public.sources enable row level security;


-- -----------------------------------------------------------------------------
-- 7. EVERY RUN, AND WHAT IT COST
--
-- The fair-use cap has never had a number because we have never measured a run.
-- This is the measurement. Written from the first day so that after a week of
-- real use the number comes from data rather than a guess.
--
-- It also carries the weekly cadence: competitor research runs fresh once every
-- seven days, and this table is what "when did it last run" reads.
-- -----------------------------------------------------------------------------
create table if not exists public.runs (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  tool          text not null,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  ok            boolean,
  pages_fetched integer not null default 0,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  error         text
);

create index if not exists runs_workspace_idx on public.runs(workspace_id, tool, started_at desc);

alter table public.runs enable row level security;


-- -----------------------------------------------------------------------------
-- 8. THE ISOLATION, WRITTEN ONCE
--
-- Three tables hang off a workspace and all three ask the same question: does
-- this workspace belong to whoever is asking? Written once as a function so
-- there is one place to get it right and one place to test.
--
-- stable lets the planner cache it within a statement, so this is not a
-- subquery per row.
-- -----------------------------------------------------------------------------
create or replace function public.owns_workspace(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = ws and w.owner_id = auth.uid()
  );
$$;

create policy "documents in your own business"
  on public.documents for all
  using (public.owns_workspace(workspace_id))
  with check (public.owns_workspace(workspace_id));

create policy "sources in your own business"
  on public.sources for all
  using (public.owns_workspace(workspace_id))
  with check (public.owns_workspace(workspace_id));

create policy "runs in your own business"
  on public.runs for all
  using (public.owns_workspace(workspace_id))
  with check (public.owns_workspace(workspace_id));


-- -----------------------------------------------------------------------------
-- 9. A DOMAIN WE HAVE BEEN ASKED TO LEAVE ALONE
--
-- CLAUDE.md 1.5 rule 8: honour any takedown the same day, and keep a way to
-- block a domain permanently. This is that way. It is global rather than per
-- customer, because a request to stop reading a site applies to all of us.
--
-- No RLS policy, same as the allowlist: only the secret key writes it, and the
-- fetcher reads it with the secret key on the server.
-- -----------------------------------------------------------------------------
create table if not exists public.blocked_domains (
  domain     text primary key,
  reason     text,
  blocked_at timestamptz not null default now()
);

alter table public.blocked_domains enable row level security;
