-- A run waiting for its owner is not a stalled run.
--
-- The scheduled tick asks stalled_runs for three unfinished runs a minute and
-- advances each by one step. The Competitor Tracker now parks at "picking"
-- while the owner says who they compete with, which can be two days, and that
-- run is unfinished and unleased the whole time.
--
-- Two things go wrong if it is returned:
--   1. It is ordered oldest first and capped at three, so a parked run holds a
--      slot every minute for two days and newer runs wait behind it.
--   2. Every one of those ticks reads the run and writes it back to say
--      nothing happened. Around three thousand writes to ask a question whose
--      answer only a person can change.
--
-- But a run they HAVE answered must be picked up, because that is what makes
-- "choose it and close the laptop" work. So the test is the answer, not the
-- stage: waiting with no choice is skipped, waiting with a choice is due.

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
     and not (stage = 'picking' and (state -> 'chosen') is null)
   order by started_at
   limit limit_to;
$$;

revoke all on function public.stalled_runs(integer) from public;
grant execute on function public.stalled_runs(integer) to authenticated;

comment on function public.stalled_runs(integer) is
  'Runs nobody is advancing: unfinished, unleased, started within a day, and '
  'not sitting unanswered on a question for their owner. A day is for a closed '
  'laptop. How long a run may work is the watchdog''s job, not this one''s.';
