-- =============================================================================
-- 003_privacy.sql  --  the rights that need code, and the limits that need a job.
--
-- Run after 001_schema.sql.
--
-- UK GDPR gives people rights that a privacy policy cannot deliver on its own.
-- Two of them have to be built: getting a copy of everything (Article 15 and
-- 20) and having it all deleted (Article 17). A third, storage limitation
-- (Article 5(1)(e)), is not a right anyone asks for. It is an obligation that
-- only exists if something actually deletes old data, so it is a scheduled job
-- rather than a sentence.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- DELETE EVERYTHING                                            Article 17
--
-- One delete does the whole job, because every table hangs off auth.users by a
-- chain of `on delete cascade`: user -> workspaces -> documents, sources, runs.
-- That is deliberate. Deletion written as a list of tables to empty is deletion
-- that silently misses the table somebody added last month.
--
-- security definer because a signed-in user has no rights in the auth schema,
-- and must not be given any. The function can only ever delete auth.uid(), so
-- it cannot be pointed at anybody else.
--
-- The allowlist row is left alone on purpose. It holds an email and no personal
-- data beyond that, it is how an invitation works, and deleting it would mean a
-- customer who closes their account can never be invited back. If someone asks
-- for that row to go too, delete it by hand: that is a separate request and it
-- should look like one.
-- -----------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in';
  end if;

  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;


-- -----------------------------------------------------------------------------
-- EVERYTHING WE HOLD ABOUT YOU                        Articles 15 and 20
--
-- One call, everything, as JSON. Article 20 asks for a structured, commonly
-- used, machine readable format, and JSON is all three.
--
-- Written as a function rather than six queries in the application so that
-- adding a table and forgetting to add it to the export is one change in one
-- place. It runs as the caller, so Row Level Security still decides what comes
-- back: an export cannot become a way to read somebody else's rows.
-- -----------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'account',    (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'businesses', coalesce((select jsonb_agg(to_jsonb(w)) from public.workspaces w), '[]'::jsonb),
    'documents',  coalesce((select jsonb_agg(to_jsonb(d)) from public.documents d), '[]'::jsonb),
    'sources',    coalesce((select jsonb_agg(to_jsonb(s)) from public.sources s), '[]'::jsonb),
    'runs',       coalesce((select jsonb_agg(to_jsonb(r)) from public.runs r), '[]'::jsonb)
  );
$$;

revoke all on function public.export_my_data() from public;
grant execute on function public.export_my_data() to authenticated;


-- -----------------------------------------------------------------------------
-- STORAGE LIMITATION                                      Article 5(1)(e)
--
-- Keep personal data no longer than you need it. "We might want it one day" is
-- not a period, so these are the periods, and they are enforced rather than
-- described.
--
--   sources   400 days. A year plus a margin, so a tool can always say what
--             changed since this time last year. After that the URL and the
--             date have no further job.
--   runs      400 days, same reason: it is how we measure cost over a year.
--
-- documents are the customer's own work and are kept until they delete them or
-- close the account. Deleting somebody's finished quote on a timer would be a
-- product that loses your work, which is worse than the risk it avoids.
--
-- SCHEDULING. This does nothing until something calls it. In Supabase, enable
-- the pg_cron extension and add:
--
--   select cron.schedule('purge', '0 3 * * *', $$ select public.purge_old_research() $$);
--
-- Until that line is run, retention is a promise and not a control. Check it
-- with: select * from cron.job;
-- -----------------------------------------------------------------------------
create or replace function public.purge_old_research(keep_days integer default 400)
returns table (deleted_sources bigint, deleted_runs bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  cutoff timestamptz := now() - make_interval(days => keep_days);
  s bigint;
  r bigint;
begin
  with gone as (delete from public.sources where fetched_at < cutoff returning 1)
  select count(*) into s from gone;

  with gone as (delete from public.runs where started_at < cutoff returning 1)
  select count(*) into r from gone;

  return query select s, r;
end;
$$;

revoke all on function public.purge_old_research(integer) from public;
-- Nobody signed in may run this. It is for the scheduler and for an admin.


-- -----------------------------------------------------------------------------
-- WHAT THE DATABASE ITSELF SAYS ABOUT ITS COLUMNS
--
-- Article 30 asks for a record of what we process. A record that lives in a
-- document goes stale the first time someone adds a column. These live on the
-- columns, so `\d+ public.profiles` in psql tells the truth for ever.
-- -----------------------------------------------------------------------------
comment on table  public.allowed_emails is
  'Personal data: email. Purpose: deciding who may create an account during testing. Basis: legitimate interests. Not readable by any signed-in user.';
comment on table  public.profiles is
  'Personal data: email. Purpose: identifying the account holder. Basis: contract.';
comment on column public.profiles.is_staff is
  'High Intent Labs staff only. Holds more than one workspace. Only the secret key can set it.';
comment on table  public.workspaces is
  'Business data, not personal data, except for a sole trader whose business is their own name. Basis: contract.';
comment on table  public.sources is
  'URLs of public pages we read, with the date. Summaries are our words, never copies. Basis: legitimate interests. Kept 400 days.';
comment on column public.sources.summary is
  'Our summary. Never the page text. Third party contact details are stripped before storage by lib/privacy/redact.ts.';
comment on table  public.documents is
  'What the tools produced, owned by the customer. Review themes only, never a named reviewer. Kept until they delete it.';
comment on table  public.runs is
  'What each run cost. No personal data. Kept 400 days.';
comment on table  public.blocked_domains is
  'Sites that asked us to stop reading them. Honoured within a minute, for everyone.';
