create table public.roles (
  role_code text primary key,
  role_created_at timestamptz not null default now()
);

insert into public.roles (role_code) values ('admin'), ('member'), ('visitor');

alter table public.roles enable row level security;

create policy "Authenticated users can read roles"
  on public.roles for select
  to authenticated
  using (true);
