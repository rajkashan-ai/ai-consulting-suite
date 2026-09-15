-- Run after 001_schema.sql, with your own email in place of the placeholder.
-- This is the only thing standing between a public URL and a stranger's account.

insert into public.allowed_emails (email, note)
values ('rajkashan@gmail.com', 'Raj, High Intent Labs')
on conflict (email) do nothing;

-- Staff can point the tools at any company and hold more than one workspace.
-- Run this AFTER signing in once, because the profile row is made at first sign-in.
update public.profiles set is_staff = true where lower(email) = 'rajkashan@gmail.com';

-- To add a tester later:
--   insert into public.allowed_emails (email, note) values ('them@example.com', 'who they are');
-- To remove one, delete the row. That stops a new sign-in but does not end a
-- session they already have, so also delete their user in Authentication.
