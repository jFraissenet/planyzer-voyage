import { supabase } from "./supabase";

export type Event = {
  event_id: string;
  event_title: string;
  event_description: string | null;
  event_start_date: string | null;
  event_end_date: string | null;
  event_creator_id: string;
  event_created_at: string;
  event_updated_at: string;
};

export type CreateEventInput = {
  event_title: string;
  event_description?: string | null;
  event_start_date?: string | null;
  event_end_date?: string | null;
};

async function requireUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

async function participationEventIds(
  userId: string,
  archived: boolean,
): Promise<string[]> {
  let q = supabase
    .from("event_participants")
    .select("event_participant_event_id")
    .eq("event_participant_user_id", userId);
  q = archived
    ? q.not("event_participant_archived_at", "is", null)
    : q.is("event_participant_archived_at", null);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => r.event_participant_event_id as string);
}

export async function createEvent(input: CreateEventInput): Promise<Event> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("events")
    .insert({
      event_title: input.event_title,
      event_description: input.event_description ?? null,
      event_start_date: input.event_start_date ?? null,
      event_end_date: input.event_end_date ?? null,
      event_creator_id: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Event;
}

export async function listMyEvents(opts?: {
  archived?: boolean;
}): Promise<Event[]> {
  const userId = await requireUserId();
  const ids = await participationEventIds(userId, opts?.archived ?? false);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .in("event_id", ids)
    .eq("event_creator_id", userId)
    .order("event_start_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Event[];
}

export async function listSharedEvents(opts?: {
  archived?: boolean;
}): Promise<Event[]> {
  const userId = await requireUserId();
  const ids = await participationEventIds(userId, opts?.archived ?? false);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .in("event_id", ids)
    .neq("event_creator_id", userId)
    .order("event_start_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Event[];
}

export async function archiveEvent(eventId: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("event_participants")
    .update({ event_participant_archived_at: new Date().toISOString() })
    .eq("event_participant_event_id", eventId)
    .eq("event_participant_user_id", userId);
  if (error) throw error;
}

export async function unarchiveEvent(eventId: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("event_participants")
    .update({ event_participant_archived_at: null })
    .eq("event_participant_event_id", eventId)
    .eq("event_participant_user_id", userId);
  if (error) throw error;
}

export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase
    .from("events")
    .delete()
    .eq("event_id", eventId);
  if (error) throw error;
}

export async function getEvent(eventId: string): Promise<Event | null> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) throw error;
  return data as Event | null;
}

export type EventTool = {
  event_tool_id: string;
  event_tool_event_id: string;
  event_tool_type_code: string;
  event_tool_name: string;
  event_tool_visibility: "all" | "restricted";
  event_tool_settings: Record<string, unknown>;
  event_tool_created_at: string;
  event_tool_updated_at: string;
};

export async function getEventTool(toolId: string): Promise<EventTool | null> {
  const { data, error } = await supabase
    .from("event_tools")
    .select("*")
    .eq("event_tool_id", toolId)
    .maybeSingle();
  if (error) throw error;
  return data as EventTool | null;
}

export async function getToolParticipantCount(
  tool: EventTool,
): Promise<number> {
  if (tool.event_tool_visibility === "all") {
    const { count, error } = await supabase
      .from("event_participants")
      .select("*", { count: "exact", head: true })
      .eq("event_participant_event_id", tool.event_tool_event_id);
    if (error) throw error;
    return count ?? 0;
  }
  const { count, error } = await supabase
    .from("event_tool_members")
    .select("*", { count: "exact", head: true })
    .eq("event_tool_member_event_tool_id", tool.event_tool_id);
  if (error) throw error;
  return count ?? 0;
}

