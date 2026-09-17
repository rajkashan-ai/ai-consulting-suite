-- A run left overnight was never picked up again.
--
-- stalled_runs only returned runs started within the last hour, so the
-- scheduled tick, whose entire job is "close the tab and come back", quietly
-- abandoned anything older. Close a laptop at six and the run was dead by
-- seven, with nothing saying so.
--
-- The hour was a guard against a tick restarting something ancient, and that
-- job now belongs somewhere better: the watchdog measures time actually spent
-- working, so a run that has genuinely gone on too long is stopped on its own
-- merits rather than by the clock on the wall. A day is generous enough for a
-- closed laptop and short enough that last week's run stays dead.

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
     and started_at > now() - interval '24 hours'
   order by started_at
   limit limit_to;
$$;

revoke all on function public.stalled_runs(integer) from public;
grant execute on function public.stalled_runs(integer) to authenticated;

comment on function public.stalled_runs(integer) is
  'Runs nobody is advancing: unfinished, unleased, and started within a day. '
  'The day is for a closed laptop. How long a run may actually work is the '
  'watchdog''s job, not this one''s.';
