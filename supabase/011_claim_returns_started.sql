-- The watchdog needs to know how long a run has been going, and the only thing
-- that reads a run before each step is claim_run. It did not hand back
-- started_at, so the deadline had nothing to measure against.
--
-- Dropped and recreated rather than replaced: Postgres refuses to change a
-- function's return type with "create or replace", and the error it gives names
-- the type rather than the cause, which is a bad afternoon.

drop function if exists public.claim_run(uuid);

create function public.claim_run(run uuid)
returns table (
  id uuid,
  workspace_id uuid,
  tool text,
  stage text,
  state jsonb,
  started_at timestamptz
)
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
  returning r.id, r.workspace_id, r.tool, r.stage, r.state, r.started_at;
end;
$$;

revoke all on function public.claim_run(uuid) from public;
grant execute on function public.claim_run(uuid) to authenticated;

comment on function public.claim_run(uuid) is
  'Takes a 90 second lease on a run and hands back what the engine needs to '
  'advance it, including started_at so the watchdog can enforce a deadline.';
