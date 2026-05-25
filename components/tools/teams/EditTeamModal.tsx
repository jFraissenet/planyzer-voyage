import { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import {
  Button,
  DateTimeInput,
  Input,
  Text,
} from "@/components/ui";
import { listParticipants, type ParticipantEntry } from "@/lib/events";
import {
  deleteEventToolTeam,
  listEventPlanningTools,
  upsertEventToolTeam,
  type EventPlanningTool,
  type EventToolTeam,
} from "@/lib/teams";
import { theme } from "@/lib/theme";
import {
  isoToLocalInput,
  localInputToIso,
} from "../proposals/dateHelpers";
import { ColorPicker } from "./ColorPicker";
import { MemberMultiSelect } from "./MemberMultiSelect";

type Mode = "create" | "edit";

type Props = {
  mode: Mode;
  visible: boolean;
  toolId: string;
  eventId: string;
  existing?: EventToolTeam;
  onClose: () => void;
  onSaved: () => void;
};

export function EditTeamModal({
  mode,
  visible,
  toolId,
  eventId,
  existing,
  onClose,
  onSaved,
}: Props) {
  const { t } = useTranslation();

  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [color, setColor] = useState("#10B981");
  const [hasTime, setHasTime] = useState(true);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [planningIds, setPlanningIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [eventParticipants, setEventParticipants] = useState<ParticipantEntry[]>(
    [],
  );
  const [planningTools, setPlanningTools] = useState<EventPlanningTool[]>([]);

  useEffect(() => {
    if (!visible) return;
    setName(existing?.name ?? "");
    setType(existing?.type ?? "");
    setColor(existing?.color ?? "#10B981");
    setHasTime(existing?.has_time ?? true);
    setStartsAt(isoToLocalInput(existing?.starts_at ?? null));
    setEndsAt(isoToLocalInput(existing?.ends_at ?? null));
    setMemberIds(existing?.members.map((m) => m.user_id) ?? []);
    setPlanningIds(existing?.planning_tool_ids ?? []);
    setError(null);
    setBusy(false);

    listParticipants(eventId)
      .then(setEventParticipants)
      .catch(() => setEventParticipants([]));
    listEventPlanningTools(eventId)
      .then(setPlanningTools)
      .catch(() => setPlanningTools([]));
  }, [visible, existing, eventId]);

  const togglePlanning = (id: string) => {
    setPlanningIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const save = async () => {
    const nameTrim = name.trim();
    if (!nameTrim) {
      setError(t("teams.errorNameRequired"));
      return;
    }
    if (memberIds.length === 0) {
      setError(t("teams.errorMembersRequired"));
      return;
    }
    const startIso = localInputToIso(startsAt);
    const endIso = localInputToIso(endsAt);
    if (
      startIso &&
      endIso &&
      new Date(endIso).getTime() < new Date(startIso).getTime()
    ) {
      setError(t("teams.errorEndBeforeStart"));
      return;
    }
    if (planningIds.length > 0 && !startIso) {
      setError(t("teams.errorPlanningRequiresDate"));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await upsertEventToolTeam({
        team_id: mode === "edit" && existing ? existing.team_id : null,
        tool_id: toolId,
        name: nameTrim,
        type: type.trim() ? type.trim() : null,
        color,
        starts_at: startIso,
        ends_at: endIso,
        has_time: hasTime,
        member_ids: memberIds,
        planning_tool_ids: planningIds,
      });
      onSaved();
    } catch {
      setError(t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (!existing) return;
    const msg = t("teams.deleteConfirm");
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (window.confirm(msg)) void runDelete();
      return;
    }
    Alert.alert(msg, undefined, [
      { text: t("teams.cancel"), style: "cancel" },
      {
        text: t("teams.delete"),
        style: "destructive",
        onPress: () => runDelete(),
      },
    ]);
  };

  const runDelete = async () => {
    if (!existing) return;
    setBusy(true);
    try {
      await deleteEventToolTeam(existing.team_id);
      onSaved();
    } catch {
      setError(t("common.error"));
      setBusy(false);
    }
  };

  const titleLabel =
    mode === "create" ? t("teams.createTitle") : t("teams.editTitle");

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
          className="w-full max-w-2xl bg-background rounded-2xl overflow-hidden"
          style={{ maxHeight: "92%" }}
        >
          <View
            className="flex-row items-center justify-between px-5 pt-5 pb-3"
            style={{ borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}
          >
            <Text variant="h2">{titleLabel}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              className="rounded-full items-center justify-center"
              style={{ width: 32, height: 32, backgroundColor: "#F3F4F6" }}
            >
              <Ionicons name="close" size={16} color="#6B7280" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <Input
              label={t("teams.nameLabel")}
              placeholder={t("teams.namePlaceholder")}
              value={name}
              onChangeText={setName}
              autoFocus
              required
            />

            {/* Members — primary element, sits right under the name */}
            <MemberMultiSelect
              participants={eventParticipants}
              selectedIds={memberIds}
              onChange={setMemberIds}
            />

            <Input
              label={t("teams.typeLabel")}
              placeholder={t("teams.typePlaceholder")}
              value={type}
              onChangeText={setType}
            />

            <View style={{ gap: 8 }}>
              <Text variant="label">{t("teams.colorLabel")}</Text>
              <ColorPicker value={color} onChange={setColor} />
            </View>

            <View
              style={{
                height: 1,
                backgroundColor: "#F2EDE4",
                marginVertical: 4,
              }}
            />

            {/* Has-time toggle */}
            <Pressable
              onPress={() => setHasTime((v) => !v)}
              className="flex-row items-center justify-between"
              style={{ gap: 10 }}
            >
              <Text variant="label" style={{ flex: 1 }}>
                {t("teams.hasTimeLabel")}
              </Text>
              <View
                className="items-center justify-center rounded-full"
                style={{
                  width: 44,
                  height: 26,
                  backgroundColor: hasTime ? theme.primary : "#E8E3DB",
                  padding: 3,
                  flexDirection: "row",
                  justifyContent: hasTime ? "flex-end" : "flex-start",
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: "#FFFFFF",
                  }}
                />
              </View>
            </Pressable>

            <DateTimeInput
              label={t("teams.startsAtLabel")}
              value={startsAt}
              onChange={setStartsAt}
              mode={hasTime ? "datetime" : "date"}
            />
            <DateTimeInput
              label={t("teams.endsAtLabel")}
              value={endsAt}
              onChange={setEndsAt}
              mode={hasTime ? "datetime" : "date"}
            />

            <View
              style={{
                height: 1,
                backgroundColor: "#F2EDE4",
                marginVertical: 4,
              }}
            />

            {/* Linked plannings */}
            <View style={{ gap: 8 }}>
              <Text variant="label">{t("teams.planningsSection")}</Text>
              <Text variant="caption" style={{ fontSize: 12 }}>
                {t("teams.planningsHint")}
              </Text>
              {planningTools.length === 0 ? (
                <Text variant="caption" style={{ fontSize: 12 }}>
                  {t("teams.planningsEmpty")}
                </Text>
              ) : (
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {planningTools.map((p) => {
                    const selected = planningIds.includes(p.tool_id);
                    return (
                      <Pressable
                        key={p.tool_id}
                        onPress={() => togglePlanning(p.tool_id)}
                        hitSlop={4}
                        className="flex-row items-center px-2.5 py-1.5 rounded-full active:opacity-70"
                        style={{
                          backgroundColor: selected
                            ? theme.primary
                            : "#F3F0FA",
                          borderWidth: 1,
                          borderColor: selected ? theme.primary : "#E8E3DB",
                          gap: 6,
                        }}
                      >
                        <Ionicons
                          name="calendar-outline"
                          size={12}
                          color={selected ? "#FFFFFF" : "#1A1A1A"}
                        />
                        <Text
                          style={{
                            color: selected ? "#FFFFFF" : "#1A1A1A",
                            fontSize: 12,
                            fontWeight: selected ? "700" : "500",
                          }}
                        >
                          {p.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            {error ? (
              <Text style={{ color: "#991B1B", fontSize: 12 }}>{error}</Text>
            ) : null}
          </ScrollView>

          <View className="px-5 pb-5 pt-2" style={{ gap: 8 }}>
            <Button
              variant="cta"
              size="lg"
              label={busy ? t("teams.saving") : t("teams.save")}
              onPress={save}
              disabled={busy || !name.trim() || memberIds.length === 0}
            />
            <Button
              variant="ghost"
              label={t("teams.cancel")}
              onPress={onClose}
              disabled={busy}
            />
            {mode === "edit" ? (
              <Pressable
                onPress={confirmDelete}
                disabled={busy}
                className="py-3 items-center"
                style={{ opacity: busy ? 0.5 : 1 }}
              >
                <Text
                  variant="label"
                  style={{ color: "#991B1B", fontWeight: "700" }}
                >
                  {t("teams.delete")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
