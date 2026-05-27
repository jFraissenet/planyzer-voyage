import { supabase } from "./supabase";

export type UserPaymentInfo = {
  iban: string | null;
  bic: string | null;
  account_holder: string | null;
  phone: string | null;
  full_name: string | null;
};

export async function getMyPaymentInfo(): Promise<UserPaymentInfo | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.rpc("get_user_payment_info", {
    p_user_id: user.id,
  });
  if (error) throw error;
  const rows = (data ?? []) as UserPaymentInfo[];
  return rows[0] ?? null;
}

export async function getUserPaymentInfo(
  userId: string,
): Promise<UserPaymentInfo | null> {
  const { data, error } = await supabase.rpc("get_user_payment_info", {
    p_user_id: userId,
  });
  if (error) throw error;
  const rows = (data ?? []) as UserPaymentInfo[];
  return rows[0] ?? null;
}

export async function updateMyPaymentInfo(input: {
  iban: string | null;
  bic: string | null;
  account_holder: string | null;
  phone: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc("update_my_payment_info", {
    p_iban: input.iban,
    p_bic: input.bic,
    p_account_holder: input.account_holder,
    p_phone: input.phone,
  });
  if (error) throw error;
}
