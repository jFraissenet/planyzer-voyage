import { useEffect, useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import dayjs, { type Dayjs } from "dayjs";
import DateTimePicker, { useDefaultStyles } from "react-native-ui-datepicker";
import RNCDateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { Button, Text } from "@/components/ui";
import {
  createEventToolProposal,
  updateEventToolProposal,
  type EventToolProposal,
} from "@/lib/proposals";
import { theme } from "@/lib/theme";

// Date proposal form built around a single range calendar (react-native-ui-
// datepicker). The user picks a start day (and optionally an end day),
// optionally toggles "include time" to reveal time pickers inside the
// calendar, and presses "Add this period" to stage it. Multiple ranges can
// be staged in one go and saved as N proposals at once.
//
// Edit mode keeps the same widget but no staging list: the picker is
// pre-filled and Save updates the existing proposal in place.

type Entry = { startIso: string; endIso: string | null; hasTime: boolean };

type Props = {
  visible: boolean;
  toolId: string;
  existing?: EventToolProposal;
  onClose: () => void;
  onSaved: () => void;
};

function stripTimeIso(iso: string): string {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

const pad2 = (n: number) => n.toString().padStart(2, "0");

function extractTime(iso: string | null | undefined, fallback: string): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function combineDateTime(d: Dayjs, time: string): string {
  const [h, m] = time.split(":").map(Number);
  return d.hour(h).minute(m).second(0).millisecond(0).toISOString();
}

function formatTitle(
  startIso: string,
  endIso: string | null,
  hasTime: boolean,
  locale: string,
): string {
  const dateOpts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  };
  const dateTimeOpts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  };
  const opts = hasTime ? dateTimeOpts : dateOpts;
  const start = new Date(startIso).toLocaleString(locale, opts);
  if (!endIso) return start;
  const end = new Date(endIso).toLocaleString(locale, opts);
  return `${start} → ${end}`;
}

