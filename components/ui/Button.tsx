import { Pressable, PressableProps } from "react-native";
import { Text } from "./Text";

type Variant = "primary" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

interface Props extends PressableProps {
  variant?: Variant;
  size?: Size;
  label: string;
  className?: string;
}

const variantClasses: Record<Variant, { container: string; text: string }> = {
  primary: {
    container: "bg-primary active:opacity-80",
    text: "text-primary-foreground",
  },
  secondary: {
    container: "bg-muted active:opacity-80",
    text: "text-foreground",
  },
  outline: {
    container: "border border-border active:opacity-80",
    text: "text-foreground",
  },
  ghost: {
    container: "active:opacity-80",
    text: "text-foreground-secondary",
  },
};

const sizeClasses: Record<Size, { container: string; text: string }> = {
  sm: { container: "px-3 py-1.5 rounded-md", text: "text-sm" },
  md: { container: "px-4 py-2.5 rounded-lg", text: "text-base" },
  lg: { container: "px-6 py-3.5 rounded-xl", text: "text-lg" },
};

export function Button({
  variant = "primary",
  size = "md",
  label,
  className = "",
  disabled,
  ...props
}: Props) {
  const v = variantClasses[variant];
  const s = sizeClasses[size];

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
