-- Account-scoped onboarding flag.
--
-- Onboarding completion was previously stored device-local in AsyncStorage,
-- which meant it didn't survive a reinstall and didn't follow the account to a
-- new device (users could see onboarding more than once on the same account).
-- Persisting it on the profile makes it per-account: shown once, then never
-- again for that user. Guest / local-only sessions keep using the device flag.
--
-- The existing profiles RLS policies (profiles_select_own / profiles_insert_own
-- / profiles_update_own) already scope this column to auth.uid(), and the
-- client upserts the row, so no additional policy or trigger is required.

begin;

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

commit;
