import { LinearGradient } from "expo-linear-gradient";
import { Pressable, PressableProps, View } from "react-native";
import { Text } from "./Text";
import { theme } from "@/lib/theme";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "cta";
type Size = "sm" | "md" | "lg";

interface Props extends PressableProps {
  variant?: Variant;
  size?: Size;
  label: string;
  className?: string;
}

const variantClasses: Record<
  Exclude<Variant, "cta">,
  { container: string; text: string }
> = {
  primary: {
    container: "bg-primary active:opacity-85",
    text: "text-primary-foreground",
  },
  secondary: {
    container: "bg-muted active:opacity-80",
    text: "text-foreground",
  },
  outline: {
    container: "border border-border active:opacity-80 bg-surface",
    text: "text-foreground",
  },
  ghost: {
    container: "active:opacity-70",
    text: "text-foreground-secondary",
  },
};

const sizeClasses: Record<Size, { container: string; text: string }> = {
  sm: { container: "px-3 py-2 rounded-lg", text: "text-sm" },
  md: { container: "px-4 py-3 rounded-xl", text: "text-base" },
  lg: { container: "px-6 py-4 rounded-2xl", text: "text-lg" },
};

export function Button({
  variant = "primary",
  size = "md",
  label,
  className = "",
  disabled,
  ...props
}: Props) {
  const s = sizeClasses[size];

  if (variant === "cta") {
    return (
      <Pressable
        disabled={disabled}
        className={disabled ? "opacity-50" : ""}
        {...props}
      >
        {({ pressed }) => (
          <LinearGradient
            colors={[theme.primaryDeep, theme.primary, theme.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.92 : 1,
              shadowColor: theme.primary,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.35,
              shadowRadius: 12,
              elevation: 6,
            }}
            className={`${s.container} ${className}`}
          >
            <Text className={`font-bold ${s.text}`} style={{ color: "#fff" }}>
              {label}
            </Text>
          </LinearGradient>
        )}
      </Pressable>
    );
  }

  const v = variantClasses[variant];

  return (
    <Pressable
      className={`items-center justify-center ${s.container} ${v.container} ${disabled ? "opacity-50" : ""} ${className}`}
      disabled={disabled}
      {...props}
    >
      <Text className={`font-semibold ${s.text} ${v.text}`}>{label}</Text>
    </Pressable>
  );
}
