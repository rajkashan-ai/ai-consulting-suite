-- =============================================================================
-- suite-2026-09-17-problem-severity.sql
--
-- Two fields OWASP's Logging Cheat Sheet asks for and the first version of this
-- table did not carry.
--
-- SEVERITY, because a failed clipboard copy and a run that died looked
-- identical in the table. With one row per fault and a count, the first thing
-- anybody wants is "which of these matters", and there was nothing to sort on.
--
-- RELEASE, because without it you cannot tell whether a fault survived a
-- deploy. A count going up after a fix is the question the whole table exists
-- to answer, and it cannot be answered if every occurrence looks the same.
--
-- Safe to run twice.
-- =============================================================================

alter table public.problems
  add column if not exists severity text not null default 'fault',
  -- The commit this was running. Set from an environment variable at build
  -- time; null on a local run, which is honest rather than a made-up value.
  add column if not exists release text;

comment on column public.problems.severity is
  '"stopped" when a customer lost the thing they came for, "fault" when '
  'something broke and they carried on, "noted" when we recovered and are only '
  'keeping score. Sorting by this is the first thing anybody does.';

comment on column public.problems.release is
  'The build this happened on. Without it, a count rising after a fix cannot be '
  'told from a count that never moved.';

-- Replaced rather than altered: the signature changes, and a function whose
-- arguments have moved is a new function however it is spelled.
drop function if exists public.note_problem(text, text, text, text, text, uuid, uuid);

create or replace function public.note_problem(
  p_fingerprint text,
  p_message     text,
  p_where       text,
  p_kind        text,
  p_severity    text default 'fault',
  p_release     text default null,
  p_digest      text default null,
  p_workspace   uuid default null,
  p_run         uuid default null
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.problems (
    fingerprint, message, where_at, kind, severity, release, digest,
    workspace_id, run_id
  )
  values (
    p_fingerprint, p_message, p_where, p_kind, p_severity, p_release, p_digest,
    p_workspace, p_run
  )
  on conflict (fingerprint) do update set
    seen      = public.problems.seen + 1,
    last_seen = now(),
    -- A fault that returns after being marked fixed is news. Clearing this is
    -- what makes it show up again rather than hiding under an old decision.
    fixed_at  = null,
    severity  = excluded.severity,
    -- The build it last happened on, which is the one that matters when asking
    -- whether a fix held.
    release      = coalesce(excluded.release, public.problems.release),
    digest       = coalesce(p_digest, public.problems.digest),
    workspace_id = coalesce(p_workspace, public.problems.workspace_id),
    run_id       = coalesce(p_run, public.problems.run_id);
$$;

create index if not exists problems_by_severity
  on public.problems (severity, last_seen desc)
  where fixed_at is null;
