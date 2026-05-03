import {
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  View,
  ViewStyle,
} from "react-native";
import { theme } from "@/lib/theme";

interface Props extends Omit<PressableProps, "style"> {
  children: React.ReactNode;
  className?: string;
  pressable?: boolean;
  style?: StyleProp<ViewStyle>;
}

const shadowStyle: ViewStyle = {
  shadowColor: theme.primary,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 2,
};

export function Card({
  children,
  className = "",
  pressable = false,
  style,
  ...props
}: Props) {
  const classes = `bg-surface rounded-2xl p-4 border border-border ${className}`;
  const mergedStyle: StyleProp<ViewStyle> = style
    ? [shadowStyle, style]
    : shadowStyle;

  if (pressable) {
    const pressClasses =
      Platform.OS === "web"
        ? "active:opacity-95"
        : "active:scale-[0.98] active:opacity-95";
    return (
      <Pressable
        className={`${classes} ${pressClasses}`}
        style={mergedStyle}
        {...props}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View className={classes} style={mergedStyle}>
      {children}
    </View>
  );
}
