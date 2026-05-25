import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { AvatarStack, Text } from "@/components/ui";
import {
  listEventPlanningTools,
  type EventPlanningTool,
  type EventToolTeam,
} from "@/lib/teams";
import { theme } from "@/lib/theme";
import { TeamMembersListModal } from "./TeamMembersListModal";

type Props = {
  visible: boolean;
  team: EventToolTeam | null;
  eventId: string;
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
};

function formatRange(team: EventToolTeam, locale: string): string | null {
  if (!team.starts_at) return null;
  const start = new Date(team.starts_at);
  const end = team.ends_at ? new Date(team.ends_at) : null;
  const dateOpts: Intl.DateTimeFormatOptions = team.has_time
    ? { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" }
    : { weekday: "long", day: "2-digit", month: "long" };
  try {
    const s = start.toLocaleString(locale, dateOpts);
    if (!end) return s;
    const sameDay =
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() &&
      start.getDate() === end.getDate();
    const e = sameDay && team.has_time
      ? end.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
      : end.toLocaleString(locale, dateOpts);
    return `${s} → ${e}`;
  } catch {
    return team.starts_at;
  }
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      variant="caption"
      className="mb-2 uppercase"
      style={{
        letterSpacing: 1.2,
        fontWeight: "700",
        fontSize: 11,
        color: theme.sectionLabel,
      }}
    >
      {children}
    </Text>
  );
}

export function TeamDetailModal({
  visible,
  team,
  eventId,
  canEdit,
  onClose,
  onEdit,
}: Props) {
  const { t, i18n } = useTranslation();
  const [planningTools, setPlanningTools] = useState<EventPlanningTool[]>([]);
  const [showMembers, setShowMembers] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setShowMembers(false);
    listEventPlanningTools(eventId)
      .then(setPlanningTools)
      .catch(() => setPlanningTools([]));
  }, [visible, eventId]);

  if (!team) return null;

  const range = formatRange(team, i18n.language);
  const linkedPlannings = planningTools.filter((p) =>
    team.planning_tool_ids.includes(p.tool_id),
  );

  return (
    <>
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
            className="w-full max-w-2xl bg-background rounded-2xl overflow-hidden"
            style={{ maxHeight: "92%" }}
          >
            <View
              className="flex-row items-center px-5 pt-5 pb-3"
              style={{
                borderBottomWidth: 1,
                borderBottomColor: "#E5E7EB",
                gap: 10,
              }}
            >
              <View
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: team.color,
                }}
              />
              <View style={{ flex: 1 }}>
                <Text variant="h2" numberOfLines={1}>
                  {team.name}
                </Text>
                {team.type ? (
                  <Text variant="caption" style={{ fontSize: 12 }}>
                    {team.type}
                  </Text>
                ) : null}
              </View>
              {canEdit ? (
                <Pressable
                  onPress={onEdit}
                  hitSlop={8}
                  className="rounded-full items-center justify-center"
                  style={{ width: 32, height: 32, backgroundColor: "#F3F4F6" }}
                  accessibilityLabel={t("teams.edit")}
                >
                  <Ionicons name="pencil" size={14} color={theme.primary} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={onClose}
                hitSlop={8}
                className="rounded-full items-center justify-center"
                style={{ width: 32, height: 32, backgroundColor: "#F3F4F6" }}
              >
                <Ionicons name="close" size={16} color="#6B7280" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}>
              {range ? (
                <View>
                  <SectionLabel>{t("teams.whenSection")}</SectionLabel>
                  <View
                    className="flex-row items-center"
                    style={{ gap: 6 }}
                  >
                    <Ionicons name="time-outline" size={14} color="#6B7280" />
                    <Text style={{ fontSize: 14, color: "#1A1A1A" }}>
                      {range}
                    </Text>
                  </View>
                </View>
              ) : null}

              <View>
                <SectionLabel>{`${t("teams.membersSection")} (${team.members.length})`}</SectionLabel>
                {team.members.length === 0 ? (
                  <Text variant="caption" style={{ fontSize: 12 }}>
                    {t("teams.membersEmpty")}
                  </Text>
                ) : (
                  <Pressable
                    onPress={() => setShowMembers(true)}
                    hitSlop={6}
                    className="active:opacity-70"
                  >
                    <AvatarStack
                      participants={team.members.map((m) => ({
                        id: m.user_id,
                        full_name: m.full_name,
                        avatar_url: m.avatar_url,
                      }))}
                      maxMobile={6}
                      maxDesktop={10}
                    />
                  </Pressable>
                )}
              </View>

              <View>
                <SectionLabel>{`${t("teams.planningsSection")} (${linkedPlannings.length})`}</SectionLabel>
                {linkedPlannings.length === 0 ? (
                  <Text variant="caption" style={{ fontSize: 12 }}>
                    {t("teams.noPlanningLinked")}
                  </Text>
                ) : (
                  <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {linkedPlannings.map((p) => (
                      <View
                        key={p.tool_id}
                        className="flex-row items-center px-2.5 py-1.5 rounded-full"
                        style={{
                          backgroundColor: theme.primarySoft,
                          gap: 6,
                        }}
                      >
                        <Ionicons
                          name="calendar-outline"
                          size={12}
                          color={theme.primary}
                        />
                        <Text
                          style={{
                            fontSize: 12,
                            color: theme.primary,
                            fontWeight: "700",
                          }}
                        >
                          {p.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <TeamMembersListModal
        visible={showMembers}
        title={team.name}
        members={team.members}
        onClose={() => setShowMembers(false)}
      />
    </>
  );
}
