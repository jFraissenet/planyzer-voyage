import { Platform, TextInput, View } from "react-native";
import { Text } from "./Text";

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
};

export function DateTimeInput({
  label,
  value,
  onChange,
  placeholder,
  error,
}: Props) {
  const borderClass = error ? "border-error" : "border-border";

  return (
    <View className="w-full">
      <Text variant="label" className="mb-1.5">
        {label}
      </Text>
      {Platform.OS === "web" ? (
        <input
          type="datetime-local"
          value={value}
          onChange={(e: { target: { value: string } }) =>
            onChange(e.target.value)
          }
          className={`w-full px-4 py-3 rounded-lg border bg-surface text-base text-foreground ${borderClass}`}
          style={{ fontFamily: "inherit", outline: "none" }}
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
