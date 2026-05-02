import { useEffect, useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button, Input, Text } from "@/components/ui";
import { deleteEventTool, updateEventTool, type EventTool } from "@/lib/events";

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      variant="caption"
      className="mb-2 uppercase"
      style={{
        letterSpacing: 1.2,
        fontWeight: "700",
        fontSize: 11,
        color: "#6050DC",
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
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"all" | "restricted">("all");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (visible && tool) {
      setName(tool.event_tool_name);
      setVisibility(tool.event_tool_visibility);
      setError(null);
      setBusy(false);
      setDeleting(false);
    }
  }, [visible, tool]);

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

  const confirmDelete = () => {
    if (!tool) return;
    const title = t("events.editTool.deleteConfirm", {
      name: tool.event_tool_name,
    });
    const body = t("events.editTool.deleteConfirmBody");
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (window.confirm(`${title}\n\n${body}`)) void doDelete();
      return;
    }
    Alert.alert(title, body, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("events.editTool.delete"),
        style: "destructive",
        onPress: () => void doDelete(),
      },
    ]);
  };

  const handleSubmit = async () => {
    if (!tool) return;
    if (!name.trim()) {
      setError(t("events.newTool.errorNameRequired"));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await updateEventTool(tool.event_tool_id, {
        event_tool_name: name.trim(),
        event_tool_visibility: visibility,
      });
      onSaved();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("updateEventTool failed:", err);
      setError(t("events.editTool.errorGeneric"));
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
              label={t("events.newTool.nameLabel")}
              placeholder={t("events.newTool.namePlaceholder")}
              value={name}
              onChangeText={setName}
              autoFocus
              className="mb-5"
            />

            <SectionLabel>{t("events.newTool.visibilityLabel")}</SectionLabel>
            <View className="gap-2 mb-5">
              {(["all", "restricted"] as const).map((v) => {
                const selected = visibility === v;
                return (
                  <Pressable
                    key={v}
                    onPress={() => setVisibility(v)}
                    className={`p-3 rounded-lg border ${
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-surface"
                    }`}
                  >
                    <Text variant="label">
                      {t(
                        v === "all"
                          ? "events.newTool.visibilityAll"
                          : "events.newTool.visibilityRestricted",
                      )}
                    </Text>
                    <Text variant="caption" className="mt-1">
                      {t(
                        v === "all"
                          ? "events.newTool.visibilityAllHint"
                          : "events.newTool.visibilityRestrictedHint",
                      )}
                    </Text>
                  </Pressable>
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
