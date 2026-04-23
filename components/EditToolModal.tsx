import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button, Input, Text } from "@/components/ui";
import { updateEventTool, type EventTool } from "@/lib/events";

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
};

export function EditToolModal({ visible, tool, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"all" | "restricted">("all");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible && tool) {
      setName(tool.event_tool_name);
      setVisibility(tool.event_tool_visibility);
      setError(null);
      setBusy(false);
    }
  }, [visible, tool]);

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
                disabled={busy}
              />
              <Button
                variant="ghost"
                label={t("events.newTool.cancel")}
                onPress={onClose}
                disabled={busy}
              />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
