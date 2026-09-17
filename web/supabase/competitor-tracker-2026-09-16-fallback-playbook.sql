-- =============================================================================
-- competitor-tracker-2026-09-16-fallback-playbook.sql
--
-- A trade nobody had run before started with nowhere to look, because the only
-- source of hosts was a playbook written by successful runs. No run, no
-- playbook; no playbook, no run. A bakery run died in 79 seconds having read no
-- listing at all.
--
-- The fix is in code (web/tools/competitor-tracker/where.ts). This adds the one
-- column it needs: the towns where every tier was tried and nothing was found.
-- Finding nothing is a fact about the trade, not a failure of the run, and the
-- next business in it should not pay to discover the same nothing.
--
-- One town settles nothing. Three is the bar, the same one `confidence` already
-- uses before it trusts a playbook.
--
-- Safe to run twice. Adds a column, changes no existing row's meaning.
-- =============================================================================

alter table public.playbooks
  add column if not exists nothing_in jsonb not null default '[]'::jsonb;

comment on column public.playbooks.nothing_in is
  'Towns where every tier was tried and no listing of this trade was found. '
  'Three distinct towns and the tool stops searching and says so, rather than '
  'selling the owner a fourth empty grid.';

-- An unmatched business is filed under "other:<its own words>", never under a
-- bare "other", which every unmatched business in the country would share.
-- This is a comment rather than a constraint because the key is built in code
-- and a check here would only restate it in a second place.
comment on column public.playbooks.trade is
  'A category id from tools/categories.ts, or "other:<slug>" for a business '
  'whose category did not match, keyed on what it called itself.';

-- `times_used` counts runs, and three runs can all be the same town, so
-- "used 3 times across different towns" was a claim the data could not support.
-- This is the thing that sentence was always describing.
alter table public.playbooks
  add column if not exists towns jsonb not null default '[]'::jsonb;

comment on column public.playbooks.towns is
  'Distinct towns this playbook has been used in. Three is the bar for calling '
  'it confirmed, and for promoting an "other:<slug>" row into a real trade.';
