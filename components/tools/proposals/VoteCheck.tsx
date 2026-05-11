import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui";
import { theme } from "@/lib/theme";

// Doodle-style "I'm in" toggle. Maps to vote_value = 'for' (only that one
// value is used in 'check' mode); a missing vote means "not in".

type Props = {
  count: number;          // total voters who said "in"
  isMine: boolean;        // current user is in
  onToggle: () => void;
  size?: "sm" | "md";
  disabled?: boolean;
};

export function VoteCheck({
  count,
  isMine,
  onToggle,
  size = "md",
  disabled = false,
}: Props) {
  const { t } = useTranslation();
  const isSm = size === "sm";
  const height = isSm ? 28 : 34;
  const paddingX = isSm ? 10 : 12;
  const fontSize = isSm ? 12 : 13;
  const iconSize = isSm ? 14 : 16;
  return (
    <View
      className="flex-row items-center"
      style={{ gap: 6, opacity: disabled ? 0.5 : 1 }}
    >
      <Pressable
        onPress={disabled ? undefined : onToggle}
        disabled={disabled}
        hitSlop={4}
        className="flex-row items-center justify-center rounded-full"
        style={{
          height,
          paddingHorizontal: paddingX,
          backgroundColor: isMine ? theme.primary : "#F3F0FA",
          borderWidth: 1,
          borderColor: isMine ? theme.primary : "#E8E3DB",
          gap: 6,
        }}
      >
        <Ionicons
          name={isMine ? "checkmark-circle" : "ellipse-outline"}
          size={iconSize}
          color={isMine ? "#FFFFFF" : theme.primary}
        />
        <Text
          style={{
            color: isMine ? "#FFFFFF" : "#1A1A1A",
            fontSize,
            fontWeight: "700",
          }}
        >
          {isMine ? t("proposals.voteCheck.in") : t("proposals.voteCheck.join")}
        </Text>
      </Pressable>
      <View
        className="px-2 py-0.5 rounded-full"
        style={{ backgroundColor: theme.primarySoft, minWidth: 28 }}
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
