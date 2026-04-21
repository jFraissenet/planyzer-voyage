import { supabase } from "./supabase";

export type ShareMode = "equal" | "percent" | "amount";

export type ExpenseShare = {
  user_id: string;
  mode: ShareMode;
  value: number | null;
};

export type Expense = {
  expense_id: string;
  label: string;
  amount: number;
  currency: string;
  paid_by: string | null;
  paid_by_name: string | null;
  paid_by_avatar: string | null;
  creator_id: string | null;
  creator_name: string | null;
  creator_avatar: string | null;
  expense_order: number;
  created_at: string;
  updated_at: string;
  shares: ExpenseShare[];
};

export type EffectiveMember = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
};

async function requireUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

export async function getEffectiveMembers(
  toolId: string,
): Promise<EffectiveMember[]> {
  const { data, error } = await supabase.rpc(
    "get_event_tool_effective_members",
    { p_tool_id: toolId },
  );
  if (error) throw error;
  return (data ?? []) as EffectiveMember[];
}

export async function listExpenses(toolId: string): Promise<Expense[]> {
  const { data: expensesData, error: eErr } = await supabase.rpc(
    "get_event_tool_expenses",
    { p_tool_id: toolId },
  );
  if (eErr) throw eErr;
  const rows = (expensesData ?? []) as Omit<Expense, "shares">[];
  if (rows.length === 0) return [];

  const { data: sharesData, error: sErr } = await supabase
    .from("event_tool_expense_shares")
    .select("*")
    .in(
      "event_tool_expense_share_expense_id",
      rows.map((r) => r.expense_id),
    );
  if (sErr) throw sErr;

  const sharesByExpense = new Map<string, ExpenseShare[]>();
  for (const s of sharesData ?? []) {
    const id = s.event_tool_expense_share_expense_id as string;
    const list = sharesByExpense.get(id) ?? [];
    list.push({
      user_id: s.event_tool_expense_share_user_id,
      mode: s.event_tool_expense_share_mode,
      value:
        s.event_tool_expense_share_value != null
          ? Number(s.event_tool_expense_share_value)
          : null,
    });
    sharesByExpense.set(id, list);
  }

  return rows.map((r) => ({
    ...r,
    amount: Number(r.amount),
    shares: sharesByExpense.get(r.expense_id) ?? [],
  }));
}

export async function createExpense(input: {
  tool_id: string;
  label: string;
  amount: number;
  paid_by: string;
  currency?: string;
  member_ids: string[];
}): Promise<string> {
  const userId = await requireUserId();

  const { data: maxRow } = await supabase
    .from("event_tool_expenses")
    .select("event_tool_expense_order")
    .eq("event_tool_expense_event_tool_id", input.tool_id)
    .order("event_tool_expense_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder =
    maxRow?.event_tool_expense_order != null
      ? (maxRow.event_tool_expense_order as number) + 1
      : 0;

  const { data: inserted, error: insertErr } = await supabase
    .from("event_tool_expenses")
    .insert({
      event_tool_expense_event_tool_id: input.tool_id,
      event_tool_expense_label: input.label,
      event_tool_expense_amount: input.amount,
      event_tool_expense_currency: input.currency ?? "EUR",
      event_tool_expense_paid_by: input.paid_by,
      event_tool_expense_creator_id: userId,
      event_tool_expense_order: nextOrder,
    })
    .select("event_tool_expense_id")
    .single();
  if (insertErr) throw insertErr;

  const newId = inserted!.event_tool_expense_id as string;

  if (input.member_ids.length > 0) {
    const { error: sErr } = await supabase
      .from("event_tool_expense_shares")
      .insert(
        input.member_ids.map((uid) => ({
          event_tool_expense_share_expense_id: newId,
          event_tool_expense_share_user_id: uid,
          event_tool_expense_share_mode: "equal" as const,
          event_tool_expense_share_value: null,
        })),
      );
    if (sErr) throw sErr;
  }

  return newId;
}

export async function updateExpense(
  expenseId: string,
  input: {
    label?: string;
    amount?: number;
    paid_by?: string;
  },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.label !== undefined) patch.event_tool_expense_label = input.label;
  if (input.amount !== undefined) patch.event_tool_expense_amount = input.amount;
  if (input.paid_by !== undefined)
    patch.event_tool_expense_paid_by = input.paid_by;
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase
    .from("event_tool_expenses")
    .update(patch)
    .eq("event_tool_expense_id", expenseId);
  if (error) throw error;
}

