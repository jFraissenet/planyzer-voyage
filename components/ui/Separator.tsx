import { View } from "react-native";

interface Props {
  className?: string;
}

export function Separator({ className = "" }: Props) {
  return <View className={`h-px bg-border w-full ${className}`} />;
}
