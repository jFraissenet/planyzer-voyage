import { Pressable, PressableProps, View } from "react-native";

interface Props extends PressableProps {
  children: React.ReactNode;
  className?: string;
  pressable?: boolean;
}

export function Card({
  children,
  className = "",
  pressable = false,
  ...props
}: Props) {
  const classes = `bg-surface rounded-2xl p-4 border border-border shadow-sm ${className}`;

  if (pressable) {
    return (
      <Pressable className={`${classes} active:scale-[0.98]`} {...props}>
        {children}
      </Pressable>
    );
  }

  return <View className={classes}>{children}</View>;
}
