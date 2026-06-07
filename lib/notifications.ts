import { supabase } from "./supabase";

// One entry of the activity feed, as returned by list_activity.
export type ActivityItem = {
  id: string;
  event_id: string;
  tool_id: string | null;
  type: string;
  object_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  is_unread: boolean;
  actor_id: string | null;
  actor_name: string | null;
  actor_avatar_url: string | null;
  event_title: string | null;
};

// Fire-and-forget activity logging. Called from the lib write functions when an
// action is worth notifying. NEVER throws: a logging failure must not break the
// underlying action (we only warn). The actor is the caller (enforced server
// side); `targetUserIds` left undefined = broadcast to everyone who can see the
// event/tool, set = only those users are concerned (personal notification).
export async function logActivity(input: {
  // Either eventId or toolId must be set — the server derives the event from
  // the tool when only toolId is given.
  type: string;
  eventId?: string | null;
  toolId?: string | null;
  objectId?: string | null;
  targetUserIds?: string[] | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { error } = await supabase.rpc("log_activity", {
      p_event_id: input.eventId ?? null,
      p_tool_id: input.toolId ?? null,
      p_type: input.type,
      p_object_id: input.objectId ?? null,
      p_target_user_ids: input.targetUserIds ?? null,
      p_payload: input.payload ?? {},
    });
    if (error) throw error;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("logActivity failed:", input.type, e);
  }
}

// Number of relevant unread activities (for the bell badge). Returns 0 on error.
export async function getUnreadCount(): Promise<number> {
  const { data, error } = await supabase.rpc("get_unread_count");
  if (error) {
    // eslint-disable-next-line no-console
    console.warn("getUnreadCount failed:", error);
    return 0;
  }
  return (data as number | null) ?? 0;
}

// Paginated relevant feed, newest first. Pass the oldest loaded item's
// created_at as `before` to page further back.
export async function listActivity(
  limit = 50,
  before?: string,
): Promise<ActivityItem[]> {
  const { data, error } = await supabase.rpc("list_activity", {
    p_limit: limit,
    p_before: before ?? null,
  });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.activity_id as string,
    event_id: r.event_id as string,
    tool_id: (r.tool_id as string | null) ?? null,
    type: r.type as string,
    object_id: (r.object_id as string | null) ?? null,
    payload: (r.payload as Record<string, unknown> | null) ?? {},
    created_at: r.created_at as string,
    is_unread: Boolean(r.is_unread),
    actor_id: (r.actor_id as string | null) ?? null,
    actor_name: (r.actor_name as string | null) ?? null,
    actor_avatar_url: (r.actor_avatar_url as string | null) ?? null,
    event_title: (r.event_title as string | null) ?? null,
  }));
}

// Move the read cursor to now (clears the badge). Best-effort.
export async function markNotificationsSeen(): Promise<void> {
  const { error } = await supabase.rpc("mark_notifications_seen");
  if (error) {
    // eslint-disable-next-line no-console
    console.warn("markNotificationsSeen failed:", error);
  }
}