export async function replaceExpenseShares(
  expenseId: string,
  shares: ExpenseShare[],
): Promise<void> {
  const { error: dErr } = await supabase
    .from("event_tool_expense_shares")
    .delete()
    .eq("event_tool_expense_share_expense_id", expenseId);
  if (dErr) throw dErr;
  if (shares.length === 0) return;
  const { error: iErr } = await supabase
    .from("event_tool_expense_shares")
    .insert(
      shares.map((s) => ({
        event_tool_expense_share_expense_id: expenseId,
        event_tool_expense_share_user_id: s.user_id,
        event_tool_expense_share_mode: s.mode,
        event_tool_expense_share_value: s.mode === "equal" ? null : s.value,
      })),
    );
  if (iErr) throw iErr;
}

export async function deleteExpense(expenseId: string): Promise<void> {
  const { error } = await supabase
    .from("event_tool_expenses")
    .delete()
    .eq("event_tool_expense_id", expenseId);
  if (error) throw error;
}

// === Pure computations ===

export function computeExpenseShares(
  totalAmount: number,
  shares: ExpenseShare[],
): Record<string, number> {
  let fixedSum = 0;
  let percentAmountSum = 0;
  const equalUsers: string[] = [];
  for (const s of shares) {
    if (s.mode === "amount") fixedSum += s.value ?? 0;
    else if (s.mode === "percent")
      percentAmountSum += ((s.value ?? 0) * totalAmount) / 100;
    else equalUsers.push(s.user_id);
  }
  const remaining = totalAmount - fixedSum - percentAmountSum;
  const equalShare =
    equalUsers.length > 0 ? remaining / equalUsers.length : 0;

  const result: Record<string, number> = {};
  for (const s of shares) {
    if (s.mode === "amount") result[s.user_id] = s.value ?? 0;
    else if (s.mode === "percent")
      result[s.user_id] = ((s.value ?? 0) * totalAmount) / 100;
    else result[s.user_id] = equalShare;
  }
  return result;
}

export type MemberBalance = {
  user_id: string;
  paid: number;
  owed: number;
  balance: number;
};

export function computeBalances(
  expenses: Expense[],
  memberIds: string[],
): MemberBalance[] {
  const paid: Record<string, number> = {};
  const owed: Record<string, number> = {};
  for (const uid of memberIds) {
    paid[uid] = 0;
    owed[uid] = 0;
  }
  for (const e of expenses) {
    if (e.paid_by) paid[e.paid_by] = (paid[e.paid_by] ?? 0) + e.amount;
    const shares = computeExpenseShares(e.amount, e.shares);
    for (const [uid, share] of Object.entries(shares)) {
      owed[uid] = (owed[uid] ?? 0) + share;
    }
  }
  return memberIds.map((uid) => ({
    user_id: uid,
    paid: paid[uid] ?? 0,
    owed: owed[uid] ?? 0,
    balance: (paid[uid] ?? 0) - (owed[uid] ?? 0),
  }));
}

export type Settlement = {
  from: string;
  to: string;
  amount: number;
};

export function settleBalances(balances: MemberBalance[]): Settlement[] {
  const eps = 0.01;
  const debtors = balances
    .filter((b) => b.balance < -eps)
    .map((b) => ({ user_id: b.user_id, balance: b.balance }));
  const creditors = balances
    .filter((b) => b.balance > eps)
    .map((b) => ({ user_id: b.user_id, balance: b.balance }));
  const transfers: Settlement[] = [];
  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort((a, b) => a.balance - b.balance);
    creditors.sort((a, b) => b.balance - a.balance);
    const d = debtors[0];
    const c = creditors[0];
    const amt = Math.min(-d.balance, c.balance);
    transfers.push({
      from: d.user_id,
      to: c.user_id,
      amount: Math.round(amt * 100) / 100,
    });
    d.balance += amt;
    c.balance -= amt;
    if (Math.abs(d.balance) < eps) debtors.shift();
    if (Math.abs(c.balance) < eps) creditors.shift();
  }
  return transfers;
}

export function formatAmount(amount: number, currency = "EUR"): string {
  const symbol = currency === "EUR" ? "€" : currency;
  return `${amount.toFixed(2).replace(".", ",")} ${symbol}`;
}
