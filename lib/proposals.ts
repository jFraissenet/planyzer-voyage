import { supabase } from "./supabase";

export type ProposalStatus = "proposed" | "validated" | "rejected";
export type VoteValue = "for" | "against" | "neutral";

export type ProposalImage = {
  id: string;
  url: string;
  position: number;
};

export type ProposalLink = {
  id: string;
  label: string | null;
  url: string;
  position: number;
};

export type EventToolProposal = {
  proposal_id: string;
  title: string;
  description: string | null;
  price_min: number | null;
  price_max: number | null;
  location: string | null;
  location_url: string | null;
  date_start: string | null;
  date_end: string | null;
  capacity_min: number | null;
  capacity_max: number | null;
  status: ProposalStatus;
  author_id: string | null;
  author_full_name: string | null;
  author_avatar_url: string | null;
  created_at: string;
  updated_at: string;
  votes_for: number;
  votes_against: number;
  votes_neutral: number;
  my_vote: VoteValue | null;
  comments_count: number;
  images: ProposalImage[];
  links: ProposalLink[];
};

export type EventToolProposalComment = {
  comment_id: string;
  text: string;
  author_id: string | null;
  author_full_name: string | null;
  author_avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ProposalsToolSettings = {
  vote_deadline: string | null;
  proposals_locked: boolean;
};

async function requireUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

// ---------------------------------------------------------------------------
// List & CRUD — proposals
// ---------------------------------------------------------------------------

export async function listEventToolProposals(
  toolId: string,
): Promise<EventToolProposal[]> {
  const { data, error } = await supabase.rpc("get_event_tool_proposals", {
    p_tool_id: toolId,
  });
  if (error) throw error;
  return (data ?? []) as EventToolProposal[];
}

export type ProposalInput = {
  title: string;
  description?: string | null;
  price_min?: number | null;
  price_max?: number | null;
  location?: string | null;
  location_url?: string | null;
  date_start?: string | null;
  date_end?: string | null;
  capacity_min?: number | null;
  capacity_max?: number | null;
  images?: { url: string }[];
  links?: { label?: string | null; url: string }[];
};

export async function createEventToolProposal(
  toolId: string,
  input: ProposalInput,
): Promise<string> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("event_tool_proposals")
    .insert({
      event_tool_proposal_event_tool_id: toolId,
      event_tool_proposal_title: input.title,
      event_tool_proposal_description: input.description ?? null,
      event_tool_proposal_price_min: input.price_min ?? null,
      event_tool_proposal_price_max: input.price_max ?? null,
      event_tool_proposal_location: input.location ?? null,
      event_tool_proposal_location_url: input.location_url ?? null,
      event_tool_proposal_date_start: input.date_start ?? null,
      event_tool_proposal_date_end: input.date_end ?? null,
      event_tool_proposal_capacity_min: input.capacity_min ?? null,
      event_tool_proposal_capacity_max: input.capacity_max ?? null,
      event_tool_proposal_author_id: userId,
    })
    .select("event_tool_proposal_id")
    .single();
  if (error) throw error;
  const proposalId = data.event_tool_proposal_id as string;
  if (input.images?.length) await replaceProposalImages(proposalId, input.images);
  if (input.links?.length) await replaceProposalLinks(proposalId, input.links);
  return proposalId;
}

export async function updateEventToolProposal(
  proposalId: string,
  input: ProposalInput,
): Promise<void> {
  const { error } = await supabase
    .from("event_tool_proposals")
    .update({
      event_tool_proposal_title: input.title,
      event_tool_proposal_description: input.description ?? null,
      event_tool_proposal_price_min: input.price_min ?? null,
      event_tool_proposal_price_max: input.price_max ?? null,
      event_tool_proposal_location: input.location ?? null,
      event_tool_proposal_location_url: input.location_url ?? null,
      event_tool_proposal_date_start: input.date_start ?? null,
      event_tool_proposal_date_end: input.date_end ?? null,
      event_tool_proposal_capacity_min: input.capacity_min ?? null,
      event_tool_proposal_capacity_max: input.capacity_max ?? null,
    })
    .eq("event_tool_proposal_id", proposalId);
  if (error) throw error;
  await replaceProposalImages(proposalId, input.images ?? []);
  await replaceProposalLinks(proposalId, input.links ?? []);
}

export async function deleteEventToolProposal(
  proposalId: string,
): Promise<void> {
  const { error } = await supabase
    .from("event_tool_proposals")
    .delete()
    .eq("event_tool_proposal_id", proposalId);
  if (error) throw error;
}

