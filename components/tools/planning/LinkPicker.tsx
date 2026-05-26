import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui";
import { listVehicles } from "@/lib/carpool";
import { listEventTools, type EventTool } from "@/lib/events";
import { listEventToolMealRecipes } from "@/lib/meals";
import { listEventToolNotes } from "@/lib/notes";
import { listEventToolTeams } from "@/lib/teams";
import {
  itemKindForToolType,
  PLANNING_LINKABLE_TOOL_TYPES,
  type PlanningLinkKind,
} from "@/lib/planning";
import { listEventToolProposals } from "@/lib/proposals";
import { theme } from "@/lib/theme";

// Shape of the link the picker emits. Consumed by SlotEditModal which
// appends it to the slot's draft links array.
export type PickedLink = {
  target_tool_id: string;
  target_tool_name: string;
  target_tool_type_code: string;
  kind: PlanningLinkKind;
  target_id: string | null;
  target_label: string;
};

type Props = {
  visible: boolean;
  eventId: string;
  // Tool ids that already have at least one link from this slot — used to
  // grey out "tool-level" links to avoid duplicate (slot+tool) entries.
  alreadyLinkedToolIds?: string[];
  // Slot's own planning tool id, excluded from the picker.
  excludeToolId: string;
  onClose: () => void;
  onPick: (link: PickedLink) => void;
};

type Item = { id: string; label: string };

async function fetchItems(tool: EventTool): Promise<Item[]> {
  switch (tool.event_tool_type_code) {
    case "meals": {
      const list = await listEventToolMealRecipes(tool.event_tool_id);
      return list.map((r) => ({ id: r.recipe_id, label: r.title }));
    }
    case "car_sharing": {
      const list = await listVehicles(tool.event_tool_id);
      return list.map((v) => ({
        id: v.vehicle_id,
        label: v.description ?? `Véhicule ${v.vehicle_id.slice(0, 4)}`,
      }));
    }
    case "proposals": {
      const list = await listEventToolProposals(tool.event_tool_id);
      return list.map((p) => ({ id: p.proposal_id, label: p.title }));
    }
    case "notes": {
      const list = await listEventToolNotes(tool.event_tool_id);
      return list.map((n) => ({
        id: n.note_id,
        label: n.text.length > 60 ? n.text.slice(0, 60) + "…" : n.text,
      }));
    }
    case "teams": {
      const list = await listEventToolTeams(tool.event_tool_id);
      return list.map((tm) => ({ id: tm.team_id, label: tm.name }));
    }
    default:
      return [];
  }
}

