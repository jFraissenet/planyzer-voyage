import { Pressable, PressableProps, View, ViewStyle } from "react-native";

interface Props extends PressableProps {
  children: React.ReactNode;
  className?: string;
  pressable?: boolean;
}

const shadowStyle: ViewStyle = {
  shadowColor: "#6050DC",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 2,
};

export function Card({
  children,
  className = "",
  pressable = false,
  ...props
}: Props) {
  const classes = `bg-surface rounded-2xl p-4 border border-border ${className}`;

  if (pressable) {
    return (
      <Pressable
        className={`${classes} active:scale-[0.98] active:opacity-95`}
        style={shadowStyle}
        {...props}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View className={classes} style={shadowStyle}>
      {children}
    </View>
  );
}
