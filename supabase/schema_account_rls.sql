begin;

-- Profiles mapped 1:1 to Supabase Auth users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Core app tables
create table if not exists public.exercises (
  id bigint generated always as identity primary key,
  uuid text unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'weight' check (type in ('weight','cardio','bodyweight','bodyweight_timer')),
  muscle_group text,
  photo_uri text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  sync_status text not null default 'local' check (sync_status in ('local','dirty','synced','failed')),
  last_synced_at timestamptz
);

create table if not exists public.workouts (
  id bigint generated always as identity primary key,
  uuid text unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  start_time timestamptz,
  end_time timestamptz,
  status text not null default 'finished' check (status in ('in_progress','finished')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  sync_status text not null default 'local' check (sync_status in ('local','dirty','synced','failed')),
  last_synced_at timestamptz
);

create table if not exists public.sets (
  id bigint generated always as identity primary key,
  uuid text unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id bigint not null references public.workouts(id) on delete cascade,
  exercise_id bigint not null references public.exercises(id) on delete cascade,
  weight double precision,
  reps integer,
  distance double precision,
  duration double precision,
  rpe integer,
  position integer not null default 0,
  sub_sets text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  sync_status text not null default 'local' check (sync_status in ('local','dirty','synced','failed')),
  last_synced_at timestamptz
);

create table if not exists public.deletion_tombstones (
  id bigint generated always as identity primary key,
  entity_type text not null check (entity_type in ('exercise','workout','set')),
  entity_uuid text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  deleted_at timestamptz not null default now(),
  sync_status text not null default 'dirty' check (sync_status in ('local','dirty','synced','failed'))
);

create table if not exists public.sync_queue (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_uuid text not null,
  operation text not null,
  payload jsonb,
  attempts integer not null default 0,
  last_error text,
  queued_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_profiles_username on public.profiles(username);
create index if not exists idx_exercises_user_pos_name on public.exercises(user_id, position, name);
create index if not exists idx_exercises_uuid on public.exercises(uuid);
create index if not exists idx_workouts_user_date_status on public.workouts(user_id, date, status);
create index if not exists idx_workouts_uuid on public.workouts(uuid);
create index if not exists idx_sets_user_workout_position on public.sets(user_id, workout_id, position);
create index if not exists idx_sets_user_exercise on public.sets(user_id, exercise_id);
create index if not exists idx_sets_uuid on public.sets(uuid);
create index if not exists idx_tombstones_user_status on public.deletion_tombstones(user_id, sync_status, deleted_at);
create index if not exists idx_tombstones_entity on public.deletion_tombstones(entity_type, entity_uuid);
create index if not exists idx_sync_queue_queued_at on public.sync_queue(queued_at);
create index if not exists idx_sync_queue_entity on public.sync_queue(entity_type, entity_uuid);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_exercises_updated_at on public.exercises;
create trigger trg_exercises_updated_at before update on public.exercises
for each row execute function public.set_updated_at();

drop trigger if exists trg_workouts_updated_at on public.workouts;
create trigger trg_workouts_updated_at before update on public.workouts
for each row execute function public.set_updated_at();

drop trigger if exists trg_sets_updated_at on public.sets;
create trigger trg_sets_updated_at before update on public.sets
for each row execute function public.set_updated_at();

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.sets enable row level security;
alter table public.deletion_tombstones enable row level security;
alter table public.sync_queue enable row level security;

-- Profiles: user can only read/write own row
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

-- Exercises/workouts/sets: only own rows
drop policy if exists "exercises_own_all" on public.exercises;
create policy "exercises_own_all" on public.exercises
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "workouts_own_all" on public.workouts;
create policy "workouts_own_all" on public.workouts
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "sets_own_all" on public.sets;
create policy "sets_own_all" on public.sets
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "tombstones_own_all" on public.deletion_tombstones;
create policy "tombstones_own_all" on public.deletion_tombstones
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "sync_queue_read_none_client" on public.sync_queue;
create policy "sync_queue_read_none_client" on public.sync_queue
for select using (false);

drop policy if exists "sync_queue_write_none_client" on public.sync_queue;
create policy "sync_queue_write_none_client" on public.sync_queue
for all using (false) with check (false);

commit;
