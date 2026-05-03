import { useCallback, useEffect, useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button, DateTimeInput, Input, Text } from "@/components/ui";
import {
  disableEventShareToken,
  getEventShareToken,
  rotateEventShareToken,
  updateEvent,
  type Event,
} from "@/lib/events";
import { theme } from "@/lib/theme";

function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function parseDate(value: string): string | null | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes("T")
    ? trimmed
    : trimmed.replace(" ", "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return "invalid";
  return d.toISOString();
}

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

export function EditEventModal({
  visible,
  event,
  onClose,
  onSaved,
}: {
  visible: boolean;
  event: Event | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [errors, setErrors] = useState<{
    title?: string;
    start?: string;
    end?: string;
    form?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [shareTokenStatus, setShareTokenStatus] = useState<
    "unknown" | "active" | "disabled"
  >("unknown");
  const [tokenBusy, setTokenBusy] = useState(false);

  useEffect(() => {
    if (visible && event) {
      setTitle(event.event_title);
      setDescription(event.event_description ?? "");
      setStart(isoToLocalInput(event.event_start_date));
      setEnd(isoToLocalInput(event.event_end_date));
      setErrors({});
      setSubmitting(false);
      setShareTokenStatus("unknown");
      void getEventShareToken(event.event_id)
        .then((tok) => setShareTokenStatus(tok ? "active" : "disabled"))
        .catch(() => setShareTokenStatus("disabled"));
    }
  }, [visible, event]);

  const confirm = useCallback(
    (msg: string, run: () => void) => {
      if (Platform.OS === "web") {
        // eslint-disable-next-line no-alert
        if (window.confirm(msg)) run();
        return;
      }
      Alert.alert(msg, undefined, [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("common.confirm"), onPress: run },
      ]);
    },
    [t],
  );

  const handleRotate = useCallback(() => {
    if (!event) return;
    confirm(t("events.share.rotateConfirm"), async () => {
      setTokenBusy(true);
      try {
        await rotateEventShareToken(event.event_id);
        setShareTokenStatus("active");
      } finally {
        setTokenBusy(false);
      }
    });
  }, [confirm, event, t]);

  const handleDisable = useCallback(() => {
    if (!event) return;
    confirm(t("events.share.disableConfirm"), async () => {
      setTokenBusy(true);
      try {
        await disableEventShareToken(event.event_id);
        setShareTokenStatus("disabled");
      } finally {
        setTokenBusy(false);
      }
    });
  }, [confirm, event, t]);

  const handleSubmit = async () => {
    if (!event) return;
    const next: typeof errors = {};

    if (!title.trim()) next.title = t("events.new.errorTitleRequired");

    const parsedStart = parseDate(start);
    if (parsedStart === "invalid")
      next.start = t("events.new.errorInvalidDate");

    const parsedEnd = parseDate(end);
    if (parsedEnd === "invalid") next.end = t("events.new.errorInvalidDate");

    if (
      parsedStart &&
      parsedEnd &&
      parsedStart !== "invalid" &&
      parsedEnd !== "invalid" &&
      new Date(parsedEnd) < new Date(parsedStart)
    ) {
      next.end = t("events.new.errorEndBeforeStart");
    }

    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await updateEvent(event.event_id, {
        event_title: title.trim(),
        event_description: description.trim() || null,
        event_start_date: parsedStart === "invalid" ? null : parsedStart,
        event_end_date: parsedEnd === "invalid" ? null : parsedEnd,
      });
      onSaved();
    } catch {
      setErrors({ form: t("events.edit.errorGeneric") });
    } finally {
      setSubmitting(false);
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
              {t("events.edit.title")}
            </Text>
            <Text variant="caption" className="mb-5">
              {t("events.edit.subtitle")}
            </Text>

            <SectionLabel>{t("events.new.infoSection")}</SectionLabel>
            <View className="gap-3 mb-5">
              <Input
                label={t("events.new.titleLabel")}
                placeholder={t("events.new.titlePlaceholder")}
                value={title}
                onChangeText={setTitle}
                error={errors.title}
                autoFocus
              />
              <Input
                label={t("events.new.descriptionLabel")}
                placeholder={t("events.new.descriptionPlaceholder")}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                style={{ minHeight: 80, textAlignVertical: "top" }}
              />
            </View>

            <SectionLabel>{t("events.new.datesSection")}</SectionLabel>
            <View className="gap-3 mb-5">
              <DateTimeInput
                label={t("events.new.startLabel")}
                placeholder={t("events.new.datePlaceholder")}
                value={start}
                onChange={setStart}
                error={errors.start}
              />
              <DateTimeInput
                label={t("events.new.endLabel")}
                placeholder={t("events.new.datePlaceholder")}
                value={end}
                onChange={setEnd}
                error={errors.end}
              />
            </View>

            <SectionLabel>{t("events.share.sectionLabel")}</SectionLabel>
            <View
              className="rounded-xl p-3 mb-5"
              style={{ backgroundColor: "#F5F2EA" }}
            >
              <Text variant="caption" className="mb-3">
                {shareTokenStatus === "active"
                  ? t("events.share.activeHint")
                  : t("events.share.disabledHint")}
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                <Pressable
                  onPress={handleRotate}
                  disabled={tokenBusy}
                  className="px-3 py-1.5 rounded-full active:opacity-70"
                  style={{
                    backgroundColor: theme.primarySoft,
                    opacity: tokenBusy ? 0.6 : 1,
                  }}
                >
                  <Text
                    variant="label"
                    style={{ color: theme.primary, fontWeight: "700" }}
                  >
                    {t("events.share.rotateAction")}
                  </Text>
                </Pressable>
                {shareTokenStatus === "active" ? (
                  <Pressable
                    onPress={handleDisable}
                    disabled={tokenBusy}
                    className="px-3 py-1.5 rounded-full active:opacity-70"
                    style={{
                      backgroundColor: "#FEE2E2",
                      opacity: tokenBusy ? 0.6 : 1,
                    }}
                  >
                    <Text
                      variant="label"
                      style={{ color: "#991B1B", fontWeight: "700" }}
                    >
                      {t("events.share.disableAction")}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {errors.form ? (
              <Text className="text-error text-sm mb-3">{errors.form}</Text>
            ) : null}

            <View className="gap-2">
              <Button
                variant="cta"
                size="lg"
                label={
                  submitting
                    ? t("events.edit.submitting")
                    : t("events.edit.submit")
                }
                onPress={handleSubmit}
                disabled={submitting}
              />
              <Button
                variant="ghost"
                label={t("events.new.cancel")}
                onPress={onClose}
                disabled={submitting}
              />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
