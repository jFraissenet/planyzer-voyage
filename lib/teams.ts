import { supabase } from "./supabase";

export type TeamMember = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
};

export type EventToolTeam = {
  team_id: string;
  name: string;
  type: string | null;
  color: string;
  starts_at: string | null;
  ends_at: string | null;
  has_time: boolean;
  author_id: string | null;
  author_full_name: string | null;
  author_avatar_url: string | null;
  created_at: string;
  updated_at: string;
  members: TeamMember[];
  planning_tool_ids: string[];
};

export type EventPlanningTool = {
  tool_id: string;
  name: string;
};

export async function listEventToolTeams(
  toolId: string,
): Promise<EventToolTeam[]> {
  const { data, error } = await supabase.rpc("get_event_tool_teams", {
    p_tool_id: toolId,
  });
  if (error) throw error;
  return (data ?? []) as EventToolTeam[];
}

export type UpsertTeamInput = {
  team_id: string | null;
  tool_id: string;
  name: string;
  type: string | null;
  color: string;
  starts_at: string | null;
  ends_at: string | null;
  has_time: boolean;
  member_ids: string[];
  planning_tool_ids: string[];
};

export async function upsertEventToolTeam(
  input: UpsertTeamInput,
): Promise<string> {
  const { data, error } = await supabase.rpc("upsert_event_tool_team", {
    p_team_id: input.team_id,
    p_tool_id: input.tool_id,
    p_name: input.name,
    p_type: input.type ?? "",
    p_color: input.color,
    p_starts_at: input.starts_at,
    p_ends_at: input.ends_at,
    p_has_time: input.has_time,
    p_member_ids: input.member_ids,
    p_planning_tool_ids: input.planning_tool_ids,
  });
  if (error) throw error;
  return data as string;
}

export async function deleteEventToolTeam(teamId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_event_tool_team", {
    p_team_id: teamId,
  });
  if (error) throw error;
}

export async function listEventPlanningTools(
  eventId: string,
): Promise<EventPlanningTool[]> {
  const { data, error } = await supabase.rpc("list_event_planning_tools", {
    p_event_id: eventId,
  });
  if (error) throw error;
  return (data ?? []) as EventPlanningTool[];
}
