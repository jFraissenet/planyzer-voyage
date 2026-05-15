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
  onShowVoters?: () => void;
  size?: "sm" | "md";
  disabled?: boolean;
};

export function VoteCheck({
  count,
  isMine,
  onToggle,
  onShowVoters,
  size = "md",
  disabled = false,
}: Props) {
  const { t } = useTranslation();
  const isSm = size === "sm";
  const height = isSm ? 28 : 34;
  const paddingX = isSm ? 10 : 12;
  const countPaddingX = isSm ? 8 : 10;
  const countFontSize = isSm ? 12 : 13;
  const fontSize = isSm ? 12 : 13;
  const iconSize = isSm ? 14 : 16;
  const peopleIconSize = isSm ? 14 : 16;
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
