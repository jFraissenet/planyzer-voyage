import { Pressable, ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ScreenHeader, Text } from "@/components/ui";
import type { EventTool } from "@/lib/events";

export type ToolProps = {
  tool: EventTool;
  participantCount: number;
  onBack: () => void;
  isToolAdmin: boolean;
  onManageMembers: () => void;
  onEdit?: () => void;
};

export function ToolShell({
  tool,
  participantCount,
  onBack,
  isToolAdmin,
  onManageMembers,
  onEdit,
  children,
}: ToolProps & { children?: React.ReactNode }) {
  const { t } = useTranslation();
  const typeLabel = t(`tools.${tool.event_tool_type_code}.name`, {
    defaultValue: tool.event_tool_type_code,
  });
  const isRestricted = tool.event_tool_visibility === "restricted";
  const canManage = isToolAdmin && isRestricted;
  const showWarning = canManage && participantCount <= 1;

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={tool.event_tool_name}
        subtitle={typeLabel}
        onBack={onBack}
        onTitlePress={isToolAdmin && onEdit ? onEdit : undefined}
        actionLabel={t("events.editTool.action")}
      />
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 120 }}>
        <View
          className="flex-row items-center flex-wrap mb-6"
          style={{ gap: 6 }}
        >
          <View
            className="px-2.5 py-1 rounded-full"
            style={{ backgroundColor: "#EEECFC" }}
          >
            <Text
              style={{
                color: "#6050DC",
                fontWeight: "700",
                fontSize: 12,
              }}
            >
              {t("toolDetail.participants", { count: participantCount })}
            </Text>
          </View>
          {!isRestricted ? (
            <View
              className="px-2.5 py-1 rounded-full"
              style={{ backgroundColor: "#EEECFC" }}
            >
              <Text
                style={{
                  color: "#6050DC",
                  fontWeight: "700",
                  fontSize: 12,
                }}
              >
                🌍 {t("toolDetail.publicInfoTitle")}
              </Text>
            </View>
          ) : null}
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
    </View>
  );
}
