import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { AvatarStack, Text } from "@/components/ui";
import {
  listEventToolTeams,
  type EventToolTeam,
} from "@/lib/teams";
import { theme } from "@/lib/theme";
import { ToolShell, type ToolProps } from "../ToolShell";
import { EditTeamModal } from "./EditTeamModal";

function formatRange(team: EventToolTeam, locale: string): string | null {
  if (!team.starts_at) return null;
  const start = new Date(team.starts_at);
  const end = team.ends_at ? new Date(team.ends_at) : null;
  const dateOpts: Intl.DateTimeFormatOptions = team.has_time
    ? { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }
    : { weekday: "short", day: "2-digit", month: "short" };
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

function TeamCard({
  team,
  locale,
  onPress,
}: {
  team: EventToolTeam;
  locale: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const range = formatRange(team, locale);
  const plannings = team.planning_tool_ids.length;
  return (
    <Pressable
      onPress={onPress}
      className="active:opacity-70 mb-3 rounded-2xl p-4"
      style={{
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E8E3DB",
      }}
    >
      <View className="flex-row items-center mb-2" style={{ gap: 10 }}>
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: team.color,
          }}
        />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: "#1A1A1A",
            }}
            numberOfLines={1}
          >
            {team.name}
          </Text>
          {team.type ? (
            <Text variant="caption" style={{ fontSize: 11 }}>
              {team.type}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={16} color="#A3A3A3" />
      </View>

      <View className="flex-row items-center flex-wrap" style={{ gap: 8 }}>
        <AvatarStack
          participants={team.members.map((m) => ({
            id: m.user_id,
            full_name: m.full_name,
            avatar_url: m.avatar_url,
          }))}
          maxMobile={5}
          maxDesktop={8}
        />
        {range ? (
          <View
            className="flex-row items-center px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: "#F3F0FA",
              gap: 4,
            }}
          >
            <Ionicons name="time-outline" size={11} color="#6B7280" />
            <Text style={{ fontSize: 11, color: "#6B7280" }}>{range}</Text>
          </View>
        ) : null}
        {plannings > 0 ? (
          <View
            className="flex-row items-center px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: theme.primarySoft,
              gap: 4,
            }}
          >
            <Ionicons
              name="calendar-outline"
              size={11}
              color={theme.primary}
            />
            <Text
              style={{
                fontSize: 11,
                color: theme.primary,
                fontWeight: "700",
              }}
            >
              {t("teams.linkedCount", { count: plannings })}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export function TeamsTool(props: ToolProps) {
  const { t, i18n } = useTranslation();

  const [teams, setTeams] = useState<EventToolTeam[]>([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EventToolTeam | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await listEventToolTeams(props.tool.event_tool_id);
      setTeams(list);
    } catch {
      setTeams([]);
    }
  }, [props.tool.event_tool_id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaved = () => {
    setCreating(false);
    setEditing(null);
    void load();
  };

  const eventId = props.tool.event_tool_event_id;

  const sorted = useMemo(() => teams, [teams]);

  return (
    <>
      <ToolShell {...props}>
        <View className="flex-row items-center justify-end mb-4">
          <Pressable
            onPress={() => setCreating(true)}
            accessibilityLabel={t("teams.add")}
            className="rounded-full items-center justify-center active:opacity-80"
            style={{
              width: 36,
              height: 36,
              backgroundColor: theme.primary,
            }}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        {sorted.length === 0 ? (
          <View className="py-10 items-center">
            <Ionicons
              name="people-outline"
              size={28}
              color="#9CA3AF"
              style={{ marginBottom: 8 }}
            />
            <Text variant="caption" className="text-center">
              {t("teams.empty")}
            </Text>
          </View>
        ) : (
          sorted.map((team) => (
            <TeamCard
              key={team.team_id}
              team={team}
              locale={i18n.language}
              onPress={() => setEditing(team)}
            />
          ))
        )}
      </ToolShell>

      <EditTeamModal
        mode="create"
        visible={creating}
        toolId={props.tool.event_tool_id}
        eventId={eventId}
        onClose={() => setCreating(false)}
        onSaved={handleSaved}
      />

      <EditTeamModal
        mode="edit"
        visible={!!editing}
        toolId={props.tool.event_tool_id}
        eventId={eventId}
        existing={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSaved={handleSaved}
      />
    </>
  );
}
