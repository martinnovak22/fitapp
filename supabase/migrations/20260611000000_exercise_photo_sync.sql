-- Exercise photo sync (issue #49).
--
-- exercises.photo_uri held device-local file paths that were meaningless on
-- any other device; it is dropped outright (fresh start — the paths were never
-- usable remotely). Photos now sync as bytes in the private exercise-photos
-- bucket at {user_id}/{photo_key}, and rows sync only the photo_key.

alter table public.exercises add column if not exists photo_key text;
alter table public.exercises drop column if exists photo_uri;

insert into storage.buckets (id, name, public)
values ('exercise-photos', 'exercise-photos', false)
on conflict (id) do nothing;

-- Each user may only touch objects inside their own {user_id}/ folder.
drop policy if exists "Users manage own exercise photos" on storage.objects;
create policy "Users manage own exercise photos"
on storage.objects for all to authenticated
using (bucket_id = 'exercise-photos' and (storage.foldername(name))[1] = (select auth.uid()::text))
with check (bucket_id = 'exercise-photos' and (storage.foldername(name))[1] = (select auth.uid()::text));
