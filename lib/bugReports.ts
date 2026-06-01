import { supabase } from "./supabase";

export type BugReport = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  reporter_id: string | null;
  reporter_name: string | null;
  reporter_avatar_url: string | null;
};

export async function submitBugReport(input: {
  title: string;
  description: string;
}): Promise<void> {
  const { error } = await supabase.rpc("submit_bug_report", {
    p_title: input.title,
    p_description: input.description,
  });
  if (error) throw error;
}

// Returns every bug report (with the reporter's name/avatar) so users can
// check for duplicates. Access is gated to authenticated callers by the RPC.
export async function listAllBugReports(): Promise<BugReport[]> {
  const { data, error } = await supabase.rpc("get_bug_reports");
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.bug_report_id as string,
    title: r.title as string,
    description: (r.description as string | null) ?? null,
    status: r.status as string,
    created_at: r.created_at as string,
    reporter_id: (r.reporter_id as string | null) ?? null,
    reporter_name: (r.reporter_name as string | null) ?? null,
    reporter_avatar_url: (r.reporter_avatar_url as string | null) ?? null,
  }));
}
