import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  AddressInput,
  Button,
  DateTimeInput,
  Input,
  Text,
} from "@/components/ui";
import { createEvent } from "@/lib/events";
import { theme } from "@/lib/theme";

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

export function NewEventModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [location, setLocation] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [errors, setErrors] = useState<{
    title?: string;
    start?: string;
    end?: string;
    form?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) {
      setTitle("");
      setDescription("");
      setStart("");
      setEnd("");
      setLocation("");
      setDetailsOpen(false);
      setErrors({});
      setSubmitting(false);
    }
  }, [visible]);

  const handleSubmit = async () => {
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
      await createEvent({
        event_title: title.trim(),
        event_description: description.trim() || null,
        event_start_date: parsedStart === "invalid" ? null : parsedStart,
        event_end_date: parsedEnd === "invalid" ? null : parsedEnd,
        event_location: location.trim() || null,
      });
      onCreated();
    } catch {
      setErrors({ form: t("events.new.errorGeneric") });
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
              {t("events.new.title")}
            </Text>
            <Text variant="caption" className="mb-5">
              {t("events.new.subtitle")}
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
                required
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

            <Pressable
              onPress={() => setDetailsOpen((v) => !v)}
              className="flex-row items-center py-2 mb-3 active:opacity-70"
            >
              <Text
                variant="caption"
                className="flex-1 uppercase"
                style={{
                  letterSpacing: 1.2,
                  fontWeight: "700",
                  fontSize: 11,
                  color: theme.sectionLabel,
                }}
              >
                {t("events.new.detailsSection")}
              </Text>
              <Text
                variant="caption"
                style={{ color: theme.sectionLabel }}
              >
                {detailsOpen ? "▾" : "▸"}
              </Text>
            </Pressable>
            {detailsOpen ? (
              <View className="gap-3 mb-5">
                <AddressInput
                  label={t("events.new.locationLabel")}
                  placeholder={t("events.new.locationPlaceholder")}
                  value={location}
                  onChangeText={setLocation}
                />
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
            ) : null}

            {errors.form ? (
              <Text className="text-error text-sm mb-3">{errors.form}</Text>
            ) : null}

            <View className="gap-2">
              <Button
                variant="cta"
                size="lg"
                label={
                  submitting
                    ? t("events.new.submitting")
                    : t("events.new.submit")
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
