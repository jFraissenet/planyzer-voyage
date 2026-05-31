import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { AvatarStack, FAB, Text } from "@/components/ui";
import {
  claimTeamResponsable,
  joinEventToolTeam,
  leaveEventToolTeam,
  listEventToolTeams,
  releaseTeamResponsable,
  type EventToolTeam,
} from "@/lib/teams";
import { useSession } from "@/lib/useSession";
import { theme } from "@/lib/theme";
import { ToolShell, type ToolProps } from "../ToolShell";
import { ToolEmptyBanner } from "../ToolEmptyBanner";
import { EditTeamModal } from "./EditTeamModal";
import { TeamDetailModal } from "./TeamDetailModal";
import { TeamMembersListModal } from "./TeamMembersListModal";

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
  canEdit,
  youAreIn,
  badgeLabel,
  currentUserId,
  onOpen,
  onEdit,
  onMembersPress,
  onJoin,
  onLeave,
  onClaim,
  onRelease,
}: {
  team: EventToolTeam;
  locale: string;
  canEdit: boolean;
  youAreIn: boolean;
  badgeLabel: string;
  currentUserId: string;
  onOpen: () => void;
  onEdit: () => void;
  onMembersPress: () => void;
  onJoin: () => void;
  onLeave: () => void;
  onClaim: () => void;
  onRelease: () => void;
}) {
  const { t } = useTranslation();
  const range = formatRange(team, locale);
  const plannings = team.planning_tool_ids.length;
  const isFull =
    team.max_members != null && team.members.length >= team.max_members;
  const isResponsable =
    !!team.responsable_id && team.responsable_id === currentUserId;
  const hasResponsable = !!team.responsable_id;
  return (
    <View className="relative mb-3">
      {youAreIn ? (
        <View
          accessibilityLabel={t("teams.yourTeamBadge")}
          style={{
            position: "absolute",
            top: -8,
            left: 10,
            zIndex: 10,
            paddingHorizontal: 7,
            paddingVertical: 2,
            borderRadius: 8,
            backgroundColor: theme.primary,
            borderWidth: 1.5,
            borderColor: "#FFFFFF",
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.35,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 11,
              fontWeight: "700",
              letterSpacing: 0.4,
            }}
          >
            {badgeLabel.toUpperCase()}
          </Text>
        </View>
      ) : null}
      <Pressable
        onPress={onOpen}
        className="active:opacity-70 rounded-2xl p-4"
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
        {canEdit ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            hitSlop={8}
            className="items-center justify-center"
            style={{ width: 32, height: 32 }}
          >
            <Ionicons name="pencil" size={16} color={theme.primary} />
          </Pressable>
        ) : null}
      </View>

      <View className="flex-row items-center flex-wrap" style={{ gap: 8 }}>
        {team.members.length > 0 ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onMembersPress();
            }}
            hitSlop={4}
            className="active:opacity-70"
          >
            <AvatarStack
              participants={team.members.map((m) => ({
                id: m.user_id,
                full_name: m.full_name,
                avatar_url: m.avatar_url,
              }))}
              maxMobile={5}
              maxDesktop={8}
            />
          </Pressable>
        ) : null}
        {range ? (
          <View
            className="flex-row items-center px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "#F3F0FA", gap: 4 }}
          >
            <Ionicons name="time-outline" size={11} color="#6B7280" />
            <Text style={{ fontSize: 11, color: "#6B7280" }}>{range}</Text>
          </View>
        ) : null}
        {plannings > 0 ? (
          <View
            className="flex-row items-center px-2 py-0.5 rounded-full"
            style={{ backgroundColor: theme.primarySoft, gap: 4 }}
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
        {team.max_members != null ? (
          <View
            className="flex-row items-center px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: isFull ? "#FEE2E2" : "#F3F0FA",
              gap: 4,
            }}
          >
            <Ionicons
              name="people-outline"
              size={11}
              color={isFull ? "#991B1B" : "#6B7280"}
            />
            <Text
              style={{
                fontSize: 11,
                color: isFull ? "#991B1B" : "#6B7280",
                fontWeight: isFull ? "700" : "500",
              }}
            >
              {isFull
                ? t("teams.placesFull")
                : t("teams.places", {
                    count: team.members.length,
                    max: team.max_members,
                  })}
            </Text>
          </View>
        ) : null}
        {team.responsable_full_name ? (
          <View
            className="flex-row items-center px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "#FEF3C7", gap: 4 }}
          >
            <Text style={{ fontSize: 11 }}>👑</Text>
            <Text
              style={{
                fontSize: 11,
                color: "#92400E",
                fontWeight: "700",
              }}
              numberOfLines={1}
            >
              {team.responsable_full_name}
            </Text>
          </View>
        ) : null}
      </View>

      {team.description ? (
        <Text
          variant="body"
          className="mt-3"
          style={{ fontSize: 13, color: "#4B4B4B", lineHeight: 18 }}
        >
          {team.description}
        </Text>
      ) : null}

      <View
        className="flex-row items-center mt-3"
        style={{ gap: 8, flexWrap: "wrap" }}
      >
        {youAreIn ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onLeave();
            }}
            className="px-3 py-1.5 rounded-full active:opacity-70"
            style={{ backgroundColor: "#F3F4F6" }}
          >
            <Text
              style={{ color: "#374151", fontSize: 12, fontWeight: "700" }}
            >
              {t("teams.leave")}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              if (!isFull) onJoin();
            }}
            disabled={isFull}
            className="px-3 py-1.5 rounded-full active:opacity-70"
            style={{
              backgroundColor: isFull ? "#E5E7EB" : theme.primary,
              opacity: isFull ? 0.6 : 1,
            }}
          >
            <Text
              style={{
                color: isFull ? "#6B7280" : "#FFFFFF",
                fontSize: 12,
                fontWeight: "700",
              }}
            >
              {isFull ? t("teams.placesFull") : t("teams.join")}
            </Text>
          </Pressable>
        )}
        {youAreIn && !hasResponsable ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onClaim();
            }}
            className="flex-row items-center px-3 py-1.5 rounded-full active:opacity-70"
            style={{ backgroundColor: "#F3F4F6", gap: 4 }}
          >
            <Text style={{ fontSize: 12 }}>👑</Text>
            <Text
              style={{ color: "#374151", fontSize: 12, fontWeight: "700" }}
            >
              {t("teams.claimResponsable")}
            </Text>
          </Pressable>
        ) : null}
        {isResponsable ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onRelease();
            }}
            className="px-3 py-1.5 rounded-full active:opacity-70"
            style={{ backgroundColor: "#F3F4F6" }}
          >
            <Text
              style={{ color: "#374151", fontSize: 12, fontWeight: "700" }}
            >
              {t("teams.releaseResponsable")}
            </Text>
          </Pressable>
        ) : null}
      </View>
      </Pressable>
    </View>
  );
}

