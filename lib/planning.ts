import { supabase } from "./supabase";

// Kinds of items a planning slot can link to. Must stay in sync with the
// public.planning_link_kind enum.
export type PlanningLinkKind =
  | "tool"
  | "meal_recipe"
  | "carpool_vehicle"
  | "proposal"
  | "note"
  | "team";

export const PLANNING_LINKABLE_TOOL_TYPES = [
  "meals",
  "car_sharing",
  "proposals",
  "notes",
  "teams",
] as const;
export type PlanningLinkableToolType =
  (typeof PLANNING_LINKABLE_TOOL_TYPES)[number];

// Returns the link kind for a given tool type when targeting a specific
// item inside that tool. Used by the link picker to know which RPC/table
// to fetch the items list from.
export function itemKindForToolType(
  type: string,
): Exclude<PlanningLinkKind, "tool"> | null {
  switch (type) {
    case "meals":
      return "meal_recipe";
    case "car_sharing":
      return "carpool_vehicle";
    case "proposals":
      return "proposal";
    case "notes":
      return "note";
    case "teams":
      return "team";
    default:
      return null;
  }
}

export type PlanningSlotParticipant = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
};

export type PlanningSlotLink = {
  id: string;
  target_tool_id: string;
  target_tool_name: string;
  target_tool_type_code: string;
  kind: PlanningLinkKind;
  target_id: string | null;
  // Resolved at the RPC level: tool name when kind='tool', otherwise the
  // recipe/vehicle/proposal/note short label.
  target_label: string | null;
};

export type PlanningSlot = {
  slot_id: string;
  title: string;
  description: string | null;
  location: string | null;
  location_url: string | null;
  starts_at: string;
  ends_at: string | null;
  has_time: boolean;
  author_id: string | null;
  author_full_name: string | null;
  author_avatar_url: string | null;
  created_at: string;
  updated_at: string;
  participants: PlanningSlotParticipant[];
  links: PlanningSlotLink[];
};

export type PlanningSlotInput = {
  title: string;
  description: string | null;
  location: string | null;
  location_url: string | null;
  starts_at: string;
  ends_at: string | null;
  has_time: boolean;
  participants: string[];
  links: Array<{
    target_tool_id: string;
    kind: PlanningLinkKind;
    target_id: string | null;
  }>;
};

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listEventToolPlanningSlots(
  toolId: string,
): Promise<PlanningSlot[]> {
  const { data, error } = await supabase.rpc(
    "get_event_tool_planning_slots",
    { p_tool_id: toolId },
  );
  if (error) throw error;
  return (data ?? []) as PlanningSlot[];
}

export async function upsertEventToolPlanningSlot(
  toolId: string,
  slotId: string | null,
  input: PlanningSlotInput,
): Promise<string> {
  const { data, error } = await supabase.rpc(
    "upsert_event_tool_planning_slot",
    {
      p_slot_id: slotId,
      p_tool_id: toolId,
      p_title: input.title,
      p_description: input.description,
      p_location: input.location,
      p_location_url: input.location_url,
      p_starts_at: input.starts_at,
      p_ends_at: input.ends_at,
      p_has_time: input.has_time,
      p_participants: input.participants,
      p_links: input.links,
    },
  );
  if (error) throw error;
  return data as string;
}

export async function deleteEventToolPlanningSlot(
  slotId: string,
): Promise<void> {
  const { error } = await supabase
    .from("event_tool_planning_slot")
    .delete()
    .eq("event_tool_planning_slot_id", slotId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Reverse lookup — given an item in another tool, find planning slots
// that schedule it. Used to display the "📅 Friday 19h" badge on
// recipe/vehicle/proposal/note cards.
// ---------------------------------------------------------------------------

export type PlanningLinkBackref = {
  slot_id: string;
  planning_tool_id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  has_time: boolean;
};

export async function listPlanningLinksForItem(
  eventId: string,
  kind: PlanningLinkKind,
  targetId: string | null,
): Promise<PlanningLinkBackref[]> {
  const { data, error } = await supabase.rpc(
    "get_planning_links_for_event",
    {
      p_event_id: eventId,
      p_kind: kind,
      p_target_id: targetId,
    },
  );
  if (error) throw error;
  return (data ?? []) as PlanningLinkBackref[];
}
