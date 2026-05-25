import { useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Avatar, Text } from "@/components/ui";
import type { ParticipantEntry } from "@/lib/events";
import { theme } from "@/lib/theme";

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

function normalize(s: string | null): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

type Props = {
  participants: ParticipantEntry[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

export function MemberMultiSelect({
  participants,
  selectedIds,
  onChange,
}: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return participants;
    return participants.filter((p) => normalize(p.full_name).includes(q));
  }, [participants, query]);

  const allSelected =
    participants.length > 0 && selectedIds.length === participants.length;

  const toggle = (userId: string) => {
    if (selectedSet.has(userId)) {
      onChange(selectedIds.filter((id) => id !== userId));
    } else {
      onChange([...selectedIds, userId]);
    }
  };

  const toggleAll = () => {
    if (allSelected) onChange([]);
    else onChange(participants.map((p) => p.user_id));
  };

  return (
    <View style={{ gap: 8 }}>
      <View className="flex-row items-center justify-between">
        <Text variant="label">
          {t("teams.membersSelected", { count: selectedIds.length })}
        </Text>
        {participants.length > 0 ? (
          <Pressable
            onPress={toggleAll}
            hitSlop={6}
            className="active:opacity-70"
          >
            <Text
              style={{
                color: theme.primary,
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              {allSelected ? t("teams.deselectAll") : t("teams.selectAll")}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {participants.length === 0 ? (
        <Text variant="caption" style={{ fontSize: 12 }}>
          {t("teams.membersEmpty")}
        </Text>
      ) : (
        <>
          <View
            className="flex-row items-center rounded-xl px-3"
            style={{
              backgroundColor: "#FFFFFF",
              borderWidth: 1,
              borderColor: "#E8E3DB",
            }}
          >
            <Ionicons name="search" size={14} color="#9CA3AF" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("teams.searchMembersPlaceholder")}
              placeholderTextColor="#9CA3AF"
              style={{
                flex: 1,
                fontSize: 14,
                paddingVertical: 8,
                paddingHorizontal: 8,
                color: "#1A1A1A",
              }}
            />
            {query ? (
              <Pressable onPress={() => setQuery("")} hitSlop={6}>
                <Ionicons name="close-circle" size={14} color="#9CA3AF" />
              </Pressable>
            ) : null}
          </View>

          <View
            className="rounded-xl"
            style={{
              backgroundColor: "#FFFFFF",
              borderWidth: 1,
              borderColor: "#E8E3DB",
              maxHeight: 220,
            }}
          >
            <ScrollView keyboardShouldPersistTaps="handled">
              {filtered.length === 0 ? (
                <Text
                  variant="caption"
                  className="text-center py-4"
                  style={{ fontSize: 12 }}
                >
                  {t("teams.searchEmpty")}
                </Text>
              ) : (
                filtered.map((p) => {
                  const checked = selectedSet.has(p.user_id);
                  return (
                    <Pressable
                      key={p.user_id}
                      onPress={() => toggle(p.user_id)}
                      className="flex-row items-center px-3 py-2 active:opacity-70"
                      style={{ gap: 10 }}
                    >
                      <Avatar
                        src={p.avatar_url ?? undefined}
                        initials={initialsOf(p.full_name)}
                        size="xs"
                      />
                      <Text style={{ flex: 1, fontSize: 14 }} numberOfLines={1}>
                        {p.full_name ?? "?"}
                      </Text>
                      <View
                        className="items-center justify-center"
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          borderWidth: checked ? 0 : 1.5,
                          borderColor: "#E8E3DB",
                          backgroundColor: checked
                            ? theme.primary
                            : "#FFFFFF",
                        }}
                      >
                        {checked ? (
                          <Text
                            style={{
                              color: "#FFFFFF",
                              fontSize: 13,
                              fontWeight: "900",
                              lineHeight: 15,
                            }}
                          >
                            ✓
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
}