export async function setEventToolProposalStatus(
  proposalId: string,
  status: ProposalStatus,
): Promise<void> {
  const { error } = await supabase
    .from("event_tool_proposals")
    .update({ event_tool_proposal_status: status })
    .eq("event_tool_proposal_id", proposalId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Links & images — replace-all strategy, simpler than diffing
// ---------------------------------------------------------------------------

async function replaceProposalLinks(
  proposalId: string,
  links: { label?: string | null; url: string }[],
): Promise<void> {
  const del = await supabase
    .from("event_tool_proposal_links")
    .delete()
    .eq("event_tool_proposal_link_proposal_id", proposalId);
  if (del.error) throw del.error;
  if (links.length === 0) return;
  const rows = links.map((l, i) => ({
    event_tool_proposal_link_proposal_id: proposalId,
    event_tool_proposal_link_label: l.label ?? null,
    event_tool_proposal_link_url: l.url,
    event_tool_proposal_link_position: i,
  }));
  const { error } = await supabase.from("event_tool_proposal_links").insert(rows);
  if (error) throw error;
}

async function replaceProposalImages(
  proposalId: string,
  images: { url: string }[],
): Promise<void> {
  const del = await supabase
    .from("event_tool_proposal_images")
    .delete()
    .eq("event_tool_proposal_image_proposal_id", proposalId);
  if (del.error) throw del.error;
  if (images.length === 0) return;
  const rows = images.map((img, i) => ({
    event_tool_proposal_image_proposal_id: proposalId,
    event_tool_proposal_image_url: img.url,
    event_tool_proposal_image_position: i,
  }));
  const { error } = await supabase.from("event_tool_proposal_images").insert(rows);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Votes
// ---------------------------------------------------------------------------

export async function setEventToolProposalVote(
  proposalId: string,
  value: VoteValue,
): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("event_tool_proposal_votes")
    .upsert(
      {
        event_tool_proposal_vote_proposal_id: proposalId,
        event_tool_proposal_vote_user_id: userId,
        event_tool_proposal_vote_value: value,
      },
      {
        onConflict:
          "event_tool_proposal_vote_proposal_id,event_tool_proposal_vote_user_id",
      },
    );
  if (error) throw error;
}

export async function clearEventToolProposalVote(
  proposalId: string,
): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("event_tool_proposal_votes")
    .delete()
    .eq("event_tool_proposal_vote_proposal_id", proposalId)
    .eq("event_tool_proposal_vote_user_id", userId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export async function listEventToolProposalComments(
  proposalId: string,
): Promise<EventToolProposalComment[]> {
  const { data, error } = await supabase.rpc(
    "get_event_tool_proposal_comments",
    { p_proposal_id: proposalId },
  );
  if (error) throw error;
  return (data ?? []) as EventToolProposalComment[];
}

export async function addEventToolProposalComment(
  proposalId: string,
  text: string,
): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from("event_tool_proposal_comments").insert({
    event_tool_proposal_comment_proposal_id: proposalId,
    event_tool_proposal_comment_author_id: userId,
    event_tool_proposal_comment_text: text,
  });
  if (error) throw error;
}

export async function deleteEventToolProposalComment(
  commentId: string,
): Promise<void> {
  const { error } = await supabase
    .from("event_tool_proposal_comments")
    .delete()
    .eq("event_tool_proposal_comment_id", commentId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Tool settings (deadline + proposals lock) — stored in event_tools.settings jsonb
// ---------------------------------------------------------------------------

export function readProposalsToolSettings(
  settings: Record<string, unknown>,
): ProposalsToolSettings {
  const raw = settings ?? {};
  const deadline = raw.vote_deadline;
  const locked = raw.proposals_locked;
  return {
    vote_deadline: typeof deadline === "string" ? deadline : null,
    proposals_locked: locked === true,
  };
}

export async function updateProposalsToolSettings(
  toolId: string,
  current: Record<string, unknown>,
  patch: Partial<ProposalsToolSettings>,
): Promise<void> {
  const next: Record<string, unknown> = { ...(current ?? {}) };
  if (patch.vote_deadline !== undefined) next.vote_deadline = patch.vote_deadline;
  if (patch.proposals_locked !== undefined)
    next.proposals_locked = patch.proposals_locked;
  const { error } = await supabase
    .from("event_tools")
    .update({ event_tool_settings: next })
    .eq("event_tool_id", toolId);
  if (error) throw error;
}

export async function isEventToolManager(toolId: string): Promise<boolean> {
  const userId = await requireUserId();
  const { data, error } = await supabase.rpc("is_event_tool_manager", {
    p_tool_id: toolId,
    p_user_id: userId,
  });
  if (error) throw error;
  return data === true;
}
