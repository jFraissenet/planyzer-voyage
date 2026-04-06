-- Table users publique, liée à auth.users
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  provider text not null default 'email',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.users enable row level security;

create policy "Users can read own row"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own row"
  on public.users for update
  using (auth.uid() = id);

-- Trigger auto-upsert à chaque login/signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (id, email, full_name, avatar_url, provider)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce(new.raw_app_meta_data ->> 'provider', 'email')
  )
  on conflict (id) do update set
    email      = excluded.email,
    full_name  = coalesce(excluded.full_name, public.users.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url),
    provider   = excluded.provider,
    updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute function public.handle_new_user();
