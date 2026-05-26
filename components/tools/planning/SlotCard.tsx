import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Avatar, Card, Text } from "@/components/ui";
import type { PlanningSlot, PlanningSlotLink } from "@/lib/planning";
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

function firstName(full: string | null): string {
  if (!full) return "?";
  return full.trim().split(/\s+/)[0];
}

function formatTime(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function linkIcon(
  link: PlanningSlotLink,
): React.ComponentProps<typeof Ionicons>["name"] {
  if (link.kind === "tool") return "open-outline";
  switch (link.target_tool_type_code) {
    case "meals":
      return "restaurant-outline";
    case "car_sharing":
      return "car-outline";
    case "proposals":
      return "ballot-outline" as React.ComponentProps<typeof Ionicons>["name"];
    case "notes":
      return "document-text-outline";
    case "teams":
      return "people-outline";
    default:
      return "link-outline";
  }
}

type Props = {
  slot: PlanningSlot;
  locale: string;
  canEdit: boolean;
  onOpen: () => void;
  onEdit: () => void;
};

export function SlotCard({ slot, locale, canEdit, onOpen, onEdit }: Props) {
  const { t } = useTranslation();
  const timeLabel = slot.has_time
    ? slot.ends_at
      ? `${formatTime(slot.starts_at, locale)} → ${formatTime(slot.ends_at, locale)}`
      : formatTime(slot.starts_at, locale)
    : t("planning.allDay");

  return (
    <Card className="mb-3 overflow-hidden p-0">
      <Pressable onPress={onOpen} className="active:opacity-90">
        <View className="p-3">
          <View className="flex-row items-start mb-1" style={{ gap: 6 }}>
            <View
              className="rounded-full px-2 py-0.5"
              style={{ backgroundColor: theme.primarySoft }}
            >
              <Text
                style={{
                  color: theme.primaryDeep,
                  fontSize: 11,
                  fontWeight: "700",
                }}
              >
                {timeLabel}
              </Text>
            </View>
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontSize: 15,
                fontWeight: "700",
                color: "#1A1A1A",
              }}
            >
              {slot.title}
            </Text>
            {canEdit ? (
              <Pressable
                onPress={onEdit}
                hitSlop={8}
                className="items-center justify-center rounded-full active:opacity-70"
                style={{
                  width: 26,
                  height: 26,
                  backgroundColor: theme.primarySoft,
                }}
              >
                <Ionicons name="pencil" size={12} color={theme.primary} />
              </Pressable>
            ) : null}
          </View>

          {slot.description ? (
            <Text
              variant="caption"
              numberOfLines={2}
              className="mb-2"
              style={{ color: "#6B6B6B" }}
            >
              {slot.description}
            </Text>
          ) : null}

          {slot.location ? (
            <View
              className="flex-row items-center mb-2"
              style={{ gap: 4 }}
            >
              <Ionicons name="location-outline" size={12} color="#6B6B6B" />
              <Text
                variant="caption"
                numberOfLines={1}
                style={{ flex: 1, fontSize: 12, color: "#6B6B6B" }}
              >
                {slot.location}
              </Text>
            </View>
          ) : null}

          {slot.links.length > 0 ? (
            <View
              className="flex-row flex-wrap mb-2"
              style={{ gap: 6 }}
            >
              {slot.links.map((l) => (
                <View
                  key={l.id}
                  className="flex-row items-center px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "#F3F0FA", gap: 4 }}
                >
                  <Ionicons
                    name={linkIcon(l)}
                    size={11}
                    color={theme.primary}
                  />
                  <Text
                    style={{
                      color: theme.primaryDeep,
                      fontSize: 11,
                      fontWeight: "600",
                    }}
                    numberOfLines={1}
                  >
                    {l.target_label ?? l.target_tool_name}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <View
            className="flex-row items-center justify-between"
            style={{ gap: 8 }}
          >
            {slot.participants.length > 0 ? (
              <View
                className="flex-row items-center"
                style={{ gap: -6, flex: 1 }}
              >
                {slot.participants.slice(0, 4).map((p, idx) => (
                  <View
                    key={p.user_id}
                    style={{
                      marginLeft: idx === 0 ? 0 : -6,
                      borderWidth: 2,
                      borderColor: "#FFFFFF",
                      borderRadius: 999,
                    }}
                  >
                    <Avatar
                      src={p.avatar_url ?? undefined}
                      initials={initialsOf(p.full_name)}
                      size="xs"
                    />
                  </View>
                ))}
                {slot.participants.length > 4 ? (
                  <Text
                    variant="caption"
                    style={{ fontSize: 11, marginLeft: 4 }}
                  >
                    +{slot.participants.length - 4}
                  </Text>
                ) : null}
              </View>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <Text variant="caption" style={{ fontSize: 11 }}>
              {t("planning.byAuthor", {
                name: firstName(slot.author_full_name),
              })}
            </Text>
          </View>
        </View>
      </Pressable>
    </Card>
  );
}
