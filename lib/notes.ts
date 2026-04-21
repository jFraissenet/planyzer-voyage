import { supabase } from "./supabase";

export type EventToolNote = {
  note_id: string;
  text: string;
  is_done: boolean;
  author_id: string | null;
  author_full_name: string | null;
  author_avatar_url: string | null;
  done_by: string | null;
  done_at: string | null;
  created_at: string;
  updated_at: string;
};

async function requireUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

export async function listEventToolNotes(
  toolId: string,
): Promise<EventToolNote[]> {
  const { data, error } = await supabase.rpc("get_event_tool_notes", {
    p_tool_id: toolId,
  });
  if (error) throw error;
  return (data ?? []) as EventToolNote[];
}

export async function createEventToolNote(
  toolId: string,
  text: string,
): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from("event_tool_notes").insert({
    event_tool_note_event_tool_id: toolId,
    event_tool_note_text: text,
    event_tool_note_author_id: userId,
  });
  if (error) throw error;
}

export async function toggleEventToolNote(
  noteId: string,
  isDone: boolean,
): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("event_tool_notes")
    .update({
      event_tool_note_is_done: isDone,
      event_tool_note_done_at: isDone ? new Date().toISOString() : null,
      event_tool_note_done_by: isDone ? userId : null,
    })
    .eq("event_tool_note_id", noteId);
  if (error) throw error;
}

export async function updateEventToolNoteText(
  noteId: string,
  text: string,
): Promise<void> {
  const { error } = await supabase
    .from("event_tool_notes")
    .update({ event_tool_note_text: text })
    .eq("event_tool_note_id", noteId);
  if (error) throw error;
}

export async function deleteEventToolNote(noteId: string): Promise<void> {
  const { error } = await supabase
    .from("event_tool_notes")
    .delete()
    .eq("event_tool_note_id", noteId);
  if (error) throw error;
}