export function LinkPicker({
  visible,
  eventId,
  excludeToolId,
  onClose,
  onPick,
}: Props) {
  const { t } = useTranslation();
  const [tools, setTools] = useState<EventTool[]>([]);
  const [selectedTool, setSelectedTool] = useState<EventTool | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  const loadTools = useCallback(async () => {
    setLoadingTools(true);
    try {
      const list = await listEventTools(eventId);
      // Keep only tool types that the planning supports linking to, and
      // exclude the planning tool itself.
      const filtered = list.filter(
        (tt) =>
          tt.event_tool_id !== excludeToolId
          && PLANNING_LINKABLE_TOOL_TYPES.includes(
            tt.event_tool_type_code as (typeof PLANNING_LINKABLE_TOOL_TYPES)[number],
          ),
      );
      setTools(filtered);
    } catch {
      setTools([]);
    } finally {
      setLoadingTools(false);
    }
  }, [eventId, excludeToolId]);

  useEffect(() => {
    if (!visible) return;
    setSelectedTool(null);
    setItems([]);
    void loadTools();
  }, [visible, loadTools]);

  // Load items whenever the selected tool changes.
  useEffect(() => {
    if (!selectedTool) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoadingItems(true);
    fetchItems(selectedTool)
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingItems(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTool]);

  const pickWholeTool = (tool: EventTool) => {
    onPick({
      target_tool_id: tool.event_tool_id,
      target_tool_name: tool.event_tool_name,
      target_tool_type_code: tool.event_tool_type_code,
      kind: "tool",
      target_id: null,
      target_label: tool.event_tool_name,
    });
  };

  const pickItem = (item: Item) => {
    if (!selectedTool) return;
    const kind = itemKindForToolType(selectedTool.event_tool_type_code);
    if (!kind) return;
    onPick({
      target_tool_id: selectedTool.event_tool_id,
      target_tool_name: selectedTool.event_tool_name,
      target_tool_type_code: selectedTool.event_tool_type_code,
      kind,
      target_id: item.id,
      target_label: item.label,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 justify-end"
        style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-surface rounded-t-2xl"
          style={{ maxHeight: "85%" }}
        >
          <View
            className="flex-row items-center justify-between px-5 pt-5 pb-3"
            style={{ borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}
          >
            {selectedTool ? (
              <Pressable
                onPress={() => setSelectedTool(null)}
                hitSlop={6}
                className="flex-row items-center"
                style={{ gap: 4 }}
              >
                <Ionicons name="chevron-back" size={18} color={theme.primary} />
                <Text variant="label" style={{ fontSize: 13, color: theme.primary }}>
                  {selectedTool.event_tool_name}
                </Text>
              </Pressable>
            ) : (
              <Text variant="label" style={{ fontSize: 17, fontWeight: "700" }}>
                {t("planning.linkPickerTitle")}
              </Text>
            )}
            <Pressable
              onPress={onClose}
              hitSlop={8}
              className="rounded-full items-center justify-center"
              style={{
                width: 28,
                height: 28,
                backgroundColor: "#F3F4F6",
              }}
            >
              <Ionicons name="close" size={16} color="#6B7280" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
            {!selectedTool ? (
              <>
                <Text variant="caption" className="mb-3">
                  {t("planning.linkPickerToolStep")}
                </Text>
                {loadingTools ? (
                  <View className="py-8 items-center">
                    <ActivityIndicator color={theme.primary} />
                  </View>
                ) : tools.length === 0 ? (
                  <Text
                    variant="caption"
                    className="text-center"
                    style={{ color: "#6B7280", paddingVertical: 24 }}
                  >
                    {t("planning.linkPickerNoTools")}
                  </Text>
                ) : (
                  tools.map((tool) => (
                    <Pressable
                      key={tool.event_tool_id}
                      onPress={() => setSelectedTool(tool)}
                      className="flex-row items-center p-3 mb-2 rounded-lg border bg-surface border-border active:opacity-70"
                      style={{ gap: 10 }}
                    >
                      <View
                        className="rounded-lg items-center justify-center"
                        style={{
                          width: 36,
                          height: 36,
                          backgroundColor: theme.primarySoft,
                        }}
                      >
                        <Ionicons
                          name="cube-outline"
                          size={18}
                          color={theme.primary}
                        />
                      </View>
                      <View className="flex-1">
                        <Text style={{ fontSize: 14, color: "#1A1A1A", fontWeight: "600" }}>
                          {tool.event_tool_name}
                        </Text>
                        <Text variant="caption" style={{ fontSize: 11 }}>
                          {t(`tools.${tool.event_tool_type_code}.name`, {
                            defaultValue: tool.event_tool_type_code,
                          })}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color="#9CA3AF"
                      />
                    </Pressable>
                  ))
                )}
              </>
            ) : (
              <>
                <Text variant="caption" className="mb-3">
                  {t("planning.linkPickerItemStep")}
                </Text>
                <Pressable
                  onPress={() => pickWholeTool(selectedTool)}
                  className="flex-row items-center p-3 mb-3 rounded-lg active:opacity-70"
                  style={{
                    backgroundColor: theme.primarySoft,
                    borderWidth: 1,
                    borderColor: theme.primary,
                    gap: 10,
                  }}
                >
                  <Ionicons
                    name="open-outline"
                    size={18}
                    color={theme.primary}
                  />
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 14,
                      color: theme.primaryDeep,
                      fontWeight: "700",
                    }}
                  >
                    {t("planning.linkPickerAllOfTool", {
                      name: selectedTool.event_tool_name,
                    })}
                  </Text>
                </Pressable>

                {loadingItems ? (
                  <View className="py-8 items-center">
                    <ActivityIndicator color={theme.primary} />
                  </View>
                ) : items.length === 0 ? (
                  <Text
                    variant="caption"
                    className="text-center"
                    style={{ color: "#6B7280", paddingVertical: 24 }}
                  >
                    {t("planning.linkPickerNoItems")}
                  </Text>
                ) : (
                  items.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => pickItem(item)}
                      className="flex-row items-center p-3 mb-2 rounded-lg border bg-surface border-border active:opacity-70"
                      style={{ gap: 10 }}
                    >
                      <Ionicons
                        name="ellipse-outline"
                        size={14}
                        color={theme.primary}
                      />
                      <Text
                        style={{ flex: 1, fontSize: 14, color: "#1A1A1A" }}
                        numberOfLines={2}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  ))
                )}
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
