-- =============================================================================
-- 009_migrations.sql  --  which of these files have actually been run.
--
-- WHY
-- On 15 September a dry run failed on its first line: four SQL files had never
-- been applied, so everything built that afternoon was sitting in a repository
-- against a database that did not have the columns. Nothing said so. The only
-- symptom was a column-not-found error deep in a script.
--
-- A file existing is not the same as a file having been run, and the difference
-- was invisible.
-- =============================================================================

create table if not exists public.schema_migrations (
  filename   text primary key,
  applied_at timestamptz not null default now(),
  -- Every file here is written to be safe to run twice, so a changed file is
  -- re-applied rather than skipped. This is how we notice it changed.
  sha        text
);

alter table public.schema_migrations enable row level security;
-- No policy. Only the secret key and the CLI touch it, and nobody signed in has
-- any reason to read which migrations exist.
