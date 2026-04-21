import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Avatar, Text } from "@/components/ui";
import {
  createEventToolNote,
  deleteEventToolNote,
  listEventToolNotes,
  toggleEventToolNote,
  updateEventToolNoteText,
  type EventToolNote,
} from "@/lib/notes";
import { useSession } from "@/lib/useSession";
import { NoteEditModal } from "./NoteEditModal";
import { ToolShell, type ToolProps } from "./ToolShell";

function firstName(full: string | null): string {
  if (!full) return "?";
  return full.trim().split(/\s+/)[0];
}

function initialsOf(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function useRelativeTime() {
  const { t } = useTranslation();
  return useCallback(
    (iso: string): string => {
      const diff = Date.now() - new Date(iso).getTime();
      const sec = Math.max(0, Math.floor(diff / 1000));
      if (sec < 60) return t("notes.time.now");
      const min = Math.floor(sec / 60);
      if (min < 60) return t("notes.time.minutes", { count: min });
      const hr = Math.floor(min / 60);
      if (hr < 24) return t("notes.time.hours", { count: hr });
      const day = Math.floor(hr / 24);
      return t("notes.time.days", { count: day });
    },
    [t],
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      variant="caption"
      className="mb-3 uppercase"
      style={{
        letterSpacing: 1.2,
        fontWeight: "700",
        fontSize: 11,
        color: "#6050DC",
      }}
    >
      {children}
    </Text>
  );
}

function Checkbox({
  checked,
  onPress,
}: {
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      className="items-center justify-center"
      style={{
        width: 26,
        height: 26,
        borderRadius: 8,
        borderWidth: checked ? 0 : 1.5,
        borderColor: "#E8E3DB",
        backgroundColor: checked ? "#6050DC" : "#FFFFFF",
      }}
    >
      {checked ? (
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 15,
            fontWeight: "900",
            lineHeight: 17,
          }}
        >
          ✓
        </Text>
      ) : null}
    </Pressable>
  );
}

function NoteRow({
  note,
  canEdit,
  onToggle,
  onEdit,
  formatTime,
}: {
  note: EventToolNote;
  canEdit: boolean;
  onToggle: () => void;
  onEdit: () => void;
  formatTime: (iso: string) => string;
}) {
  const done = note.is_done;
  return (
    <View
      className="flex-row items-start py-3"
      style={{
        borderBottomWidth: 1,
        borderBottomColor: "#F2EDE4",
      }}
    >
      <View className="mr-3 pt-0.5">
        <Checkbox checked={done} onPress={onToggle} />
      </View>
      <View className="flex-1 pr-2">
        <Text
          style={{
            color: done ? "#A3A3A3" : "#1A1A1A",
            fontSize: 15,
            lineHeight: 20,
            textDecorationLine: done ? "line-through" : "none",
          }}
        >
          {note.text}
        </Text>
        <View className="flex-row items-center mt-1.5">
          <Avatar
            src={note.author_avatar_url ?? undefined}
            initials={initialsOf(note.author_full_name)}
            size="xs"
            className="mr-1.5"
          />
          <Text variant="caption" style={{ fontSize: 12 }}>
            {firstName(note.author_full_name)}
            {" · "}
            {formatTime(note.created_at)}
          </Text>
        </View>
      </View>
      {canEdit ? (
        <Pressable
          onPress={onEdit}
          hitSlop={8}
          className="items-center justify-center"
          style={{ width: 32, height: 32 }}
        >
          <Ionicons name="pencil" size={16} color="#6050DC" />
        </Pressable>
      ) : null}
    </View>
  );
}

