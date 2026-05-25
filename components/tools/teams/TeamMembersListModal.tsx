import { Modal, Pressable, ScrollView, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Avatar, Text } from "@/components/ui";
import type { TeamMember } from "@/lib/teams";

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
  title: string;
  members: TeamMember[];
  onClose: () => void;
};

export function TeamMembersListModal({
  visible,
  title,
  members,
  onClose,
}: Props) {
  const { t } = useTranslation();
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
          className="w-full max-w-sm bg-background rounded-2xl overflow-hidden"
          style={{ maxHeight: "80%" }}
        >
          <View
            className="flex-row items-center justify-between px-5 pt-5 pb-3"
            style={{ borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}
          >
            <Text variant="h2" numberOfLines={1} style={{ flex: 1 }}>
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              className="rounded-full items-center justify-center"
              style={{ width: 32, height: 32, backgroundColor: "#F3F4F6" }}
            >
              <Ionicons name="close" size={16} color="#6B7280" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {members.length === 0 ? (
              <Text variant="caption" className="text-center py-4">
                {t("teams.membersEmpty")}
              </Text>
            ) : (
              members.map((m) => (
                <View
                  key={m.user_id}
                  className="flex-row items-center py-2"
                  style={{ gap: 10 }}
                >
                  <Avatar
                    src={m.avatar_url ?? undefined}
                    initials={initialsOf(m.full_name)}
                    size="sm"
                  />
                  <Text style={{ flex: 1, fontSize: 14 }} numberOfLines={1}>
                    {m.full_name ?? "?"}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
