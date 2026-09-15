-- =============================================================================
-- 004_runs.sql  --  a research run that survives a closed laptop.
--
-- Run after 001_schema.sql.
--
-- WHY A RUN HAS TO BE RESUMABLE
-- A Competitor Tracker run takes one to three minutes: a search, then twenty or
-- so pages read one at a time with a pause between, then the writing up. Two
-- things make that impossible to do inside one page request.
--
--   1. Hosting kills a request that takes minutes. It would fail at the same
--      point every time and look like a random fault.
--   2. Raj asked for it to survive a closed tab, and a run costs real money and
--      only happens once a week. Losing one to a closed laptop loses the week.
--
-- So a run is a row that remembers where it got to, and something advances it.
-- Whoever advances it does not matter: the open page pokes it so it is quick
-- while you watch, and a scheduled tick advances it when nobody is looking.
-- =============================================================================

-- The stage it reached. Ordered, and it only ever moves forwards.
--   searching   asking Claude who the competitors are
--   choosing    picking the five, keeping any the customer named
--   reading     fetching their pages, a few per tick
--   writing     turning what we read into a battlecard
--   checking    the agent's own guards, which can still refuse it
--   done        there is a document
--   failed      there is a reason, in words
alter table public.runs
  add column if not exists stage text not null default 'searching',
  -- Everything the next tick needs. The partial battlecard lives here while it
  -- is being built, so a run that stops halfway has lost nothing.
  add column if not exists state jsonb not null default '{}'::jsonb,
  -- What the customer is told is happening, in their units: "3 of 5 read".
  add column if not exists progress text,
  -- Set while a tick is working on it, so two ticks cannot both advance the
  -- same run and pay for the same page twice.
  add column if not exists leased_until timestamptz,
  add column if not exists document_id uuid references public.documents(id) on delete set null;

create index if not exists runs_unfinished_idx
  on public.runs (stage, started_at)
  where stage not in ('done', 'failed');


-- -----------------------------------------------------------------------------
-- CLAIMING A RUN TO WORK ON
--
-- The lease is the whole point. Without it the open page and the scheduled tick
-- both pick up the same run, both fetch the same twenty pages, and the bill is
-- double for one battlecard.
--
-- A lease expires, so a tick that dies mid-step does not strand the run for
-- ever. Ninety seconds is longer than any single step and short enough that a
-- crash costs one wait rather than an evening.
--
-- security definer because the scheduled tick is not a signed-in person. It
-- only ever returns rows it has just claimed, so it cannot be used to read
-- somebody's runs: every row it hands back it has already taken.
-- -----------------------------------------------------------------------------
create or replace function public.claim_run(run uuid)
returns table (id uuid, workspace_id uuid, tool text, stage text, state jsonb)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.runs r
     set leased_until = now() + interval '90 seconds'
   where r.id = run
     and r.stage not in ('done', 'failed')
     and (r.leased_until is null or r.leased_until < now())
  returning r.id, r.workspace_id, r.tool, r.stage, r.state;
end;
$$;

revoke all on function public.claim_run(uuid) from public;
grant execute on function public.claim_run(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- RUNS THAT NOBODY IS WATCHING
--
-- What the scheduled tick asks for. Anything unfinished, not currently leased,
-- and old enough that it is genuinely stuck rather than simply in progress.
--
-- Schedule it once pg_cron is enabled:
--   select cron.schedule('advance', '* * * * *',
--     $$ select net.http_post('https://<your app>/api/tick', '{}'::jsonb) $$);
--
-- Until that exists, a run only advances while a page is open, which is fine
-- for testing and not fine for a customer who closed their laptop.
-- -----------------------------------------------------------------------------
create or replace function public.stalled_runs(limit_to integer default 5)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.runs
   where stage not in ('done', 'failed')
     and (leased_until is null or leased_until < now())
     and started_at > now() - interval '1 hour'
   order by started_at
   limit limit_to;
$$;

revoke all on function public.stalled_runs(integer) from public;

comment on column public.runs.state is
  'Everything the next tick needs, including the partial battlecard. A run that stops halfway has lost nothing.';
comment on column public.runs.leased_until is
  'Held while a tick works on it, so two ticks cannot pay for the same pages twice.';