export function NotesTool(props: ToolProps) {
  const { t } = useTranslation();
  const { session } = useSession();
  const currentUserId = session?.user?.id ?? "";
  const formatTime = useRelativeTime();

  const [notes, setNotes] = useState<EventToolNote[]>([]);
  const [newText, setNewText] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EventToolNote | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await listEventToolNotes(props.tool.event_tool_id);
      setNotes(list);
    } catch {
      setNotes([]);
    }
  }, [props.tool.event_tool_id]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    const text = newText.trim();
    if (!text || creating) return;
    setCreating(true);
    try {
      await createEventToolNote(props.tool.event_tool_id, text);
      setNewText("");
      await load();
    } finally {
      setCreating(false);
    }
  };

  const toggle = async (note: EventToolNote) => {
    const nextDone = !note.is_done;
    setNotes((prev) =>
      prev.map((n) =>
        n.note_id === note.note_id ? { ...n, is_done: nextDone } : n,
      ),
    );
    try {
      await toggleEventToolNote(note.note_id, nextDone);
      await load();
    } catch {
      await load();
    }
  };

  const saveEdit = async (text: string) => {
    if (!editing) return;
    await updateEventToolNoteText(editing.note_id, text);
    setEditing(null);
    await load();
  };

  const deleteEditing = async () => {
    if (!editing) return;
    await deleteEventToolNote(editing.note_id);
    setEditing(null);
    await load();
  };

  const { active, done } = useMemo(() => {
    const a: EventToolNote[] = [];
    const d: EventToolNote[] = [];
    for (const n of notes) (n.is_done ? d : a).push(n);
    return { active: a, done: d };
  }, [notes]);

  const canEdit = (note: EventToolNote) =>
    note.author_id === currentUserId || props.isToolAdmin;

  return (
    <ToolShell {...props}>
      <View
        className="flex-row items-center rounded-2xl px-3 py-1.5 mb-6"
        style={{
          backgroundColor: "#FFFFFF",
          borderWidth: 1,
          borderColor: "#E8E3DB",
        }}
      >
        <TextInput
          value={newText}
          onChangeText={setNewText}
          placeholder={t("notes.addPlaceholder")}
          placeholderTextColor="#A3A3A3"
          onSubmitEditing={add}
          returnKeyType="done"
          style={{
            flex: 1,
            fontSize: 15,
            color: "#1A1A1A",
            paddingVertical: 8,
            paddingHorizontal: 4,
          }}
        />
        <Pressable
          onPress={add}
          disabled={!newText.trim() || creating}
          hitSlop={6}
          className="items-center justify-center"
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: newText.trim() ? "#6050DC" : "#E8E3DB",
            opacity: creating ? 0.5 : 1,
          }}
        >
          <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
        </Pressable>
      </View>

      {notes.length === 0 ? (
        <View className="py-8 items-center">
          <Text variant="caption" className="text-center">
            {t("notes.empty")}
          </Text>
        </View>
      ) : (
        <>
          {active.length > 0 ? (
            <View className="mb-6">
              <SectionLabel>{`${t("notes.activeSection")} (${active.length})`}</SectionLabel>
              {active.map((n) => (
                <NoteRow
                  key={n.note_id}
                  note={n}
                  canEdit={canEdit(n)}
                  onToggle={() => toggle(n)}
                  onEdit={() => setEditing(n)}
                  formatTime={formatTime}
                />
              ))}
            </View>
          ) : null}

          {done.length > 0 ? (
            <View className="mb-6">
              <SectionLabel>{`${t("notes.doneSection")} (${done.length})`}</SectionLabel>
              {done.map((n) => (
                <NoteRow
                  key={n.note_id}
                  note={n}
                  canEdit={canEdit(n)}
                  onToggle={() => toggle(n)}
                  onEdit={() => setEditing(n)}
                  formatTime={formatTime}
                />
              ))}
            </View>
          ) : null}
        </>
      )}

      <NoteEditModal
        visible={!!editing}
        initialText={editing?.text ?? ""}
        canDelete={editing ? canEdit(editing) : false}
        onClose={() => setEditing(null)}
        onSave={saveEdit}
        onDelete={deleteEditing}
      />
    </ToolShell>
  );
}
