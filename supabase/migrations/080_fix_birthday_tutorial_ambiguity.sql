-- The RETURNS TABLE OUT parameters of start_birthday_tutorial (event_id,
-- teams_tool_id, …) collided with column names of the underlying tables,
-- yielding "column reference X is ambiguous" at runtime. Recreate the
-- function with #variable_conflict use_column so any plain `event_id`
-- in queries resolves to the table column.

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
#variable_conflict use_column
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
  returning events.event_id into v_event;

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

  insert into public.event_tools (
    event_tool_event_id, event_tool_type_code, event_tool_name,
    event_tool_visibility, event_tool_created_by
  ) values (v_event, 'teams', 'Équipes', 'all', v_user)
  returning event_tools.event_tool_id into v_teams;

  insert into public.event_tool_team (
    event_tool_team_event_tool_id, event_tool_team_name,
    event_tool_team_color, event_tool_team_author_id
  ) values
    (v_teams, 'Apéro', '#F59E0B', v_user)
  returning event_tool_team.event_tool_team_id into v_apero;

  insert into public.event_tool_team (
    event_tool_team_event_tool_id, event_tool_team_name,
    event_tool_team_color, event_tool_team_author_id
  ) values
    (v_teams, 'Déco', '#A855F7', v_user)
  returning event_tool_team.event_tool_team_id into v_deco;

  insert into public.event_tool_team_member (
    event_tool_team_member_team_id, event_tool_team_member_user_id
  ) values
    (v_apero, v_user),
    (v_apero, v_lea),
    (v_deco,  v_marc),
    (v_deco,  v_sophie);

  insert into public.event_tools (
    event_tool_event_id, event_tool_type_code, event_tool_name,
    event_tool_visibility, event_tool_created_by
  ) values (v_event, 'proposals', 'Lieu de l''anniv', 'all', v_user)
  returning event_tools.event_tool_id into v_props;

  insert into public.event_tool_proposals (
    event_tool_proposal_event_tool_id, event_tool_proposal_title,
    event_tool_proposal_description, event_tool_proposal_author_id
  ) values
    (v_props, 'Bar Le Comptoir', 'Cocktails + tapas, ambiance cosy', v_user)
  returning event_tool_proposals.event_tool_proposal_id into v_comptoir;

  insert into public.event_tool_proposals (
    event_tool_proposal_event_tool_id, event_tool_proposal_title,
    event_tool_proposal_description, event_tool_proposal_author_id
  ) values
    (v_props, 'Chez Marc', 'On reste à la maison, plus tranquille', v_marc),
    (v_props, 'Resto La Terrasse', 'Grand resto avec terrasse', v_lea);

  insert into public.event_tools (
    event_tool_event_id, event_tool_type_code, event_tool_name,
    event_tool_visibility, event_tool_created_by
  ) values (v_event, 'money', 'Comptes', 'all', v_user)
  returning event_tools.event_tool_id into v_money;

  insert into public.event_tool_expenses (
    event_tool_expense_event_tool_id, event_tool_expense_label,
    event_tool_expense_amount, event_tool_expense_paid_by,
    event_tool_expense_creator_id
  ) values
    (v_money, 'Gâteau', 32.00, v_user, v_user)
  returning event_tool_expenses.event_tool_expense_id into v_cake;

  insert into public.event_tool_expenses (
    event_tool_expense_event_tool_id, event_tool_expense_label,
    event_tool_expense_amount, event_tool_expense_paid_by,
    event_tool_expense_creator_id
  ) values
    (v_money, 'Bouteilles', 48.50, v_sophie, v_user);

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
