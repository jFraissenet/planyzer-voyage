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
  onShowVoters?: () => void;
  size?: "sm" | "md";
  disabled?: boolean;
};

export function VoteSingle({
  count,
  isMine,
  onPick,
  onShowVoters,
  size = "md",
  disabled = false,
}: Props) {
  const isSm = size === "sm";
  const height = isSm ? 28 : 34;
  const countPaddingX = isSm ? 8 : 10;
  const countFontSize = isSm ? 12 : 13;
  const iconSize = isSm ? 16 : 20;
  const peopleIconSize = isSm ? 14 : 16;
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
      {onShowVoters ? (
        <Pressable
          onPress={onShowVoters}
          hitSlop={6}
          className="flex-row items-center justify-center rounded-full active:opacity-70"
          style={{
            height,
            paddingHorizontal: countPaddingX,
            backgroundColor: "#F3F0FA",
            borderWidth: 1,
            borderColor: "#E8E3DB",
            gap: 4,
          }}
        >
          <Ionicons name="people-outline" size={peopleIconSize} color="#6B6B6B" />
          <Text
            style={{
              color: "#1A1A1A",
              fontSize: countFontSize,
              fontWeight: "700",
            }}
          >
            {count}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
