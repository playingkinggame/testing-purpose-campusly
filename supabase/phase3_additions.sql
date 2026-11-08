-- Phase 3 additions. Safe to re-run.
-- Only new infrastructure is here: a private bucket for lost & found photos.
-- All tables/policies from phase 1 and 2 are unchanged.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'campus-photos',
  'campus-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "campus photos read own" on storage.objects;
drop policy if exists "campus photos read" on storage.objects;
-- Lost & found is a shared board, so any signed-in student may view the photos
-- (still private: no public link, only signed URLs for signed-in users).
create policy "campus photos read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'campus-photos');

drop policy if exists "campus photos upload own" on storage.objects;
create policy "campus photos upload own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'campus-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "campus photos delete own" on storage.objects;
create policy "campus photos delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'campus-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;

notify pgrst, 'reload schema';
