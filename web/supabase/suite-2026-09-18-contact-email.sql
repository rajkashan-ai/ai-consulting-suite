-- Where things we send should go.
--
-- Everybody who can sign in is on an approved list, so we always have the
-- address they authenticated with and we never ask for it cold. This column is
-- for the case where that is not where the business wants things: an owner
-- signs in as themselves and wants the posts going to the salon's shared inbox.
--
-- Null means "use the address they signed in with", which is the common case
-- and costs them nothing. It is not a second account and it is never used to
-- sign in: `auth.users` owns identity and this is a delivery address.

alter table public.workspaces
  add column if not exists contact_email text;

comment on column public.workspaces.contact_email is
  'Where to send things for this business. Null means the address the owner '
  'signed in with. Never an identity: auth.users owns that.';