export function TeamsTool(props: ToolProps) {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const currentUserId = session?.user?.id ?? "";

  // Custom "you're a member" badge label, configurable per tool (e.g. "Votre
  // chambre"). Falls back to the default "Votre équipe".
  const rawBadgeLabel = props.tool.event_tool_settings?.member_badge_label;
  const badgeLabel =
    typeof rawBadgeLabel === "string" && rawBadgeLabel.trim()
      ? rawBadgeLabel.trim()
      : t("teams.yourTeam");

  const [teams, setTeams] = useState<EventToolTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<EventToolTeam | null>(null);
  const [editing, setEditing] = useState<EventToolTeam | null>(null);
  const [membersOf, setMembersOf] = useState<EventToolTeam | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await listEventToolTeams(props.tool.event_tool_id);
      setTeams(list);
    } catch {
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, [props.tool.event_tool_id]);

  useEffect(() => {
    load();
  }, [load]);

  // Keep detail/editing in sync with the latest data after a save.
  useEffect(() => {
    if (detail) {
      const fresh = teams.find((tt) => tt.team_id === detail.team_id);
      if (fresh && fresh !== detail) setDetail(fresh);
    }
  }, [teams, detail]);

  const handleSaved = async () => {
    setCreating(false);
    setEditing(null);
    await load();
  };

  const handleEditFromDetail = () => {
    if (!detail) return;
    setEditing(detail);
    setDetail(null);
  };

  const eventId = props.tool.event_tool_event_id;

  const canEditTeam = (team: EventToolTeam): boolean =>
    team.author_id === currentUserId || props.isToolAdmin;

  return (
    <>
      <ToolShell {...props} loading={loading}>
        {teams.length === 0 ? (
          <ToolEmptyBanner
            title={t("teams.add")}
            subtitle={t("teams.empty")}
            onPress={() => setCreating(true)}
          />
        ) : (
          teams.map((team) => (
            <TeamCard
              key={team.team_id}
              team={team}
              locale={i18n.language}
              canEdit={canEditTeam(team)}
              youAreIn={team.members.some((m) => m.user_id === currentUserId)}
              badgeLabel={badgeLabel}
              currentUserId={currentUserId}
              onOpen={() => setDetail(team)}
              onEdit={() => setEditing(team)}
              onMembersPress={() => setMembersOf(team)}
              onJoin={async () => {
                try {
                  await joinEventToolTeam(team.team_id);
                  await load();
                } catch (err) {
                  // eslint-disable-next-line no-console
                  console.error("join team failed:", err);
                }
              }}
              onLeave={async () => {
                try {
                  await leaveEventToolTeam(team.team_id);
                  await load();
                } catch (err) {
                  // eslint-disable-next-line no-console
                  console.error("leave team failed:", err);
                }
              }}
              onClaim={async () => {
                try {
                  await claimTeamResponsable(team.team_id);
                  await load();
                } catch (err) {
                  // eslint-disable-next-line no-console
                  console.error("claim responsable failed:", err);
                }
              }}
              onRelease={async () => {
                try {
                  await releaseTeamResponsable(team.team_id);
                  await load();
                } catch (err) {
                  // eslint-disable-next-line no-console
                  console.error("release responsable failed:", err);
                }
              }}
            />
          ))
        )}
      </ToolShell>

      {teams.length > 0 ? (
        <FAB
          icon="add"
          onPress={() => setCreating(true)}
          accessibilityLabel={t("teams.add")}
        />
      ) : null}

      <TeamDetailModal
        visible={!!detail}
        team={detail}
        eventId={eventId}
        canEdit={detail ? canEditTeam(detail) : false}
        onClose={() => setDetail(null)}
        onEdit={handleEditFromDetail}
      />

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

      <TeamMembersListModal
        visible={!!membersOf}
        title={membersOf?.name ?? ""}
        members={membersOf?.members ?? []}
        onClose={() => setMembersOf(null)}
      />
    </>
  );
}
