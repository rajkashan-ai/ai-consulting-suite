-- =============================================================================
-- suite-2026-09-17-problems.sql
--
-- Where a fault goes, so nobody has to guess afterwards.
--
-- On 2026-09-16 a React crash reached a customer's screen and the only record
-- of it anywhere was a screenshot. It stopped the run it was rendering, and
-- reloading started a new one from zero: 434,000 tokens became 508,000, and
-- nothing in the product said why.
--
-- The decision and the standards it rests on are in ERROR-HANDLING.md. The two
-- things this table exists to do, that a log line cannot:
--
--   1. Say WHO and WHERE, per OWASP's when/where/who/what, without ever holding
--      an email, an IP or a token.
--   2. Say whether it is STILL HAPPENING. One record says a fault happened
--      once. A count with a first-seen and a last-seen is what answers "is it
--      still going on", and that needs the same fault to land on the same row.
--
-- Safe to run twice.
-- =============================================================================

create table if not exists public.problems (
  -- A stable key for "the same fault": the message shape and the code location,
  -- never the time, the ids or any number in the text. Same fault, same row,
  -- count goes up. Built in lib/problems.ts, not here, because the rule for
  -- what counts as "the same" will change and a generated column would freeze
  -- whichever version was current the day it was written.
  fingerprint   text primary key,

  -- What. Redacted before it ever arrives.
  message       text not null,
  -- Next.js gives a digest for an error React has already processed, and warns
  -- the error instance may not be the original. The digest identifies the real
  -- one. Null for anything we caught ourselves.
  digest        text,

  -- Where. A route path, or a tool and stage. Never a full stack trace: those
  -- carry file paths, and on a self-hosted install that is somebody's home
  -- directory.
  where_at      text not null,
  -- 'render', 'route', 'action', 'run', 'client'. What kind of place it was.
  kind          text not null default 'run',

  -- Who, as much as we are willing to know. A workspace is a business, not a
  -- person, and it is enough to reproduce anything. No email, no IP, no user
  -- id: see ERROR-HANDLING.md rule 3 and lib/privacy/redact.ts.
  workspace_id  uuid references public.workspaces(id) on delete set null,
  run_id        uuid references public.runs(id) on delete set null,

  -- Is it still happening. The whole reason this is a table and not a log line.
  seen          integer not null default 1,
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),

  -- Set when somebody has dealt with it. Kept rather than deleted, so a fault
  -- that comes back after a fix is visibly a return and not a new arrival.
  fixed_at      timestamptz
);

create index if not exists problems_recent
  on public.problems (last_seen desc)
  where fixed_at is null;

alter table public.problems enable row level security;

-- Nobody reads this through the browser. It is written by the server with the
-- admin client and read by us, so there is no select policy at all: default
-- deny, per CLAUDE.md house rule 1. A policy added later is a deliberate act.
comment on table public.problems is
  'One row per distinct fault, with a count. Written server side only. Holds no '
  'email, IP or token: see ERROR-HANDLING.md rule 3.';

comment on column public.problems.seen is
  'How many times this exact fault has happened. A single record says it '
  'happened once; this is what answers whether it is still happening.';

-- One fault, one row, count up. Done in the database so two requests failing at
-- the same moment cannot race each other into two rows or a lost increment.
create or replace function public.note_problem(
  p_fingerprint text,
  p_message     text,
  p_where       text,
  p_kind        text,
  p_digest      text default null,
  p_workspace   uuid default null,
  p_run         uuid default null
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.problems (
    fingerprint, message, where_at, kind, digest, workspace_id, run_id
  )
  values (
    p_fingerprint, p_message, p_where, p_kind, p_digest, p_workspace, p_run
  )
  on conflict (fingerprint) do update set
    seen      = public.problems.seen + 1,
    last_seen = now(),
    -- A fault that returns after being marked fixed is news. Clearing this is
    -- what makes it show up again rather than hiding under an old decision.
    fixed_at  = null,
    -- Keep the newest context: the last time it happened is the one somebody
    -- is most likely to be looking into.
    digest       = coalesce(p_digest, public.problems.digest),
    workspace_id = coalesce(p_workspace, public.problems.workspace_id),
    run_id       = coalesce(p_run, public.problems.run_id);
$$;
