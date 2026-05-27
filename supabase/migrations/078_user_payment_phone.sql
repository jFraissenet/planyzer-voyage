-- Add phone to the payment-info bundle so co-participants can use Wero /
-- PayLib / instant-transfer apps that key off a phone number.
alter table public.users add column phone text;

drop function if exists public.get_user_payment_info(uuid);

create or replace function public.get_user_payment_info(p_user_id uuid)
returns table (
  iban text,
  bic text,
  account_holder text,
  phone text,
  full_name text
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_allowed boolean;
begin
  if v_caller is null then return; end if;

  if v_caller = p_user_id then
    return query
      select u.iban, u.bic, u.account_holder, u.phone, u.full_name
      from public.users u where u.id = p_user_id;
    return;
  end if;

  select exists (
    select 1
    from public.event_participants a
    join public.event_participants b
      on b.event_participant_event_id = a.event_participant_event_id
    where a.event_participant_user_id = v_caller
      and b.event_participant_user_id = p_user_id
  ) into v_allowed;

  if not v_allowed then return; end if;

  return query
    select u.iban, u.bic, u.account_holder, u.phone, u.full_name
    from public.users u where u.id = p_user_id;
end;
$$;

grant execute on function public.get_user_payment_info(uuid) to authenticated;

create or replace function public.update_my_payment_info(
  p_iban text,
  p_bic text,
  p_account_holder text,
  p_phone text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  update public.users set
    iban = nullif(btrim(coalesce(p_iban, '')), ''),
    bic = nullif(btrim(coalesce(p_bic, '')), ''),
    account_holder = nullif(btrim(coalesce(p_account_holder, '')), ''),
    phone = nullif(btrim(coalesce(p_phone, '')), ''),
    updated_at = now()
  where id = v_user;
end;
$$;

grant execute on function public.update_my_payment_info(text, text, text, text) to authenticated;

-- Drop the previous 3-arg signature so PostgREST doesn't keep two overloads
drop function if exists public.update_my_payment_info(text, text, text);
