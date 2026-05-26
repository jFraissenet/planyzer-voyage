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
import { AddressInput, Avatar, Button, DateTimeInput, Input, Text } from "@/components/ui";
import { listParticipants, type ParticipantEntry } from "@/lib/events";
import {
  deleteEventToolPlanningSlot,
  upsertEventToolPlanningSlot,
  type PlanningSlot,
  type PlanningSlotInput,
} from "@/lib/planning";
import { listEventToolTeams } from "@/lib/teams";
import { isoToLocalInput, localInputToIso } from "../proposals/dateHelpers";
import { MemberMultiSelect } from "../teams/MemberMultiSelect";
import { LinkPicker, type PickedLink } from "./LinkPicker";
import { theme } from "@/lib/theme";

type Mode = "create" | "edit";

type Props = {
  mode: Mode;
  visible: boolean;
  toolId: string;
  eventId: string;
  existing?: PlanningSlot;
  // Local YYYY-MM-DDTHH:MM string. When the modal opens in create mode and
  // this is set, the start field is pre-filled with it (e.g. user tapped on
  // a calendar day → pre-fill that day at noon).
  initialStartsAt?: string;
  onClose: () => void;
  onSaved: () => void;
};

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

// Draft shape of a link inside the form. Mirrors PickedLink but the existing
// links from the server arrive in PlanningSlotLink shape; we normalize both
// to this shape so the UI can treat them uniformly.
type DraftLink = {
  target_tool_id: string;
  target_tool_name: string;
  target_tool_type_code: string;
  kind: PlanningSlotInput["links"][number]["kind"];
  target_id: string | null;
  target_label: string;
};

