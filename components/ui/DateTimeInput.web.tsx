import { Platform, TextInput, View } from "react-native";
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

// We keep the value contract stable as YYYY-MM-DDTHH:MM regardless of the
// input mode. In `date` mode we strip the T... part for the underlying
// <input type="date"> and pad it back with T00:00 on change so callers
// don't have to special-case the format.

export function DateTimeInput({
  label,
  value,
  onChange,
  placeholder,
  error,
  mode = "datetime",
  required,
}: Props) {
  const borderClass = error ? "border-error" : "border-border";
  const isDateOnly = mode === "date";
  const inputValue = isDateOnly ? (value ? value.split("T")[0] : "") : value;

  const handleWebChange = (next: string) => {
    if (isDateOnly) onChange(next ? `${next}T00:00` : "");
    else onChange(next);
  };

  return (
    <View className="w-full">
      <Text variant="label" className="mb-1.5">
        {label}
        {required ? <Text className="text-error">{" *"}</Text> : null}
      </Text>
      {Platform.OS === "web" ? (
        <input
          type={isDateOnly ? "date" : "datetime-local"}
          value={inputValue}
          onChange={(e: { target: { value: string } }) =>
            handleWebChange(e.target.value)
          }
          className={`w-full px-4 py-3 rounded-lg border bg-surface text-base text-foreground ${borderClass}`}
          style={{
            fontFamily: "inherit",
            outline: "none",
            width: "100%",
            minWidth: 0,
            boxSizing: "border-box",
          }}
        />
      ) : (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          className={`w-full px-4 py-3 rounded-lg border bg-surface text-base text-foreground ${borderClass}`}
        />
      )}
      {error ? <Text className="text-error text-sm mt-1">{error}</Text> : null}
    </View>
  );
}
