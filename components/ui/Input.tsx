import { TextInput, TextInputProps, View } from "react-native";
import { Text } from "./Text";

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  required?: boolean;
  className?: string;
}

export function Input({ label, error, required, className = "", ...props }: Props) {
  return (
    <View className={`w-full ${className}`}>
      {label && (
        <Text variant="label" className="mb-1.5">
          {label}
          {required ? <Text className="text-error">{" *"}</Text> : null}
        </Text>
      )}
      <TextInput
        className={`w-full px-4 py-3 rounded-lg border bg-surface text-base text-foreground ${
          error ? "border-error" : "border-border"
        }`}
        placeholderTextColor="#9ca3af"
        {...props}
      />
      {error && <Text className="text-error text-sm mt-1">{error}</Text>}
    </View>
  );
}
