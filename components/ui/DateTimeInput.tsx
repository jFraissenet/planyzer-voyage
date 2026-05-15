import { useState } from "react";
import { Modal, Platform, Pressable, View } from "react-native";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { Text } from "./Text";

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  mode?: "date" | "datetime";
  required?: boolean;
};

const pad = (n: number) => n.toString().padStart(2, "0");

function toLocalInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(v: string): Date {
  return v ? new Date(v) : new Date();
}

export function DateTimeInput({
  label,
  value,
  onChange,
  placeholder,
  error,
  mode = "datetime",
  required,
}: Props) {
  const { t } = useTranslation();
  const [iosDraft, setIosDraft] = useState<Date | null>(null);
  const isDateOnly = mode === "date";

  const display = value
    ? isDateOnly
      ? new Date(value).toLocaleDateString()
      : new Date(value).toLocaleString()
    : placeholder ?? "";
  const borderClass = error ? "border-error" : "border-border";

  const openAndroid = () => {
    const initial = fromLocalInputValue(value);
    DateTimePickerAndroid.open({
      value: initial,
      mode: "date",
      is24Hour: true,
      onChange: (_e, dateSel) => {
        if (!dateSel) return;
        if (isDateOnly) {
          // Skip the time step in date-only mode — store with time = 00:00.
          const combined = new Date(
            dateSel.getFullYear(),
            dateSel.getMonth(),
            dateSel.getDate(),
            0,
            0,
          );
          onChange(toLocalInputValue(combined));
          return;
        }
        DateTimePickerAndroid.open({
          value: dateSel,
          mode: "time",
          is24Hour: true,
          onChange: (_e2, timeSel) => {
            if (!timeSel) return;
            const combined = new Date(
              dateSel.getFullYear(),
              dateSel.getMonth(),
              dateSel.getDate(),
              timeSel.getHours(),
              timeSel.getMinutes(),
            );
            onChange(toLocalInputValue(combined));
          },
        });
      },
    });
  };

  const openIos = () => setIosDraft(fromLocalInputValue(value));
  const closeIos = () => setIosDraft(null);
  const confirmIos = () => {
    if (iosDraft) onChange(toLocalInputValue(iosDraft));
    closeIos();
  };

  return (
    <View className="w-full">
      <Text variant="label" className="mb-1.5">
        {label}
        {required ? <Text className="text-error">{" *"}</Text> : null}
      </Text>
      <Pressable
        onPress={Platform.OS === "android" ? openAndroid : openIos}
        className={`w-full px-4 py-3 rounded-lg border bg-surface ${borderClass}`}
      >
        <Text variant={value ? "body" : "caption"}>{display}</Text>
      </Pressable>

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
              <DateTimePicker
                value={iosDraft}
                mode={isDateOnly ? "date" : "datetime"}
                display="inline"
                onChange={(_e, sel) => {
                  if (sel) {
                    if (isDateOnly) {
                      const d = new Date(
                        sel.getFullYear(),
                        sel.getMonth(),
                        sel.getDate(),
                        0,
                        0,
                      );
                      setIosDraft(d);
                    } else {
                      setIosDraft(sel);
                    }
                  }
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

      {error ? <Text className="text-error text-sm mt-1">{error}</Text> : null}
    </View>
  );
}
