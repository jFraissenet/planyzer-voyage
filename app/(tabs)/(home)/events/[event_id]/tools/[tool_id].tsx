import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { EditToolModal } from "@/components/EditToolModal";
import { ToolMembersModal } from "@/components/ToolMembersModal";
import { getToolComponent } from "@/components/tools";
import { ScreenHeader, Text } from "@/components/ui";
import {
  getEventTool,
  getToolParticipantCount,
  isToolAdmin as isToolAdminApi,
  type EventTool,
} from "@/lib/events";
import { useSession } from "@/lib/useSession";

export default function ToolDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useSession();
  const currentUserId = session?.user?.id ?? "";
  const { tool_id, event_id } = useLocalSearchParams<{
    tool_id: string;
    event_id: string;
  }>();
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(`/events/${event_id}`);
  };

  const [tool, setTool] = useState<EventTool | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [membersOpen, setMembersOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const refreshCount = useCallback(async () => {
    if (!tool) return;
    try {
      const c = await getToolParticipantCount(tool);
      setParticipantCount(c);
    } catch {
      // ignore
    }
  }, [tool]);

  useEffect(() => {
    if (!tool_id) return;
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const fetched = await getEventTool(tool_id);
        if (!active) return;
        setTool(fetched);
        if (fetched) {
          const [c, admin] = await Promise.all([
            getToolParticipantCount(fetched),
            isToolAdminApi(fetched.event_tool_id),
          ]);
          if (active) {
            setParticipantCount(c);
            setIsAdmin(admin);
          }
        }
      } catch {
        if (active) setTool(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [tool_id]);

  if (loading) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title={t("events.detail.loading")} onBack={goBack} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </View>
    );
  }

  if (!tool) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title={t("common.error")} onBack={goBack} />
        <View className="flex-1 items-center justify-center">
          <Text variant="caption">{t("common.error")}</Text>
        </View>
      </View>
    );
  }

  const Component = getToolComponent(tool.event_tool_type_code);
  if (!Component) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title={tool.event_tool_name} onBack={goBack} />
        <View className="flex-1 items-center justify-center">
          <Text variant="caption">Unsupported tool type</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <Component
        tool={tool}
        participantCount={participantCount}
        onBack={goBack}
        isToolAdmin={isAdmin}
        onManageMembers={() => setMembersOpen(true)}
        onEdit={() => setEditOpen(true)}
      />
      <ToolMembersModal
        visible={membersOpen}
        eventId={tool.event_tool_event_id}
        toolId={tool.event_tool_id}
        currentUserId={currentUserId}
        onClose={() => setMembersOpen(false)}
        onChanged={refreshCount}
      />
      <EditToolModal
        visible={editOpen}
        tool={tool}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          // Refetch tool to get updated name/visibility
          void (async () => {
            const updated = await getEventTool(tool.event_tool_id);
            if (updated) setTool(updated);
          })();
        }}
      />
    </>
  );
}
