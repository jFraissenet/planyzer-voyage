import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Text } from "@/components/ui";
import { theme } from "@/lib/theme";

// Single-choice "radio" : at most one 'for' vote per user across all
// proposals of the tool. Picking another option silently moves the vote.

type Props = {
  count: number;
  isMine: boolean;
  onPick: () => void;
  size?: "sm" | "md";
  disabled?: boolean;
};

export function VoteSingle({
  count,
  isMine,
  onPick,
  size = "md",
  disabled = false,
}: Props) {
  const isSm = size === "sm";
  const height = isSm ? 28 : 34;
  const paddingX = isSm ? 10 : 12;
  const iconSize = isSm ? 16 : 20;
  return (
    <View
      className="flex-row items-center"
      style={{ gap: 6, opacity: disabled ? 0.5 : 1 }}
    >
      <Pressable
        onPress={disabled ? undefined : onPick}
        disabled={disabled}
        hitSlop={4}
        className="items-center justify-center rounded-full"
        style={{
          height,
          width: height,
          backgroundColor: isMine ? theme.primary : "#F3F0FA",
          borderWidth: 1,
          borderColor: isMine ? theme.primary : "#E8E3DB",
        }}
      >
        <Ionicons
          name={isMine ? "radio-button-on" : "radio-button-off"}
          size={iconSize}
          color={isMine ? "#FFFFFF" : theme.primary}
        />
      </Pressable>
      <View
        className="px-2 py-0.5 rounded-full"
        style={{ backgroundColor: theme.primarySoft, minWidth: 28, paddingHorizontal: paddingX }}
      >
        <Text
          style={{
            color: theme.primaryDeep,
            fontSize: 11,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          {count}
        </Text>
      </View>
    </View>
  );
}
