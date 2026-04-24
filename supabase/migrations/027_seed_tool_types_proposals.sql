insert into public.tool_types (tool_type_code, tool_type_icon, tool_type_default_visibility)
values
  ('proposals', 'https://sfpfvgurujeaezfwzyij.supabase.co/storage/v1/object/public/tool-icons/proposals.svg', 'all')
on conflict (tool_type_code) do update set
  tool_type_icon = excluded.tool_type_icon,
  tool_type_default_visibility = excluded.tool_type_default_visibility,
  tool_type_is_active = true;
