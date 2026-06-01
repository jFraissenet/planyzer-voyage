-- ============================================================================
-- "Report a bug": users submit a short bug report (required title + optional
-- description). Reports are read by the maintainer directly in the Supabase
-- dashboard (service role bypasses RLS). Direct table access stays own-row
-- only; inserts go through a security-definer RPC that validates the title.
-- ============================================================================

create table public.bug_reports (
  bug_report_id uuid primary key default gen_random_uuid(),
  bug_report_user_id uuid references auth.users(id) on delete set null,
  bug_report_title text not null,
  bug_report_description text,
  bug_report_status text not null default 'open',
  bug_report_created_at timestamptz not null default now()
);

alter table public.bug_reports enable row level security;

-- Authors can read back their own reports (nothing else is exposed to clients).
create policy "Authors can read their own bug reports"
  on public.bug_reports for select
  using (bug_report_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPC: submit a bug report for the current user (title required, trimmed).
-- ---------------------------------------------------------------------------
create or replace function public.submit_bug_report(
  p_title text,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_id uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if v_title = '' then raise exception 'title_required'; end if;

  insert into public.bug_reports (
    bug_report_user_id,
    bug_report_title,
    bug_report_description
  )
  values (
    v_user,
    left(v_title, 200),
    nullif(btrim(coalesce(p_description, '')), '')
  )
  returning bug_report_id into v_id;

  return v_id;
end;
$$;

grant execute on function public.submit_bug_report(text, text) to authenticated;