export function SlotEditModal({
  mode,
  visible,
  toolId,
  eventId,
  existing,
  initialStartsAt,
  onClose,
  onSaved,
}: Props) {
  const { t } = useTranslation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [locationUrl, setLocationUrl] = useState("");
  const [hasTime, setHasTime] = useState(true);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [links, setLinks] = useState<DraftLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [eventParticipants, setEventParticipants] = useState<ParticipantEntry[]>(
    [],
  );
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);

  // Reset form on open. Fetches the event participants list every open so
  // newcomers since the last visit show up.
  useEffect(() => {
    if (!visible) return;
    setTitle(existing?.title ?? "");
    setDescription(existing?.description ?? "");
    setLocation(existing?.location ?? "");
    setLocationUrl(existing?.location_url ?? "");
    setHasTime(existing?.has_time ?? true);
    setStartsAt(
      existing
        ? isoToLocalInput(existing.starts_at)
        : (initialStartsAt ?? ""),
    );
    setEndsAt(isoToLocalInput(existing?.ends_at ?? null));
    setParticipantIds(existing?.participants.map((p) => p.user_id) ?? []);
    setLinks(
      existing?.links.map((l) => ({
        target_tool_id: l.target_tool_id,
        target_tool_name: l.target_tool_name,
        target_tool_type_code: l.target_tool_type_code,
        kind: l.kind,
        target_id: l.target_id,
        target_label: l.target_label ?? l.target_tool_name,
      })) ?? [],
    );
    setError(null);
    setBusy(false);

    listParticipants(eventId)
      .then(setEventParticipants)
      .catch(() => setEventParticipants([]));
  }, [visible, existing, eventId, initialStartsAt]);

  const allSelected =
    eventParticipants.length > 0
    && participantIds.length === eventParticipants.length;

  const toggleParticipant = (userId: string) => {
    setParticipantIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const toggleAll = () => {
    if (allSelected) {
      setParticipantIds([]);
    } else {
      setParticipantIds(eventParticipants.map((p) => p.user_id));
    }
  };

  const addLink = (pick: PickedLink) => {
    // Skip duplicates (same target_tool + kind + target_id tuple).
    if (
      links.some(
        (l) =>
          l.target_tool_id === pick.target_tool_id
          && l.kind === pick.kind
          && l.target_id === pick.target_id,
      )
    ) {
      setLinkPickerOpen(false);
      return;
    }
    setLinks((prev) => [...prev, pick]);
    setLinkPickerOpen(false);

    // Linking to a team (whole-tool or specific team) sets the slot
    // participants to exactly the team's members — replaces any previous
    // selection so an empty team leaves an empty list.
    if (pick.target_tool_type_code === "teams") {
      void (async () => {
        try {
          const teams = await listEventToolTeams(pick.target_tool_id);
          const memberIds =
            pick.kind === "team" && pick.target_id
              ? (teams.find((tm) => tm.team_id === pick.target_id)?.members ?? [])
                  .map((m) => m.user_id)
              : Array.from(
                  new Set(
                    teams.flatMap((tm) => tm.members.map((m) => m.user_id)),
                  ),
                );
          setParticipantIds(memberIds);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("set team members failed:", err);
        }
      })();
    }
  };

  const removeLink = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const build = (): PlanningSlotInput | null => {
    const titleTrim = title.trim();
    if (!titleTrim) {
      setError(t("planning.errorTitleRequired"));
      return null;
    }
    const startIso = localInputToIso(startsAt);
    if (!startIso) {
      setError(t("planning.errorStartRequired"));
      return null;
    }
    const endIso = localInputToIso(endsAt);
    // Mirror the DB constraint: end (when set) must be >= start.
    if (endIso && new Date(endIso).getTime() < new Date(startIso).getTime()) {
      setError(t("planning.errorEndBeforeStart"));
      return null;
    }
    return {
      title: titleTrim,
      description: description.trim() ? description.trim() : null,
      location: location.trim() ? location.trim() : null,
      location_url: locationUrl.trim() ? locationUrl.trim() : null,
      starts_at: startIso,
      ends_at: endIso,
      has_time: hasTime,
      participants: participantIds,
      links: links.map((l) => ({
        target_tool_id: l.target_tool_id,
        kind: l.kind,
        target_id: l.target_id,
      })),
    };
  };

  const save = async () => {
    const input = build();
    if (!input) return;
    setBusy(true);
    try {
      await upsertEventToolPlanningSlot(
        toolId,
        mode === "edit" && existing ? existing.slot_id : null,
        input,
      );
      onSaved();
    } catch {
      setError(t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (!existing) return;
    const msg = t("planning.deleteConfirm");
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (window.confirm(msg)) void runDelete();
      return;
    }
    Alert.alert(msg, undefined, [
      { text: t("planning.cancel"), style: "cancel" },
      {
        text: t("planning.delete"),
        style: "destructive",
        onPress: () => runDelete(),
      },
    ]);
  };

  const runDelete = async () => {
    if (!existing) return;
    setBusy(true);
    try {
      await deleteEventToolPlanningSlot(existing.slot_id);
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  const titleLabel =
    mode === "create" ? t("planning.createTitle") : t("planning.editTitle");

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
            className="flex-row items-center justify-between px-5 pt-5 pb-3"
            style={{ borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}
          >
            <Text variant="h2">{titleLabel}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              className="rounded-full items-center justify-center"
              style={{
                width: 32,
                height: 32,
                backgroundColor: "#F3F4F6",
              }}
            >
              <Ionicons name="close" size={16} color="#6B7280" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <Input
              label={t("planning.titleLabel")}
              placeholder={t("planning.titlePlaceholder")}
              value={title}
              onChangeText={setTitle}
              autoFocus
              required
            />
            <Input
              label={t("planning.descriptionLabel")}
              placeholder={t("planning.descriptionPlaceholder")}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              style={{ minHeight: 70, textAlignVertical: "top" }}
            />
            <AddressInput
              label={t("planning.locationLabel")}
              placeholder={t("planning.locationPlaceholder")}
              value={location}
              onChangeText={(text) => {
                setLocation(text);
                if (locationUrl) setLocationUrl("");
              }}
              onPickSuggestion={(s) => {
                setLocation(s.short);
                setLocationUrl(s.mapsUrl);
              }}
            />

            {/* Has-time toggle */}
            <Pressable
              onPress={() => setHasTime((v) => !v)}
              className="flex-row items-center justify-between"
              style={{ gap: 10 }}
            >
              <Text variant="label" style={{ flex: 1 }}>
                {t("planning.hasTimeLabel")}
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

            <View className="flex-row" style={{ gap: 8 }}>
              <View className="flex-1">
                <DateTimeInput
                  label={t("planning.startsAtLabel")}
                  value={startsAt}
                  onChange={setStartsAt}
                  mode={hasTime ? "datetime" : "date"}
                  required
                />
              </View>
              <View className="flex-1">
                <DateTimeInput
                  label={t("planning.endsAtLabel")}
                  value={endsAt}
                  onChange={setEndsAt}
                  mode={hasTime ? "datetime" : "date"}
                />
              </View>
            </View>

            <View
              style={{
                height: 1,
                backgroundColor: "#F2EDE4",
                marginVertical: 4,
              }}
            />

            {/* Participants */}
            <MemberMultiSelect
              participants={eventParticipants}
              selectedIds={participantIds}
              onChange={setParticipantIds}
            />

            <View
              style={{
                height: 1,
                backgroundColor: "#F2EDE4",
                marginVertical: 4,
              }}
            />

            {/* Links */}
            <View style={{ gap: 8 }}>
              <Text variant="label">{t("planning.linksSection")}</Text>
              {links.length === 0 ? (
                <Text variant="caption" style={{ fontSize: 12 }}>
                  {t("planning.linksEmpty")}
                </Text>
              ) : (
                links.map((l, idx) => (
                  <View
                    key={`${l.target_tool_id}|${l.kind}|${l.target_id ?? "tool"}`}
                    className="flex-row items-center px-3 py-2 rounded-xl"
                    style={{
                      backgroundColor: "#FFFFFF",
                      borderWidth: 1,
                      borderColor: "#E8E3DB",
                      gap: 8,
                    }}
                  >
                    <Ionicons
                      name="link-outline"
                      size={14}
                      color={theme.primary}
                    />
                    <View className="flex-1">
                      <Text
                        style={{
                          fontSize: 14,
                          color: "#1A1A1A",
                          fontWeight: "600",
                        }}
                        numberOfLines={1}
                      >
                        {l.target_label}
                      </Text>
                      <Text variant="caption" style={{ fontSize: 11 }}>
                        {l.target_tool_name}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => removeLink(idx)}
                      hitSlop={6}
                      className="items-center justify-center rounded-full"
                      style={{
                        width: 24,
                        height: 24,
                        backgroundColor: "#FEE2E2",
                      }}
                    >
                      <Ionicons name="close" size={12} color="#991B1B" />
                    </Pressable>
                  </View>
                ))
              )}
              <Pressable
                onPress={() => setLinkPickerOpen(true)}
                hitSlop={6}
                className="flex-row items-center justify-center py-2.5 rounded-lg border bg-surface border-border active:opacity-70"
                style={{ gap: 6 }}
              >
                <Ionicons name="add" size={16} color={theme.primary} />
                <Text
                  style={{
                    color: theme.primary,
                    fontWeight: "600",
                    fontSize: 13,
                  }}
                >
                  {t("planning.addLink")}
                </Text>
              </Pressable>
            </View>

            {error ? (
              <Text style={{ color: "#991B1B", fontSize: 12 }}>{error}</Text>
            ) : null}
          </ScrollView>

          <View className="px-5 pb-5 pt-2" style={{ gap: 8 }}>
            <Button
              variant="cta"
              size="lg"
              label={busy ? t("planning.saving") : t("planning.save")}
              onPress={save}
              disabled={busy || !title.trim()}
            />
            <Button
              variant="ghost"
              label={t("planning.cancel")}
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
                  {t("planning.delete")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>

    <LinkPicker
      visible={linkPickerOpen}
      eventId={eventId}
      excludeToolId={toolId}
      onClose={() => setLinkPickerOpen(false)}
      onPick={addLink}
    />
    </>
  );
}
