-- ============================================================================
-- Let any authenticated user browse all bug reports (so people can check for
-- duplicates before reporting). Exposed through a security-definer RPC that
-- joins the reporter's name/avatar; the table's own-row SELECT policy stays
-- in place for direct access.
-- ============================================================================

create or replace function public.get_bug_reports()
returns table (
  bug_report_id uuid,
  title text,
  description text,
  status text,
  created_at timestamptz,
  reporter_id uuid,
  reporter_name text,
  reporter_avatar_url text
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if auth.uid() is null then return; end if;

  return query
    select
      br.bug_report_id,
      br.bug_report_title,
      br.bug_report_description,
      br.bug_report_status,
      br.bug_report_created_at,
      br.bug_report_user_id,
      u.full_name,
      u.avatar_url
    from public.bug_reports br
    left join public.users u on u.id = br.bug_report_user_id
    order by br.bug_report_created_at desc;
end;
$$;

grant execute on function public.get_bug_reports() to authenticated;
