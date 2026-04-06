import { View } from "react-native";
import { Text } from "./Text";

type Variant = "default" | "success" | "warning" | "error" | "info";

interface Props {
  label: string;
  variant?: Variant;
  className?: string;
}

const variantClasses: Record<Variant, { container: string; text: string }> = {
  default: { container: "bg-muted", text: "text-muted-foreground" },
  success: { container: "bg-success/10", text: "text-success" },
  warning: { container: "bg-warning/10", text: "text-warning" },
  error: { container: "bg-error/10", text: "text-error" },
  info: { container: "bg-info/10", text: "text-info" },
};

export function Badge({ label, variant = "default", className = "" }: Props) {
  const v = variantClasses[variant];

  return (
    <View className={`self-start px-2.5 py-1 rounded-full ${v.container} ${className}`}>
      <Text className={`text-xs font-medium ${v.text}`}>{label}</Text>
    </View>
  );
}
