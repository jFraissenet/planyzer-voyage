import { Text as RNText, TextProps } from "react-native";

type Variant = "h1" | "h2" | "h3" | "body" | "caption" | "label";

interface Props extends TextProps {
  variant?: Variant;
  className?: string;
}

const variantClasses: Record<Variant, string> = {
  h1: "text-3xl font-bold text-foreground",
  h2: "text-2xl font-bold text-foreground",
  h3: "text-xl font-semibold text-foreground",
  body: "text-base text-foreground-secondary",
  caption: "text-sm text-foreground-tertiary",
  label: "text-sm font-medium text-foreground-secondary",
};

export function Text({ variant = "body", className = "", ...props }: Props) {
  return (
    <RNText className={`${variantClasses[variant]} ${className}`} {...props} />
  );
}
