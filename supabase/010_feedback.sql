-- =============================================================================
-- 010_feedback.sql  --  what was wrong with a specific claim.
--
-- Run after 004_runs.sql.
--
-- WHY IT IS ATTACHED TO A CLAIM AND NOT TO A PAGE
-- "The battlecard was a bit weak" cannot be acted on. "This price is wrong" on
-- a claim that names its source can: we can go and look at that page, see what
-- it says, and turn the difference into a test.
--
-- WHY IT IS KEPT FOR EVER
-- TESTING.md: a customer complaint becomes an eval case, and no test is ever
-- deleted to go green. A mark is the raw material for one. Fixing something
-- without writing the case down means fixing it again in a month.
-- =============================================================================

create table if not exists public.feedback (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id  uuid references public.documents(id) on delete set null,
  run_id       uuid references public.runs(id) on delete set null,

  -- Which thing on the page. "claim:HINCES:pricing:0", "action:2", "winning:1".
  -- Enough to find it again in the stored document without storing it twice.
  target       text not null,
  -- The exact words that were on screen, because the document can be rebuilt
  -- next week and the mark has to still mean something.
  said         text,

  -- wrong | weak | useless | missing
  -- Four, from a list, because a count is actionable and a mood is not.
  -- UI/CLAUDE.md 6a settled this on 14 September.
  verdict      text not null,
  note         text,

  created_at   timestamptz not null default now(),
  -- Set when this has been turned into a test or an eval case. Until then it is
  -- an open complaint, and the point is to be able to list those.
  became_a_test_at timestamptz
);

create index if not exists feedback_open_idx
  on public.feedback (created_at desc)
  where became_a_test_at is null;

alter table public.feedback enable row level security;

drop policy if exists "your own feedback" on public.feedback;
create policy "your own feedback"
  on public.feedback for all
  using (public.owns_workspace(workspace_id))
  with check (public.owns_workspace(workspace_id));

comment on table public.feedback is
  'A mark against one claim or action. Raw material for an eval case, kept for ever: TESTING.md says a complaint becomes a case and no test is deleted to go green.';
