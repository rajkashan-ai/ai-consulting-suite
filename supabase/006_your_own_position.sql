-- =============================================================================
-- 006_your_own_position.sql  --  what we know about you, so we can rank them.
--
-- Run after 001_schema.sql.
--
-- WHY
-- Choosing the five competitors was ranking on proximity and price overlap and
-- had neither. Proximity was handed the town, so every barber in Shrewsbury
-- matched "Shrewsbury" and the heaviest factor separated nobody. Price overlap
-- was handed null, because the prices we read at sign-up were shown on the
-- confirm screen and then thrown away.
--
-- Both came off their own website and both were already in our hands.
-- =============================================================================

alter table public.workspaces
  -- Street and district as printed on their own site. Never a full postcode:
  -- that locates a household and is personal data for a sole trader working
  -- from home. The outward code, "SY1", is a district and is kept.
  add column if not exists address text,
  -- Their headline or cheapest price, as a number. Someone charging near this
  -- competes for the same customer; at double they are selling to somebody else.
  add column if not exists headline_price numeric,
  -- What they sell, with prices where published. Read once, used by every tool.
  add column if not exists services jsonb not null default '[]'::jsonb;

comment on column public.workspaces.address is
  'Street and district only. Never a full postcode, which locates a household.';
comment on column public.workspaces.headline_price is
  'Used to judge which competitors are selling to the same customer.';
