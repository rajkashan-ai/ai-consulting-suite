-- Notes instead of a chosen service, and both of them optional.
--
-- The photo path asked the owner to pick one of their services from a list.
-- For a salon whose site lists twelve grades of the same cut that is twelve
-- long buttons and a decision nobody wants to make on a phone between clients,
-- and a list can be wrong: the photo may be of something the list does not
-- name at all.
--
-- So they write a few points instead, or they write nothing. A post nobody
-- could be bothered to configure is still worth more than no post, and with no
-- notes we work from the photo and their own pages, which is what every other
-- post in this product is written from anyway.

-- What they asked us to mention, tidied and capped, or null when they wrote
-- nothing. Never a claim we publish: the post written from it goes through the
-- same guards as every other post.
alter table public.content_made
  add column if not exists notes text;

-- `service` stays, nullable, because rows written before today have one and
-- deleting a column to tidy up is how a record of what we told somebody goes
-- missing. Nothing writes it any more.
alter table public.content_made
  drop constraint if exists content_made_photo_check;

alter table public.content_made
  add constraint content_made_photo_check
  check (
    (from_photo and path = 'asset' and photo_on is not null)
    or (not from_photo and photo_on is null and service is null and notes is null)
  );

comment on column public.content_made.notes is
  'What the owner asked us to mention, in their own words. Optional: a photo '
  'post with no notes is written from the photo and their own pages.';

comment on column public.content_made.service is
  'Superseded by notes on 2026-09-18. Kept for rows written before then; '
  'nothing writes it now.';
