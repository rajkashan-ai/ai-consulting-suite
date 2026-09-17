-- =============================================================================
-- suite-2026-09-17-problem-context.sql
--
-- The last three fields from OWASP's when/where/who/what that are worth having,
-- and the reason the table could not answer two ordinary questions.
--
-- INTERACTION: a browser report and the server error from the same click landed
-- as two unrelated rows. "What happened on the server when this person's screen
-- broke" had no answer outside a run. OWASP calls this an interaction
-- identifier; OpenTelemetry calls it a trace id. Same idea, much smaller.
--
-- ACTION and OUTCOME: `where_at` says which route. It does not say what the
-- person was trying to do, or whether it worked. "Asked for a business that is
-- not theirs, refused" is a different row from "the page threw", and both used
-- to be "/workspace/[tool]".
--
-- Safe to run twice.
-- =============================================================================

alter table public.problems
  -- Shared by every report from one page load, so a click can be followed from
  -- the browser to the server. Null where we genuinely do not have one, which
  -- is more honest than inventing a value that correlates nothing.
  add column if not exists interaction text,
  -- What was being attempted, in our words: "open a business", "advance a run".
  add column if not exists action text,
  -- What happened to it: 'refused', 'failed', 'recovered'.
  add column if not exists outcome text;

comment on column public.problems.interaction is
  'Shared by every record from one page load, so a browser report and the '
  'server error it caused can be read together. Null when we have none.';

comment on column public.problems.action is
  'What the person was trying to do. where_at says which route; this says why '
  'they were on it.';

comment on column public.problems.outcome is
  'refused, failed or recovered. A refusal is an authorisation decision and is '
  'not the same thing as a crash, though both used to look identical here.';

create index if not exists problems_by_interaction
  on public.problems (interaction)
  where interaction is not null;

drop function if exists public.note_problem(text, text, text, text, text, text, text, uuid, uuid);

create or replace function public.note_problem(
  p_fingerprint  text,
  p_message      text,
  p_where        text,
  p_kind         text,
  p_severity     text default 'fault',
  p_release      text default null,
  p_digest       text default null,
  p_workspace    uuid default null,
  p_run          uuid default null,
  p_interaction  text default null,
  p_action       text default null,
  p_outcome      text default null
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.problems (
    fingerprint, message, where_at, kind, severity, release, digest,
    workspace_id, run_id, interaction, action, outcome
  )
  values (
    p_fingerprint, p_message, p_where, p_kind, p_severity, p_release, p_digest,
    p_workspace, p_run, p_interaction, p_action, p_outcome
  )
  on conflict (fingerprint) do update set
    seen      = public.problems.seen + 1,
    last_seen = now(),
    fixed_at  = null,
    severity  = excluded.severity,
    release      = coalesce(excluded.release, public.problems.release),
    digest       = coalesce(p_digest, public.problems.digest),
    workspace_id = coalesce(p_workspace, public.problems.workspace_id),
    run_id       = coalesce(p_run, public.problems.run_id),
    -- The most recent one, because that is the occurrence somebody is looking
    -- into. The older ones are counted, not kept: keeping every interaction id
    -- would make this a log, which is the thing it is deliberately not.
    interaction  = coalesce(p_interaction, public.problems.interaction),
    action       = coalesce(p_action, public.problems.action),
    outcome      = coalesce(p_outcome, public.problems.outcome);
$$;
