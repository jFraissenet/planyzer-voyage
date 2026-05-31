-- ============================================================================
-- Tutorial infrastructure:
--   - flags on users + events
--   - 10 demo bots seeded (Léa Demo, Marc Demo, …) – never log in
--   - search_users excludes bots from normal lookup
--   - RPCs: start_birthday_tutorial, end_tutorial_demo,
--           cleanup_my_orphan_demos, mark_tutorial_seen, get_demo_bots
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Schema additions
-- ---------------------------------------------------------------------------
alter table public.users
  add column tutorial_seen_at timestamptz,
  add column is_demo_bot boolean not null default false;

alter table public.events
  add column event_is_demo boolean not null default false;

create index events_is_demo_idx on public.events(event_is_demo)
  where event_is_demo = true;

-- ---------------------------------------------------------------------------
-- Exclude bots from the user search used by the invitation flow
-- ---------------------------------------------------------------------------
create or replace function public.search_users(p_query text)
returns table (
  user_id uuid,
  full_name text,
  avatar_url text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    u.id as user_id,
    u.full_name,
    u.avatar_url
  from public.users u
  where
    p_query is not null
    and length(trim(p_query)) >= 2
    and u.full_name is not null
    and u.full_name ilike '%' || trim(p_query) || '%'
    and u.is_demo_bot = false
  order by u.full_name
  limit 20;
$$;

grant execute on function public.search_users(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Mark the tutorial as seen for the caller (idempotent)
-- ---------------------------------------------------------------------------
create or replace function public.mark_tutorial_seen()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.users
  set tutorial_seen_at = now()
  where id = auth.uid() and tutorial_seen_at is null;
$$;

grant execute on function public.mark_tutorial_seen() to authenticated;

-- ---------------------------------------------------------------------------
-- Seed 10 demo bots. We insert directly into auth.users; the existing
-- handle_new_user trigger populates public.users. Then we flip is_demo_bot.
-- Idempotent via "on conflict do nothing" on the email.
-- ---------------------------------------------------------------------------
do $$
declare
  v_bot record;
  v_bots constant text[][] := array[
    array['lea',     'Léa Demo'],
    array['marc',    'Marc Demo'],
    array['sophie',  'Sophie Demo'],
    array['tom',     'Tom Demo'],
    array['julie',   'Julie Demo'],
    array['antoine', 'Antoine Demo'],
    array['clara',   'Clara Demo'],
    array['hugo',    'Hugo Demo'],
    array['emma',    'Emma Demo'],
    array['lucas',   'Lucas Demo']
  ];
  v_handle text;
  v_full_name text;
  v_email text;
  v_id uuid;
begin
  for i in 1 .. array_length(v_bots, 1) loop
    v_handle := v_bots[i][1];
    v_full_name := v_bots[i][2];
    v_email := v_handle || '@planyzer.demo';

    if exists (select 1 from auth.users where email = v_email) then
      -- Already seeded, just make sure the flag + name are right.
      update public.users
      set is_demo_bot = true,
          full_name = v_full_name
      where email = v_email;
      continue;
    end if;

    v_id := gen_random_uuid();
    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_user_meta_data,
      raw_app_meta_data,
      created_at,
      updated_at
    ) values (
      v_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_email,
      '',                        -- empty hash → no login possible
      now(),
      jsonb_build_object('full_name', v_full_name),
      jsonb_build_object('provider', 'demo', 'providers', array['demo']),
      now(),
      now()
    );

    -- The handle_new_user trigger populated public.users; flag as bot.
    update public.users set is_demo_bot = true where id = v_id;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Helper to expose the bot ids in a stable order (for the tuto orchestrator)
-- ---------------------------------------------------------------------------
create or replace function public.get_demo_bots()
returns table (
  user_id uuid,
  full_name text,
  avatar_url text
)
language sql
security definer
stable
set search_path = ''
as $$
  select u.id, u.full_name, u.avatar_url
  from public.users u
  where u.is_demo_bot = true
  order by u.full_name;
$$;

grant execute on function public.get_demo_bots() to authenticated;

-- ---------------------------------------------------------------------------
-- Create a fully populated demo event for the "Anniversaire" scenario.
-- Returns the IDs the frontend needs to target halos.
-- ---------------------------------------------------------------------------
create or replace function public.start_birthday_tutorial()
returns table (
  event_id uuid,
  teams_tool_id uuid,
  apero_team_id uuid,
  proposals_tool_id uuid,
  comptoir_proposal_id uuid,
  money_tool_id uuid,
  cake_expense_id uuid,
  sophie_user_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_event uuid;
  v_teams uuid;
  v_apero uuid;
  v_deco uuid;
  v_props uuid;
  v_comptoir uuid;
  v_money uuid;
  v_cake uuid;
  v_lea uuid;
  v_marc uuid;
  v_sophie uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select id into v_lea    from public.users where email = 'lea@planyzer.demo';
  select id into v_marc   from public.users where email = 'marc@planyzer.demo';
  select id into v_sophie from public.users where email = 'sophie@planyzer.demo';

  -- 1) Event
  insert into public.events (
    event_title,
    event_description,
    event_start_date,
    event_end_date,
    event_creator_id,
    event_is_demo
  ) values (
    '🎂 Anniv Léa (démo)',
    'Événement de démonstration créé par le tuto.',
    now() + interval '2 weeks',
    now() + interval '2 weeks' + interval '6 hours',
    v_user,
    true
  )
  returning event_id into v_event;

  -- Creator as admin participant + bots as members
  insert into public.event_participants (
    event_participant_event_id,
    event_participant_user_id,
    event_participant_role_code,
    event_participant_invited_by
  ) values
    (v_event, v_user,   'admin',  v_user),
    (v_event, v_lea,    'member', v_user),
    (v_event, v_marc,   'member', v_user),
    (v_event, v_sophie, 'member', v_user)
  on conflict do nothing;

  -- 2) Teams tool
  insert into public.event_tools (
    event_tool_event_id, event_tool_type_code, event_tool_name,
    event_tool_visibility, event_tool_created_by
  ) values (v_event, 'teams', 'Équipes', 'all', v_user)
  returning event_tool_id into v_teams;

  insert into public.event_tool_team (
    event_tool_team_event_tool_id, event_tool_team_name,
    event_tool_team_color, event_tool_team_author_id
  ) values
    (v_teams, 'Apéro', '#F59E0B', v_user)
  returning event_tool_team_id into v_apero;

  insert into public.event_tool_team (
    event_tool_team_event_tool_id, event_tool_team_name,
    event_tool_team_color, event_tool_team_author_id
  ) values
    (v_teams, 'Déco', '#A855F7', v_user)
  returning event_tool_team_id into v_deco;

  insert into public.event_tool_team_member (
    event_tool_team_member_team_id, event_tool_team_member_user_id
  ) values
    (v_apero, v_user),
    (v_apero, v_lea),
    (v_deco,  v_marc),
    (v_deco,  v_sophie);

  -- 3) Proposals tool
  insert into public.event_tools (
    event_tool_event_id, event_tool_type_code, event_tool_name,
    event_tool_visibility, event_tool_created_by
  ) values (v_event, 'proposals', 'Lieu de l''anniv', 'all', v_user)
  returning event_tool_id into v_props;

  insert into public.event_tool_proposals (
    event_tool_proposal_event_tool_id, event_tool_proposal_title,
    event_tool_proposal_description, event_tool_proposal_author_id
  ) values
    (v_props, 'Bar Le Comptoir', 'Cocktails + tapas, ambiance cosy', v_user)
  returning event_tool_proposal_id into v_comptoir;

  insert into public.event_tool_proposals (
    event_tool_proposal_event_tool_id, event_tool_proposal_title,
    event_tool_proposal_description, event_tool_proposal_author_id
  ) values
    (v_props, 'Chez Marc', 'On reste à la maison, plus tranquille', v_marc),
    (v_props, 'Resto La Terrasse', 'Grand resto avec terrasse', v_lea);

  -- 4) Money tool
  insert into public.event_tools (
    event_tool_event_id, event_tool_type_code, event_tool_name,
    event_tool_visibility, event_tool_created_by
  ) values (v_event, 'money', 'Comptes', 'all', v_user)
  returning event_tool_id into v_money;

  insert into public.event_tool_expenses (
    event_tool_expense_event_tool_id, event_tool_expense_label,
    event_tool_expense_amount, event_tool_expense_paid_by,
    event_tool_expense_creator_id
  ) values
    (v_money, 'Gâteau', 32.00, v_user, v_user)
  returning event_tool_expense_id into v_cake;

  insert into public.event_tool_expenses (
    event_tool_expense_event_tool_id, event_tool_expense_label,
    event_tool_expense_amount, event_tool_expense_paid_by,
    event_tool_expense_creator_id
  ) values
    (v_money, 'Bouteilles', 48.50, v_sophie, v_user);

  -- Equal split across all participants for both expenses
  insert into public.event_tool_expense_shares (
    event_tool_expense_share_expense_id,
    event_tool_expense_share_user_id,
    event_tool_expense_share_mode
  )
  select e.event_tool_expense_id, p.event_participant_user_id, 'equal'
  from public.event_tool_expenses e
  join public.event_participants p
    on p.event_participant_event_id = v_event
  where e.event_tool_expense_event_tool_id = v_money;

  return query select
    v_event, v_teams, v_apero, v_props, v_comptoir, v_money, v_cake, v_sophie;