export function DateProposalEditModal({
  visible,
  toolId,
  existing,
  onClose,
  onSaved,
}: Props) {
  const { t, i18n } = useTranslation();
  const isEdit = !!existing;
  const datePickerStyles = useDefaultStyles("light");
  const [includeTime, setIncludeTime] = useState(false);
  const [start, setStart] = useState<Dayjs | null>(null);
  const [end, setEnd] = useState<Dayjs | null>(null);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [staged, setStaged] = useState<Entry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setSubmitting(false);
    if (existing) {
      setStart(existing.date_start ? dayjs(existing.date_start) : null);
      setEnd(existing.date_end ? dayjs(existing.date_end) : null);
      setIncludeTime(existing.has_time);
      setStartTime(extractTime(existing.date_start, "09:00"));
      setEndTime(extractTime(existing.date_end, "18:00"));
      setStaged([]);
    } else {
      setStart(null);
      setEnd(null);
      setIncludeTime(false);
      setStartTime("09:00");
      setEndTime("18:00");
      setStaged([]);
    }
  }, [visible, existing]);

  const canStage = !!start;

  const stageCurrent = () => {
    if (!start) return;
    const s = includeTime
      ? combineDateTime(start, startTime)
      : stripTimeIso(start.toISOString());
    const e = end
      ? includeTime
        ? combineDateTime(end, endTime)
        : stripTimeIso(end.toISOString())
      : null;
    setStaged((prev) => [...prev, { startIso: s, endIso: e, hasTime: includeTime }]);
    setStart(null);
    setEnd(null);
  };

  const removeStaged = (idx: number) => {
    setStaged((prev) => prev.filter((_, i) => i !== idx));
  };

  const stagedSummaries = useMemo(
    () =>
      staged.map((s) =>
        formatTitle(s.startIso, s.endIso, s.hasTime, i18n.language),
      ),
    [staged, i18n.language],
  );

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (isEdit && existing) {
        if (!start) {
          setError(t("proposals.dateForm.errorRequired"));
          setSubmitting(false);
          return;
        }
        const s = includeTime
          ? combineDateTime(start, startTime)
          : stripTimeIso(start.toISOString());
        const e = end
          ? includeTime
            ? combineDateTime(end, endTime)
            : stripTimeIso(end.toISOString())
          : null;
        await updateEventToolProposal(existing.proposal_id, {
          title: formatTitle(s, e, includeTime, i18n.language),
          date_start: s,
          date_end: e,
          has_time: includeTime,
        });
        onSaved();
        return;
      }
      // Create flow: include current pending pick if any, plus all staged.
      const all: Entry[] = [...staged];
      if (start) {
        const s = includeTime
          ? combineDateTime(start, startTime)
          : stripTimeIso(start.toISOString());
        const e = end
          ? includeTime
            ? combineDateTime(end, endTime)
            : stripTimeIso(end.toISOString())
          : null;
        all.push({ startIso: s, endIso: e, hasTime: includeTime });
      }
      if (all.length === 0) {
        setError(t("proposals.dateForm.errorRequired"));
        setSubmitting(false);
        return;
      }
      for (const entry of all) {
        await createEventToolProposal(toolId, {
          title: formatTitle(entry.startIso, entry.endIso, entry.hasTime, i18n.language),
          date_start: entry.startIso,
          date_end: entry.endIso,
          has_time: entry.hasTime,
        });
      }
      onSaved();
    } catch {
      setError(t("proposals.dateForm.errorGeneric"));
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
          className="w-full max-w-md bg-background rounded-2xl"
          style={{ maxHeight: "92%" }}
        >
          <View className="px-5 pt-5 pb-3">
            <Text variant="h2">
              {isEdit
                ? t("proposals.dateForm.titleEdit")
                : t("proposals.dateForm.titleCreate")}
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: 16,
              gap: 14,
            }}
          >
            <Pressable
              onPress={() => setIncludeTime((v) => !v)}
              className="flex-row items-center justify-between"
              style={{ gap: 10 }}
            >
              <View className="flex-row items-center flex-1" style={{ gap: 10 }}>
                <Ionicons
                  name="time-outline"
                  size={18}
                  color={includeTime ? theme.primary : "#A3A3A3"}
                />
                <Text
                  style={{
                    color: "#1A1A1A",
                    fontSize: 14,
                    fontWeight: "700",
                  }}
                >
                  {t("proposals.dateForm.includeTime")}
                </Text>
              </View>
              <View
                className="items-center justify-center rounded-full"
                style={{
                  width: 44,
                  height: 26,
                  backgroundColor: includeTime ? theme.primary : "#E8E3DB",
                  padding: 3,
                  flexDirection: "row",
                  justifyContent: includeTime ? "flex-end" : "flex-start",
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

            <View
              className="rounded-xl"
              style={{
                borderWidth: 1,
                borderColor: "#E8E3DB",
                backgroundColor: "#FFFFFF",
                padding: 8,
              }}
            >
              <DateTimePicker
                mode="range"
                startDate={start ?? undefined}
                endDate={end ?? undefined}
                timePicker={includeTime}
                onChange={({ startDate, endDate }) => {
                  setStart(startDate ? dayjs(startDate) : null);
                  setEnd(endDate ? dayjs(endDate) : null);
                }}
                styles={{
                  ...datePickerStyles,
                  day_label: {
                    ...(datePickerStyles.day_label ?? {}),
                    color: "#1A1A1A",
                  },
                  weekday_label: {
                    ...(datePickerStyles.weekday_label ?? {}),
                    color: "#525252",
                  },
                  month_selector_label: {
                    ...(datePickerStyles.month_selector_label ?? {}),
                    color: "#1A1A1A",
                  },
                  year_selector_label: {
                    ...(datePickerStyles.year_selector_label ?? {}),
                    color: "#1A1A1A",
                  },
                  time_label: {
                    ...(datePickerStyles.time_label ?? {}),
                    color: "#1A1A1A",
                  },
                  time_selector: {
                    ...(datePickerStyles.time_selector ?? {}),
                    backgroundColor: theme.primarySoft,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 6,
                  },
                  time_selector_label: {
                    ...(datePickerStyles.time_selector_label ?? {}),
                    color: theme.primaryDeep,
                    fontWeight: "700",
                  },
                  time_selected_indicator: {
                    ...(datePickerStyles.time_selected_indicator ?? {}),
                    backgroundColor: theme.primary,
                  },
                  button_prev_image: {
                    ...(datePickerStyles.button_prev_image ?? {}),
                    tintColor: "#1A1A1A",
                  },
                  button_next_image: {
                    ...(datePickerStyles.button_next_image ?? {}),
                    tintColor: "#1A1A1A",
                  },
                  today: {
                    ...(datePickerStyles.today ?? {}),
                    borderColor: theme.primary,
                    borderWidth: 2,
                  },
                  today_label: {
                    ...(datePickerStyles.today_label ?? {}),
                    color: theme.primaryDeep,
                    fontWeight: "700",
                  },
                  selected: {
                    ...(datePickerStyles.selected ?? {}),
                    backgroundColor: theme.primary,
                  },
                  selected_label: {
                    ...(datePickerStyles.selected_label ?? {}),
                    color: "#FFFFFF",
                    fontWeight: "700",
                  },
                  range_start: {
                    ...(datePickerStyles.range_start ?? {}),
                    backgroundColor: theme.primary,
                  },
                  range_start_label: {
                    ...(datePickerStyles.range_start_label ?? {}),
                    color: "#FFFFFF",
                    fontWeight: "700",
                  },
                  range_end: {
                    ...(datePickerStyles.range_end ?? {}),
                    backgroundColor: theme.primary,
                  },
                  range_end_label: {
                    ...(datePickerStyles.range_end_label ?? {}),
                    color: "#FFFFFF",
                    fontWeight: "700",
                  },
                  range_middle: {
                    ...(datePickerStyles.range_middle ?? {}),
                    backgroundColor: theme.primarySoft,
                  },
                  range_middle_label: {
                    ...(datePickerStyles.range_middle_label ?? {}),
                    color: theme.primaryDeep,
                  },
                  range_fill: {
                    ...(datePickerStyles.range_fill ?? {}),
                    backgroundColor: theme.primarySoft,
                  },
                  range_fill_weekstart: {
                    ...(datePickerStyles.range_fill_weekstart ?? {}),
                    backgroundColor: theme.primarySoft,
                  },
                  range_fill_weekend: {
                    ...(datePickerStyles.range_fill_weekend ?? {}),
                    backgroundColor: theme.primarySoft,
                  },
                }}
              />
            </View>

            {includeTime && (start || end) ? (
              <View
                className="rounded-xl"
                style={{
                  borderWidth: 1,
                  borderColor: "#E8E3DB",
                  backgroundColor: "#FFFFFF",
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  gap: 12,
                }}
              >
                {start ? (
                  <TimeField
                    label={t("proposals.dateForm.startTime")}
                    value={startTime}
                    onChange={setStartTime}
                  />
                ) : null}
                {end ? (
                  <TimeField
                    label={t("proposals.dateForm.endTime")}
                    value={endTime}
                    onChange={setEndTime}
                  />
                ) : null}
              </View>
            ) : null}

            {!isEdit ? (
              <Pressable
                onPress={stageCurrent}
                disabled={!canStage}
                className="flex-row items-center justify-center py-3 rounded-xl"
                style={{
                  borderWidth: 1,
                  borderColor: theme.primary,
                  borderStyle: "dashed",
                  gap: 6,
                  opacity: canStage ? 1 : 0.4,
                }}
              >
                <Ionicons name="add" size={18} color={theme.primary} />
                <Text
                  style={{
                    color: theme.primary,
                    fontWeight: "700",
                    fontSize: 14,
                  }}
                >
                  {t("proposals.dateForm.addAnother")}
                </Text>
              </Pressable>
            ) : null}

            {staged.length > 0 ? (
              <View style={{ gap: 6 }}>
                <Text
                  variant="caption"
                  style={{ fontWeight: "700", color: "#1A1A1A" }}
                >
                  {t("proposals.dateForm.stagedHeader", { count: staged.length })}
                </Text>
                {stagedSummaries.map((label, idx) => (
                  <View
                    key={idx}
                    className="flex-row items-center rounded-lg px-3 py-2"
                    style={{
                      backgroundColor: theme.primarySoft,
                      gap: 8,
                    }}
                  >
                    <Ionicons
                      name="calendar"
                      size={14}
                      color={theme.primaryDeep}
                    />
                    <Text
                      className="flex-1"
                      style={{
                        color: theme.primaryDeep,
                        fontSize: 13,
                        fontWeight: "600",
                      }}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                    <Pressable
                      onPress={() => removeStaged(idx)}
                      hitSlop={6}
                      className="items-center justify-center rounded-full"
                      style={{
                        width: 22,
                        height: 22,
                        backgroundColor: "#FEE2E2",
                      }}
                    >
                      <Ionicons name="close" size={12} color="#991B1B" />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            {error ? (
              <Text className="text-error text-sm">{error}</Text>
            ) : null}

            <View className="gap-2">
              <Button
                variant="cta"
                size="lg"
                label={
                  submitting
                    ? t("proposals.dateForm.submitting")
                    : isEdit
                      ? t("proposals.dateForm.submitEdit")
                      : t("proposals.dateForm.submitCreate")
                }
                onPress={handleSubmit}
                disabled={submitting}
              />
              <Button
                variant="ghost"
                label={t("common.cancel")}
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

function TimeField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [iosDraft, setIosDraft] = useState<Date | null>(null);

  const toDate = (time: string): Date => {
    const [h, m] = time.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };
  const fromDate = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

  if (Platform.OS === "web") {
    return (
      <View
        className="flex-row items-center justify-between"
        style={{ gap: 12, opacity: disabled ? 0.4 : 1 }}
      >
        <Text style={{ color: "#1A1A1A", fontSize: 14, fontWeight: "600" }}>
          {label}
        </Text>
        <input
          type="time"
          value={value}
          disabled={disabled}
          onChange={(e: { target: { value: string } }) =>
            onChange(e.target.value)
          }
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #E8E3DB",
            background: "#FFFFFF",
            fontFamily: "inherit",
            fontSize: 14,
            color: "#1A1A1A",
            outline: "none",
          }}
        />
      </View>
    );
  }

  const openAndroid = () => {
    DateTimePickerAndroid.open({
      value: toDate(value),
      mode: "time",
      is24Hour: true,
      onChange: (_e, sel) => {
        if (sel) onChange(fromDate(sel));
      },
    });
  };
  const openIos = () => setIosDraft(toDate(value));
  const closeIos = () => setIosDraft(null);
  const confirmIos = () => {
    if (iosDraft) onChange(fromDate(iosDraft));
    closeIos();
  };

  return (
    <Pressable
      onPress={
        disabled ? undefined : Platform.OS === "android" ? openAndroid : openIos
      }
      className="flex-row items-center justify-between"
      style={{ gap: 12, opacity: disabled ? 0.4 : 1 }}
    >
      <Text style={{ color: "#1A1A1A", fontSize: 14, fontWeight: "600" }}>
        {label}
      </Text>
      <View
        className="rounded-lg bg-surface px-3 py-1.5"
        style={{ borderWidth: 1, borderColor: "#E8E3DB" }}
      >
        <Text style={{ fontSize: 14, color: "#1A1A1A" }}>{value}</Text>
      </View>
      {Platform.OS === "ios" && iosDraft !== null ? (
        <Modal
          transparent
          animationType="fade"
          visible
          onRequestClose={closeIos}
        >
          <Pressable
            className="flex-1 bg-black/40 items-center justify-center px-6"
            onPress={closeIos}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-background rounded-xl p-4"
            >
              <RNCDateTimePicker
                value={iosDraft}
                mode="time"
                display="spinner"
                onChange={(_e, sel) => {
                  if (sel) setIosDraft(sel);
                }}
              />
              <View className="flex-row gap-2 mt-2">
                <View className="flex-1">
                  <Button
                    variant="ghost"
                    label={t("common.cancel")}
                    onPress={closeIos}
                  />
                </View>
                <View className="flex-1">
                  <Button label={t("common.ok")} onPress={confirmIos} />
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </Pressable>
  );
}
