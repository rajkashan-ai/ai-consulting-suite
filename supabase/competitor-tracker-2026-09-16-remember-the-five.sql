-- =============================================================================
-- competitor-tracker-2026-09-16-remember-the-five.sql
--
-- Who a business competes with, remembered.
--
-- Every run rediscovered them from nothing. That is the most expensive and the
-- slowest part of a run, and it is also the part whose answer barely changes: a
-- salon's rivals are the same in December as in September. Their prices are
-- what move, and reading five known pages takes about five seconds.
--
-- So the set is stored once and reused, and a run that has it skips discovery
-- entirely. Rediscovering is then a thing somebody asks for, not a thing that
-- happens weekly by default.
--
-- Safe to run twice.
-- =============================================================================

create table if not exists public.competitors (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,

  -- As a customer would say it. The key we match on is the normalised form,
  -- worked out in code, because normalising is a rule that changes and a
  -- column would freeze whichever version was current the day it was written.
  name          text not null,

  -- A page that proves they exist, found when the name was checked. Never a
  -- page the model wrote: it is the url of a real search result.
  url           text,

  -- One line on why they compete. From the model, so it is context and not a
  -- claim, and it is never shown as a fact about the business.
  why           text,

  -- How this one got here: "asked" (a model named it, a search confirmed it),
  -- "crawled" (found on a listing page), or "owner" (the customer said so).
  -- An owner's name outranks everything and is never dropped.
  source        text not null default 'asked',

  -- When the set was last put together, so we can say how old it is rather
  -- than implying it is current.
  found_at      timestamptz not null default now(),

  -- Set when somebody says this is wrong. Kept rather than deleted, so the
  -- next discovery does not cheerfully find them again.
  rejected_at   timestamptz,

  unique (workspace_id, name)
);

create index if not exists competitors_by_workspace
  on public.competitors (workspace_id)
  where rejected_at is null;

alter table public.competitors enable row level security;

-- Same rule as everything else: you see your own workspace and nobody else's.
drop policy if exists "a workspace sees its own competitors" on public.competitors;
create policy "a workspace sees its own competitors"
  on public.competitors for select
  using (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

comment on table public.competitors is
  'The set a business is compared against. Stored so a weekly run reads five '
  'known pages in seconds instead of rediscovering them, which took 8 minutes '
  'and failed twice on 2026-09-16.';
