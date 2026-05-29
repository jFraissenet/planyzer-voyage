import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AvatarStack, ScreenHeader, Text } from "@/components/ui";
import type { EventTool, ToolParticipant } from "@/lib/events";
import type { MyEventTeam } from "@/lib/teams";
import { useTutorial } from "@/lib/tutorials/TutorialContext";
import { theme } from "@/lib/theme";
import { TeamMembersListModal } from "./teams/TeamMembersListModal";

export type ToolProps = {
  tool: EventTool;
  participants: ToolParticipant[];
  accessTeams?: MyEventTeam[];
  onBack: () => void;
  isToolAdmin: boolean;
  onManageMembers: () => void;
  onEdit?: () => void;
};

export function ToolShell({
  tool,
  participants,
  accessTeams = [],
  onBack,
  isToolAdmin,
  onManageMembers,
  onEdit,
  headerActions,
  children,
}: ToolProps & {
  headerActions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const typeLabel = t(`tools.${tool.event_tool_type_code}.name`, {
    defaultValue: tool.event_tool_type_code,
  });
  const isRestricted = tool.event_tool_visibility === "restricted";
  const isTeams = tool.event_tool_visibility === "teams";
  const isPublic = tool.event_tool_visibility === "all";
  const canManage = isToolAdmin && isRestricted;
  const showWarning = canManage && participants.length <= 1;
  const [viewerOpen, setViewerOpen] = useState(false);
  const openViewer = () => setViewerOpen(true);
  const handleAvatarPress = canManage ? onManageMembers : openViewer;
  const { openPrompt } = useTutorial();

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={tool.event_tool_name}
        subtitle={typeLabel}
        onBack={onBack}
        onTitlePress={isToolAdmin && onEdit ? onEdit : undefined}
        actionLabel={t("events.editTool.action")}
        onSecondaryAction={openPrompt}
        secondaryActionIcon="help-circle-outline"
        secondaryActionLabel="Tutoriel"
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 5,
          paddingTop: 5,
          paddingBottom: 120,
        }}
      >
        <View
          className="flex-row items-center flex-wrap mb-6"
          style={{ gap: 6 }}
        >
          <AvatarStack
            participants={participants.map((p) => ({
              id: p.user_id,
              full_name: p.full_name,
              avatar_url: p.avatar_url,
            }))}
            onPress={handleAvatarPress}
          />
          {isPublic ? (
            <Pressable
              onPress={openViewer}
              className="px-2.5 py-1 rounded-full active:opacity-70"
              style={{ backgroundColor: theme.primarySoft }}
            >
              <Text
                style={{
                  color: theme.primary,
                  fontWeight: "700",
                  fontSize: 12,
                }}
              >
                🌍 {t("toolDetail.publicInfoTitle")}
              </Text>
            </Pressable>
          ) : null}
          {isTeams
            ? accessTeams.map((tm) => (
                <Pressable
                  key={tm.team_id}
                  onPress={openViewer}
                  className="flex-row items-center px-2.5 py-1 rounded-full active:opacity-70"
                  style={{ backgroundColor: `${tm.color}22` }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: tm.color,
                      marginRight: 6,
                    }}
                  />
                  <Text
                    style={{
                      color: tm.color,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    {tm.name}
                  </Text>
                </Pressable>
              ))
            : null}
          {canManage ? (
            <Pressable
              onPress={onManageMembers}
              className="px-2.5 py-1 rounded-full"
              style={{ backgroundColor: "#FEF3C7" }}
            >
              <Text
                style={{
                  color: "#78350F",
                  fontWeight: "700",
                  fontSize: 12,
                }}
              >
                {t("toolDetail.manageMembers")}
              </Text>
            </Pressable>
          ) : null}
          {headerActions}
        </View>

        {showWarning ? (
          <View
            className="rounded-2xl p-4 mb-6"
            style={{
              backgroundColor: "#FEF3C7",
              borderWidth: 1,
              borderColor: "#FDE68A",
            }}
          >
            <Text
              variant="label"
              className="mb-1"
              style={{ color: "#78350F", fontSize: 14 }}
            >
              🔒 {t("toolDetail.restrictedWarningTitle")}
            </Text>
            <Text
              variant="caption"
              className="mb-3"
              style={{ color: "#78350F" }}
            >
              {t("toolDetail.restrictedWarningBody")}
            </Text>
            <Pressable
              onPress={onManageMembers}
              className="self-start px-3 py-1.5 rounded-full"
              style={{ backgroundColor: "#78350F" }}
            >
              <Text
                variant="label"
                style={{ color: "#FFFFFF", fontWeight: "700" }}
              >
                {t("toolDetail.restrictedWarningCTA")}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {children}
      </ScrollView>

      <TeamMembersListModal
        visible={viewerOpen}
        title={tool.event_tool_name}
        members={participants.map((p) => ({
          user_id: p.user_id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
        }))}
        onClose={() => setViewerOpen(false)}
      />
    </View>
  );
}