end;
$$;

grant execute on function public.start_birthday_tutorial() to authenticated;

-- ---------------------------------------------------------------------------
-- End a tutorial: delete the demo event (cascade handles tools, teams,
-- proposals, expenses…). Only the creator can call, and only on demo events.
-- ---------------------------------------------------------------------------
create or replace function public.end_tutorial_demo(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_creator uuid;
  v_is_demo boolean;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select event_creator_id, event_is_demo into v_creator, v_is_demo
  from public.events where event_id = p_event_id;
  if v_creator is null then return; end if;
  if not v_is_demo then raise exception 'not_a_demo_event'; end if;
  if v_creator is distinct from v_user then raise exception 'not_authorized'; end if;
  delete from public.events where event_id = p_event_id;
end;
$$;

grant execute on function public.end_tutorial_demo(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Safety net: when the user opens the app, clean their orphan demo events
-- (in case a previous tuto was force-quit).
-- ---------------------------------------------------------------------------
create or replace function public.cleanup_my_orphan_demos()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_count int := 0;
begin
  if v_user is null then return 0; end if;
  with deleted as (
    delete from public.events
    where event_creator_id = v_user
      and event_is_demo = true
    returning 1
  )
  select count(*) into v_count from deleted;
  return v_count;
end;
$$;

grant execute on function public.cleanup_my_orphan_demos() to authenticated;