export async function listEventTools(eventId: string): Promise<EventTool[]> {
  const { data, error } = await supabase
    .from("event_tools")
    .select("*")
    .eq("event_tool_event_id", eventId)
    .order("event_tool_created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EventTool[];
}

export type ToolType = {
  tool_type_code: string;
  tool_type_icon: string | null;
  tool_type_default_visibility: "all" | "restricted";
  tool_type_is_active: boolean;
};

export async function listToolTypes(): Promise<ToolType[]> {
  const { data, error } = await supabase
    .from("tool_types")
    .select("tool_type_code, tool_type_icon, tool_type_default_visibility, tool_type_is_active")
    .eq("tool_type_is_active", true);
  if (error) throw error;
  return (data ?? []) as ToolType[];
}

export async function getMyEventRole(eventId: string): Promise<string | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("event_participants")
    .select("event_participant_role_code")
    .eq("event_participant_event_id", eventId)
    .eq("event_participant_user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.event_participant_role_code as string) ?? null;
}

export type UserSearchResult = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
};

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  if (query.trim().length < 2) return [];
  const { data, error } = await supabase.rpc("search_users", {
    p_query: query,
  });
  if (error) throw error;
  return (data ?? []) as UserSearchResult[];
}

export type ParticipantEntry = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role_code: string;
  joined_at: string;
};

export async function listParticipants(
  eventId: string,
): Promise<ParticipantEntry[]> {
  const { data, error } = await supabase.rpc("get_event_participants", {
    p_event_id: eventId,
  });
  if (error) throw error;
  return (data ?? []) as ParticipantEntry[];
}

export async function addParticipant(
  eventId: string,
  userId: string,
  roleCode: string = "member",
): Promise<void> {
  const inviterId = await requireUserId();
  const { error } = await supabase.from("event_participants").insert({
    event_participant_event_id: eventId,
    event_participant_user_id: userId,
    event_participant_role_code: roleCode,
    event_participant_invited_by: inviterId,
  });
  // 23505 = unique_violation (already participant)
  if (error && error.code !== "23505") throw error;
}

export async function removeParticipant(
  eventId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("event_participants")
    .delete()
    .eq("event_participant_event_id", eventId)
    .eq("event_participant_user_id", userId);
  if (error) throw error;
}

export type ToolMemberEntry = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role_code: string;
  added_at: string;
};

export async function listToolMembers(
  toolId: string,
): Promise<ToolMemberEntry[]> {
  const { data, error } = await supabase.rpc("get_event_tool_members", {
    p_tool_id: toolId,
  });
  if (error) throw error;
  return (data ?? []) as ToolMemberEntry[];
}

export async function addToolMember(
  toolId: string,
  userId: string,
  roleCode: string = "member",
): Promise<void> {
  const { error } = await supabase.from("event_tool_members").insert({
    event_tool_member_event_tool_id: toolId,
    event_tool_member_user_id: userId,
    event_tool_member_role_code: roleCode,
  });
  if (error && error.code !== "23505") throw error;
}

export async function removeToolMember(
  toolId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("event_tool_members")
    .delete()
    .eq("event_tool_member_event_tool_id", toolId)
    .eq("event_tool_member_user_id", userId);
  if (error) throw error;
}

export async function isToolAdmin(toolId: string): Promise<boolean> {
  const userId = await requireUserId();
  const { data, error } = await supabase.rpc("is_event_tool_admin", {
    p_tool_id: toolId,
    p_user_id: userId,
  });
  if (error) throw error;
  return data === true;
}

export async function createEventTool(input: {
  event_tool_event_id: string;
  event_tool_type_code: string;
  event_tool_name: string;
  event_tool_visibility: "all" | "restricted";
}): Promise<EventTool> {
  const { error: insertError } = await supabase
    .from("event_tools")
    .insert(input);
  if (insertError) throw insertError;
  const { data, error } = await supabase
    .from("event_tools")
    .select("*")
    .eq("event_tool_event_id", input.event_tool_event_id)
    .eq("event_tool_name", input.event_tool_name)
    .order("event_tool_created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as EventTool;
}
