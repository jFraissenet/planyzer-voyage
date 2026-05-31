import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button, Input, Text, useConfirm } from "@/components/ui";
import { deleteEventTool, updateEventTool, type EventTool } from "@/lib/events";
import {
  getEventToolTeamsAccess,
  listMyEventTeams,
  setEventToolTeamsAccess,
  type MyEventTeam,
} from "@/lib/teams";
import { theme } from "@/lib/theme";

type Visibility = "all" | "restricted" | "teams";

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

type Props = {
  visible: boolean;
  tool: EventTool | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
};

export function EditToolModal({
  visible,
  tool,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("all");
  // Optional tool-level description, shown at the top of the tool under the
  // participants (stored in event_tool_settings.description).
  const [description, setDescription] = useState("");
  // Teams tool only: custom text for the "you're a member" badge shown on
  // joined cards (e.g. "Votre chambre", "Votre équipe cuisine").
  const [memberBadgeLabel, setMemberBadgeLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [myTeams, setMyTeams] = useState<MyEventTeam[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);

  useEffect(() => {
    if (visible && tool) {
      setName(tool.event_tool_name);
      setVisibility(tool.event_tool_visibility);
      setDescription(
        typeof tool.event_tool_settings?.description === "string"
          ? (tool.event_tool_settings.description as string)
          : "",
      );
      setMemberBadgeLabel(
        typeof tool.event_tool_settings?.member_badge_label === "string"
          ? (tool.event_tool_settings.member_badge_label as string)
          : "",
      );
      setError(null);
      setBusy(false);
      setDeleting(false);
      setSelectedTeamIds([]);
      setMyTeams([]);
      // Lazy-load my teams + the tool's current team access set.
      (async () => {
        try {
          const [mine, current] = await Promise.all([
            listMyEventTeams(tool.event_tool_event_id),
            tool.event_tool_visibility === "teams"
              ? getEventToolTeamsAccess(tool.event_tool_id)
              : Promise.resolve([] as MyEventTeam[]),
          ]);
          setMyTeams(mine);
          setSelectedTeamIds(current.map((t2) => t2.team_id));
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("load teams for tool failed:", err);
        }
      })();
    }
  }, [visible, tool]);

  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId)
        ? prev.filter((id) => id !== teamId)
        : [...prev, teamId],
    );
  };

  const doDelete = async () => {
    if (!tool) return;
    setError(null);
    setDeleting(true);
    try {
      await deleteEventTool(tool.event_tool_id);
      onDeleted?.();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("deleteEventTool failed:", err);
      setError(t("events.editTool.errorDelete"));
      setDeleting(false);
    }
  };

  const confirmDelete = async () => {
    if (!tool) return;
    const ok = await confirm({
      title: t("events.editTool.deleteConfirm", {
        name: tool.event_tool_name,
      }),
      message: t("events.editTool.deleteConfirmBody"),
      confirmLabel: t("events.editTool.delete"),
      cancelLabel: t("common.cancel"),
      destructive: true,
    });
    if (ok) void doDelete();
  };

  const handleSubmit = async () => {
    if (!tool) return;
    if (!name.trim()) {
      setError(t("events.newTool.errorNameRequired"));
      return;
    }
    if (visibility === "teams" && selectedTeamIds.length === 0) {
      setError(t("events.newTool.visibilityTeamsRequired"));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const mergedSettings: Record<string, unknown> = {
        ...tool.event_tool_settings,
        description: description.trim() || null,
      };
      if (tool.event_tool_type_code === "teams") {
        mergedSettings.member_badge_label = memberBadgeLabel.trim() || null;
      }
      await updateEventTool(tool.event_tool_id, {
        event_tool_name: name.trim(),
        event_tool_visibility: visibility,
        event_tool_settings: mergedSettings,
      });
      if (visibility === "teams") {
        await setEventToolTeamsAccess(tool.event_tool_id, selectedTeamIds);
      }
      onSaved();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("updateEventTool failed:", err);
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: unknown }).code)
          : null;
      if (code === "23505") {
        setError(t("events.newTool.errorNameDuplicate"));
      } else {
        setError(t("events.editTool.errorGeneric"));
      }
    } finally {
      setBusy(false);
    }
  };

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
          className="w-full max-w-md bg-background rounded-2xl p-5"
          style={{ maxHeight: "90%" }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text variant="h2" className="mb-1">
              {t("events.editTool.title")}
            </Text>
            <Text variant="caption" className="mb-5">
              {t("events.editTool.subtitle")}
            </Text>

            <Input
              label={
                tool
                  ? t(
                      `events.newTool.nameLabelByType.${tool.event_tool_type_code}`,
                      { defaultValue: t("events.newTool.nameLabel") },
                    )
                  : t("events.newTool.nameLabel")
              }
              placeholder={
                tool
                  ? t(
                      `events.newTool.namePlaceholderByType.${tool.event_tool_type_code}`,
                      { defaultValue: t("events.newTool.namePlaceholder") },
                    )
                  : t("events.newTool.namePlaceholder")
              }
              value={name}
              onChangeText={setName}
              autoFocus
              className="mb-5"
              required
            />

            <Input
              label={t("events.editTool.descriptionLabel")}
              placeholder={t("events.editTool.descriptionPlaceholder")}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              className="mb-5"
              style={{ minHeight: 72, textAlignVertical: "top" }}
            />

            {tool?.event_tool_type_code === "teams" ? (
              <Input
                label={t("events.editTool.memberBadgeLabel")}
                placeholder={t("teams.yourTeam")}
                value={memberBadgeLabel}
                onChangeText={setMemberBadgeLabel}
                className="mb-5"
              />
            ) : null}

            <SectionLabel>{t("events.newTool.visibilityLabel")}</SectionLabel>
            <View className="gap-2 mb-5">
              {(["all", "restricted", "teams"] as const).map((v) => {
                const selected = visibility === v;
                const labelKey =
                  v === "all"
                    ? "events.newTool.visibilityAll"
                    : v === "restricted"
                      ? "events.newTool.visibilityRestricted"
                      : "events.newTool.visibilityTeams";
                const hintKey =
                  v === "all"
                    ? "events.newTool.visibilityAllHint"
                    : v === "restricted"
                      ? "events.newTool.visibilityRestrictedHint"
                      : "events.newTool.visibilityTeamsHint";
                return (
                  <View key={v}>
                    <Pressable
                      onPress={() => setVisibility(v)}
                      className={`p-3 rounded-lg border ${
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-surface"
                      }`}
                    >
                      <Text variant="label">{t(labelKey)}</Text>
                      <Text variant="caption" className="mt-1">
                        {t(hintKey)}
                      </Text>
                    </Pressable>
                    {v === "teams" && selected ? (
                      <View className="mt-2 ml-2">
                        {myTeams.length === 0 ? (
                          <Text variant="caption">
                            {t("events.newTool.visibilityTeamsEmpty")}
                          </Text>
                        ) : (
                          <View className="gap-1.5">
                            {myTeams.map((tm) => {
                              const picked = selectedTeamIds.includes(
                                tm.team_id,
                              );
                              return (
                                <Pressable
                                  key={tm.team_id}
                                  onPress={() => toggleTeam(tm.team_id)}
                                  className={`flex-row items-center p-2 rounded-lg border ${
                                    picked
                                      ? "border-primary bg-primary/5"
                                      : "border-border bg-surface"
                                  }`}
                                >
                                  <View
                                    style={{
                                      width: 14,
                                      height: 14,
                                      borderRadius: 7,
                                      backgroundColor: tm.color,
                                      marginRight: 8,
                                    }}
                                  />
                                  <Text variant="label" className="flex-1">
                                    {tm.name}
                                  </Text>
                                  <Text
                                    style={{
                                      color: picked
                                        ? theme.primary
                                        : theme.sectionLabel,
                                      fontWeight: "700",
                                    }}
                                  >
                                    {picked ? "✓" : ""}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>

            {error ? (
              <Text className="text-error text-sm mb-3">{error}</Text>
            ) : null}

            <View className="gap-2">
              <Button
                variant="cta"
                size="lg"
                label={
                  busy
                    ? t("events.editTool.saving")
                    : t("events.editTool.save")
                }
                onPress={handleSubmit}
                disabled={busy || deleting}
              />
              <Button
                variant="ghost"
                label={t("events.newTool.cancel")}
                onPress={onClose}
                disabled={busy || deleting}
              />
              <Pressable
                onPress={confirmDelete}
                disabled={busy || deleting}
                className="items-center justify-center py-3 active:opacity-70"
                style={{ opacity: busy || deleting ? 0.5 : 1 }}
              >
                <Text
                  variant="label"
                  style={{ color: "#EF4444", fontWeight: "700" }}
                >
                  {deleting
                    ? t("events.editTool.deleting")
                    : t("events.editTool.delete")}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
