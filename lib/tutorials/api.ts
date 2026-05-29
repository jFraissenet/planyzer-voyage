import { supabase } from "../supabase";

export type BirthdayTutorialIds = {
  event_id: string;
  teams_tool_id: string;
  apero_team_id: string;
  proposals_tool_id: string;
  comptoir_proposal_id: string;
  money_tool_id: string;
  cake_expense_id: string;
  sophie_user_id: string;
};

export async function startBirthdayTutorial(): Promise<BirthdayTutorialIds> {
  const { data, error } = await supabase.rpc("start_birthday_tutorial");
  if (error) throw error;
  const rows = (data ?? []) as BirthdayTutorialIds[];
  if (!rows[0]) throw new Error("start_birthday_tutorial returned no row");
  return rows[0];
}

export async function endTutorialDemo(eventId: string): Promise<void> {
  const { error } = await supabase.rpc("end_tutorial_demo", {
    p_event_id: eventId,
  });
  if (error) throw error;
}

export async function cleanupMyOrphanDemos(): Promise<number> {
  const { data, error } = await supabase.rpc("cleanup_my_orphan_demos");
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function markTutorialSeen(): Promise<void> {
  const { error } = await supabase.rpc("mark_tutorial_seen");
  if (error) throw error;
}

export async function hasSeenTutorial(): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return true;
  const { data, error } = await supabase
    .from("users")
    .select("tutorial_seen_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return true; // fail-safe: don't pester on errors
  return data?.tutorial_seen_at != null;
}
