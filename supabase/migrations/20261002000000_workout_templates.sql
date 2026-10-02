-- Workout Templates and Planned Workouts (ADR-0006).
--
-- A Workout Template is a named list of Exercises. Membership is a jsonb array
-- of exercise uuids rather than a junction table, so the row syncs like any
-- other entity under last-writer-wins. A Workout records the Template it was
-- started from in template_uuid. Existing Workouts stay NULL (Unplanned), so
-- this migration only adds things and touches no existing row.
--
-- DEPLOY ORDER: apply this before shipping a client that syncs Templates.
-- The client tolerates a missing workout_templates table on pull and omits a
-- NULL template_uuid on push, so Unplanned Workouts keep syncing. But every
-- Template push and every Planned Workout push is rejected and parked as
-- 'blocked' (their Sets too, after 5 missing-parent attempts) until the migration lands and the user taps "Try again".

begin;

create table if not exists public.workout_templates (
  id bigint generated always as identity primary key,
  uuid text unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  exercise_uuids jsonb not null default '[]'::jsonb check (jsonb_typeof(exercise_uuids) = 'array'),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  sync_status text not null default 'local' check (sync_status in ('local','dirty','synced','failed')),
  last_synced_at timestamptz
);

create index if not exists idx_workout_templates_user_pos_name on public.workout_templates(user_id, position, name);
create index if not exists idx_workout_templates_uuid on public.workout_templates(uuid);
-- Pulls filter by user and order by updated_at / deleted_at.
create index if not exists idx_workout_templates_user_updated on public.workout_templates(user_id, updated_at);

drop trigger if exists trg_workout_templates_updated_at on public.workout_templates;
create trigger trg_workout_templates_updated_at before update on public.workout_templates
for each row execute function public.set_updated_at();

alter table public.workout_templates enable row level security;

drop policy if exists "workout_templates_own_all" on public.workout_templates;
create policy "workout_templates_own_all" on public.workout_templates
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.workouts add column if not exists template_uuid text;
create index if not exists idx_workouts_user_template on public.workouts(user_id, template_uuid);

commit;
