import { useEffect, useState } from "react";
import { Alert, Modal, Platform, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button, Input, Text } from "@/components/ui";

type Props = {
  visible: boolean;
  initialText: string;
  canDelete: boolean;
  onClose: () => void;
  onSave: (text: string) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
};

export function NoteEditModal({
  visible,
  initialText,
  canDelete,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setText(initialText);
      setBusy(false);
    }
  }, [visible, initialText]);

  const confirmDelete = () => {
    const msg = t("notes.deleteConfirm");
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (window.confirm(msg)) void runDelete();
      return;
    }
    Alert.alert(msg, undefined, [
      { text: t("notes.cancel"), style: "cancel" },
      {
        text: t("notes.delete"),
        style: "destructive",
        onPress: () => runDelete(),
      },
    ]);
  };

  const runDelete = async () => {
    setBusy(true);
    try {
      await onDelete();
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await onSave(trimmed);
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
          <Text variant="h2" className="mb-4">
            {t("notes.editTitle")}
          </Text>

          <Input
            label={t("notes.textLabel")}
            value={text}
            onChangeText={setText}
            multiline
            numberOfLines={4}
            style={{ minHeight: 100, textAlignVertical: "top" }}
            autoFocus
            className="mb-4"
            required
          />

          <View className="gap-2">
            <Button
              variant="cta"
              size="lg"
              label={t("notes.save")}
              onPress={save}
              disabled={busy || !text.trim()}
            />
            {canDelete ? (
              <Pressable
                onPress={confirmDelete}
                disabled={busy}
                className="py-3 items-center"
                style={{ opacity: busy ? 0.5 : 1 }}
              >
                <Text
                  variant="label"
                  style={{ color: "#EF4444", fontWeight: "600" }}
                >
                  {t("notes.delete")}
                </Text>
              </Pressable>
            ) : null}
            <Button
              variant="ghost"
              label={t("notes.cancel")}
              onPress={onClose}
              disabled={busy}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
