-- Exercise taxonomy: Muscles and Equipment as fixed keys (ADR-0007).
--
-- Adds nullable columns only and rewrites no row. Exercises saved before the
-- taxonomy keep primary_muscle NULL; clients derive their Muscles from the
-- untouched legacy muscle_group text at read time. Older clients don't know
-- these columns, and their upserts leave them untouched.
--
-- DEPLOY ORDER: apply this before shipping a client that writes these columns.
-- Otherwise PostgREST rejects every Exercise push for the unknown columns.

begin;

alter table public.exercises add column if not exists primary_muscle text;
alter table public.exercises add column if not exists secondary_muscles jsonb not null default '[]'::jsonb;
alter table public.exercises add column if not exists equipment text;

alter table public.exercises drop constraint if exists exercises_secondary_muscles_is_array;
alter table public.exercises add constraint exercises_secondary_muscles_is_array
  check (jsonb_typeof(secondary_muscles) = 'array');

commit;
