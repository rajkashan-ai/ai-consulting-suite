-- =============================================================================
-- 008_cost.sql  --  what a run actually cost, added up rather than overwritten.
--
-- Run after 004_runs.sql.
--
-- WHY
-- A run is advanced in steps, and each step wrote its own token count over the
-- last one. The final step does no model calls, so every finished run recorded
-- zero. The first real battlecard cost something and we have no idea what.
--
-- The page count was worse: it read run.state.pagesFetched, which nothing has
-- ever written, so it was always zero plus this step.
--
-- Added in the database rather than in the application, because the open page
-- and the scheduled tick can both advance a run. Reading a number, adding to it
-- and writing it back from two places loses one of them, and the number this
-- feeds is the fair use cap.
-- =============================================================================

create or replace function public.add_run_cost(
  run uuid,
  add_input integer,
  add_output integer,
  add_pages integer
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.runs
     set input_tokens  = input_tokens  + greatest(add_input, 0),
         output_tokens = output_tokens + greatest(add_output, 0),
         pages_fetched = pages_fetched + greatest(add_pages, 0)
   where id = run;
$$;

revoke all on function public.add_run_cost(uuid, integer, integer, integer) from public;
grant execute on function public.add_run_cost(uuid, integer, integer, integer) to authenticated;

comment on function public.add_run_cost is
  'Adds a step''s spend to a run. Added in the database because two ticks can advance the same run and a read-modify-write from two places loses one of them.';
