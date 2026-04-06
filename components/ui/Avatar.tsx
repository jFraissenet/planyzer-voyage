import { Image, View } from "react-native";
import { Text } from "./Text";

type Size = "sm" | "md" | "lg";

interface Props {
  src?: string;
  initials?: string;
  size?: Size;
  className?: string;
}

const sizeClasses: Record<Size, { container: string; text: string; image: number }> = {
  sm: { container: "w-8 h-8", text: "text-xs", image: 32 },
  md: { container: "w-10 h-10", text: "text-sm", image: 40 },
  lg: { container: "w-14 h-14", text: "text-lg", image: 56 },
};

export function Avatar({ src, initials, size = "md", className = "" }: Props) {
  const s = sizeClasses[size];

  if (src) {
    return (
      <Image
        source={{ uri: src }}
        className={`${s.container} rounded-full ${className}`}
        style={{ width: s.image, height: s.image }}
      />
    );
  }

  return (
    <View
      className={`${s.container} rounded-full bg-primary/10 items-center justify-center ${className}`}
    >
      <Text className={`${s.text} font-semibold text-primary`}>
        {initials ?? "?"}
      </Text>
    </View>
  );
}
