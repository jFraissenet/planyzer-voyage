-- ============================================================================
-- Store optional bank info on the user profile (IBAN + BIC + account holder
-- name) so co-participants of the same event can grab it for SEPA transfers.
-- Direct table read stays own-row only; cross-user access is mediated by a
-- security-definer RPC that checks co-participation.
-- ============================================================================

alter table public.users
  add column iban text,
  add column bic text,
  add column account_holder text;

-- ---------------------------------------------------------------------------
-- RPC: return the payment info of another user, only when the caller and
-- the target share at least one event.
-- ---------------------------------------------------------------------------
create or replace function public.get_user_payment_info(p_user_id uuid)
returns table (
  iban text,
  bic text,
  account_holder text,
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
      select u.iban, u.bic, u.account_holder, u.full_name
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
    select u.iban, u.bic, u.account_holder, u.full_name
    from public.users u where u.id = p_user_id;
end;
$$;

grant execute on function public.get_user_payment_info(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: update the caller's payment info (whitespace trimmed, empty -> null)
-- ---------------------------------------------------------------------------
create or replace function public.update_my_payment_info(
  p_iban text,
  p_bic text,
  p_account_holder text
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
    updated_at = now()
  where id = v_user;
end;
$$;

grant execute on function public.update_my_payment_info(text, text, text) to authenticated;
