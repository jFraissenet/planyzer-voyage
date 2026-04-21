import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Avatar, Button, Text } from "@/components/ui";
import {
  addToolMember,
  listParticipants,
  listToolMembers,
  removeToolMember,
  type ParticipantEntry,
  type ToolMemberEntry,
} from "@/lib/events";

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

type Props = {
  visible: boolean;
  eventId: string;
  toolId: string;
  currentUserId: string;
  onClose: () => void;
  onChanged?: () => void;
};

export function ToolMembersModal({
  visible,
  eventId,
  toolId,
  currentUserId,
  onClose,
  onChanged,
}: Props) {
  const { t } = useTranslation();
  const [participants, setParticipants] = useState<ParticipantEntry[]>([]);
  const [members, setMembers] = useState<ToolMemberEntry[]>([]);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([
        listParticipants(eventId),
        listToolMembers(toolId),
      ]);
      setParticipants(p);
      setMembers(m);
    } catch {
      setParticipants([]);
      setMembers([]);
    }
  }, [eventId, toolId]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const memberIds = useMemo(
    () => new Set(members.map((m) => m.user_id)),
    [members],
  );

  const allSelected = useMemo(
    () =>
      participants.length > 0 &&
      participants.every((p) => memberIds.has(p.user_id)),
    [participants, memberIds],
  );

  const toggle = async (userId: string) => {
    const isMember = memberIds.has(userId);
    setBusyUserId(userId);
    try {
      if (isMember) {
        if (userId === currentUserId) return;
        await removeToolMember(toolId, userId);
      } else {
        await addToolMember(toolId, userId);
      }
      await load();
      onChanged?.();
    } finally {
      setBusyUserId(null);
    }
  };

  const bulkToggle = async () => {
    setBulkBusy(true);
    try {
      if (allSelected) {
        for (const p of participants) {
          if (p.user_id === currentUserId) continue;
          if (memberIds.has(p.user_id))
            await removeToolMember(toolId, p.user_id);
        }
      } else {
        for (const p of participants) {
          if (!memberIds.has(p.user_id)) await addToolMember(toolId, p.user_id);
        }
      }
      await load();
      onChanged?.();
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/40 items-center justify-center px-4"
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-background rounded-2xl p-5"
          style={{ maxHeight: "90%" }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text variant="h2" className="mb-1">
              {t("toolMembers.title")}
            </Text>
            <Text variant="caption" className="mb-4">
              {t("toolMembers.subtitle")}
            </Text>

            {participants.length === 0 ? (
              <Text variant="caption" className="mb-4">
                {t("toolMembers.empty")}
              </Text>
            ) : (
              <>
                <Pressable
                  onPress={bulkToggle}
                  disabled={bulkBusy}
                  className="flex-row items-center justify-between py-2 mb-2 px-3 rounded-lg"
                  style={{
                    backgroundColor: "#EEECFC",
                    opacity: bulkBusy ? 0.5 : 1,
                  }}
                >
                  <Text
                    variant="label"
                    style={{ color: "#6050DC", fontWeight: "700" }}
                  >
                    {allSelected
                      ? t("toolMembers.deselectAll")
                      : t("toolMembers.selectAll")}
                  </Text>
                  <Text
                    variant="label"
                    style={{ color: "#6050DC", fontWeight: "700" }}
                  >
                    {allSelected ? "☑" : "☐"}
                  </Text>
                </Pressable>

                <View className="mb-5">
                  {participants.map((p) => {
                    const isSelf = p.user_id === currentUserId;
                    const checked = memberIds.has(p.user_id);
                    const busy = busyUserId === p.user_id;
                    return (
                      <Pressable
                        key={p.user_id}
                        onPress={() => (!isSelf ? toggle(p.user_id) : null)}
                        disabled={isSelf || busy}
                        className="flex-row items-center py-2.5"
                        style={{ opacity: busy ? 0.5 : 1 }}
                      >
                        <Avatar
                          src={p.avatar_url ?? undefined}
                          initials={initialsOf(p.full_name)}
                          size="sm"
                          className="mr-3"
                        />
                        <View className="flex-1 pr-2">
                          <Text numberOfLines={1}>{p.full_name ?? "?"}</Text>
                          <Text variant="caption">
                            {t(`roles.${p.role_code}`, {
                              defaultValue: p.role_code,
                            })}
                          </Text>
                        </View>
                        <View
                          className="items-center justify-center"
                          style={{
                            width: 28,
                            height: 28,
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
                                fontSize: 16,
                                fontWeight: "900",
                                lineHeight: 18,
                              }}
                            >
                              ✓
                            </Text>
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            <Button
              variant="ghost"
              label={t("toolMembers.close")}
              onPress={onClose}
            />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
