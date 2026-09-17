-- =============================================================================
-- 007_three_questions.sql  --  the three things only the owner knows.
--
-- Run after 001_schema.sql.
--
-- Everything else about a business is read off their website. These three
-- cannot be, and each one fixes something that was otherwise a guess.
-- =============================================================================

alter table public.workspaces
  /**
   * Where their customers are. One of: nearby, town, county, uk, world.
   *
   * Proximity is the heaviest factor in choosing which competitors matter, and
   * its meaning changes completely by trade. A barber competes within half a
   * mile. A solicitor competes across three counties. A marketing agency
   * competes with anyone in the country. Without this they were all weighted
   * identically, which is right for none of them.
   */
  add column if not exists reach text,

  /**
   * Where new customers find them. Several can be true.
   *
   * Evidence for the trade's playbook from somebody who actually knows. A
   * barber saying "Booksy" is a better signal about where barbers are listed
   * than any number of searches, and it is free.
   */
  add column if not exists found_via jsonb not null default '[]'::jsonb,

  /**
   * One competitor they already know about, and whether we found the right one.
   *
   * It guarantees a result: if discovery fails completely we still have a real
   * name to research. It is also the fastest test of whether our search works
   * at all, because a competitor the owner can see and we cannot find means
   * something is broken and we know within seconds rather than after a run.
   */
  add column if not exists known_competitor text,
  add column if not exists known_competitor_url text,
  add column if not exists known_competitor_confirmed boolean;

comment on column public.workspaces.reach is
  'nearby | town | county | uk | world. Sets how much proximity counts when ranking competitors.';
comment on column public.workspaces.found_via is
  'Where new customers find them. Feeds the trade playbook, from someone who knows.';
