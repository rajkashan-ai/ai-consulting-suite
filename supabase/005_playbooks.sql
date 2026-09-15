-- =============================================================================
-- 005_playbooks.sql  --  what we have learned about researching a trade.
--
-- Run after 001_schema.sql.
--
-- WHY THIS IS SHARED AND NOT PER CUSTOMER
-- Where barbers list is a fact about barbers, not about one barber. The first
-- barber we research pays for working it out; every barber after that gets it
-- for nothing. That is the template library Raj asked for on 14 September,
-- built from use rather than written in advance.
--
-- WHY IT IS BUILT FROM EVIDENCE AND NOT FROM A LIST SOMEBODY WROTE
-- A hand-written list of "barbers are on Booksy, plumbers are on Checkatrade"
-- is a guess that ages badly and is wrong for trades nobody thought about. This
-- is built by running the searches and recording which platforms actually came
-- back, with the urls and the date. When a platform dies or a new one arrives,
-- the next rebuild notices and a hand-written list never would.
-- =============================================================================

create table if not exists public.playbooks (
  -- "barber", "plumber", "landscaper". Lower case, as the trade is stored.
  trade         text primary key,

  -- Platforms that actually listed businesses of this trade, most useful first.
  -- Each carries the url pattern that worked and how many businesses it named,
  -- so a platform that returns two is not treated like one that returns seventy.
  platforms     jsonb not null default '[]'::jsonb,

  -- What this trade tends to publish: prices, reviews, opening hours. Drives
  -- what the research bothers looking for, and what a blank honestly means.
  publishes     jsonb not null default '[]'::jsonb,

  -- Tried and not worth trying again: refused us, wrong trade, nothing on it.
  -- Saved so the next run does not spend a page on it. CLAUDE.md 1.5 rule 4
  -- means every page costs a pause, so not fetching is real time saved.
  dead_ends     jsonb not null default '[]'::jsonb,

  -- How it was worked out. Every entry above traces back to one of these.
  evidence      jsonb not null default '[]'::jsonb,

  -- How many times this has been used. A playbook built from one town is worth
  -- less than one confirmed across six, and this is how we know which we have.
  times_used    integer not null default 0,
  built_from    text,          -- the town it was first worked out in
  built_at      timestamptz not null default now(),
  rechecked_at  timestamptz
);

alter table public.playbooks enable row level security;

-- Readable by anyone signed in, because it is knowledge about a trade and
-- contains nothing about any customer. Written only by the secret key, so one
-- customer's run cannot poison what every other customer relies on.
create policy "anyone signed in may read a playbook"
  on public.playbooks for select
  to authenticated
  using (true);

comment on table public.playbooks is
  'What we learned about researching one trade. No personal data, no customer data. Shared, because where barbers list is a fact about barbers.';
comment on column public.playbooks.dead_ends is
  'Places not worth trying again. Every page costs a pause, so not fetching is time saved.';
