-- Mirror Google profile pictures into our own Supabase Storage bucket so the
-- app no longer hits the Google CDN (rate-limited, cookie-gated). avatar_url
-- becomes a stable URL we control; avatar_source_url tracks the original we
-- mirrored from so we can detect changes; avatar_synced_at lets us re-sync
-- periodically.

alter table public.users
  add column avatar_source_url text,
  add column avatar_synced_at timestamptz;

-- Backfill: keep the current Google URL as the source so the first sync knows
-- where to fetch from.
update public.users
set avatar_source_url = avatar_url
where avatar_source_url is null and avatar_url is not null;

-- Update the auth-trigger so avatar_url is no longer overwritten on every
-- session refresh. Once the app has mirrored an avatar, the row's avatar_url
-- points to our bucket; we don't want auth-state changes to clobber it. The
-- raw provider URL keeps flowing into avatar_source_url instead.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_avatar text := new.raw_user_meta_data ->> 'avatar_url';
begin
  insert into public.users (
    id, email, full_name, avatar_url, avatar_source_url, provider
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    v_avatar,
    v_avatar,
    coalesce(new.raw_app_meta_data ->> 'provider', 'email')
  )
  on conflict (id) do update set
    email             = excluded.email,
    full_name         = coalesce(excluded.full_name, public.users.full_name),
    avatar_source_url = coalesce(excluded.avatar_source_url, public.users.avatar_source_url),
    provider          = excluded.provider,
    updated_at        = now();
  return new;
end;
$$;

-- Public bucket for user avatars.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-avatars',
  'user-avatars',
  true,
  2097152,  -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS: anyone can read avatars; only the owner can write their own
-- (path is "<user_id>.<ext>").
create policy "Anyone can read user avatars"
  on storage.objects for select
  using (bucket_id = 'user-avatars');

create policy "Users can write their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'user-avatars'
    and split_part(name, '.', 1) = auth.uid()::text
  );

create policy "Users can replace their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'user-avatars'
    and split_part(name, '.', 1) = auth.uid()::text
  );

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'user-avatars'
    and split_part(name, '.', 1) = auth.uid()::text
  );
