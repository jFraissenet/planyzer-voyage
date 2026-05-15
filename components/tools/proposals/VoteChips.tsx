import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Text } from "@/components/ui";
import type { VoteValue } from "@/lib/proposals";

type ItemConfig = {
  value: VoteValue;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
};

const ITEMS: ItemConfig[] = [
  { value: "for", icon: "thumbs-up", color: "#16A34A" },
  { value: "neutral", icon: "remove-circle", color: "#6B6B6B" },
  { value: "against", icon: "thumbs-down", color: "#DC2626" },
];

type CountsMap = Record<VoteValue, number>;

type Props = {
  counts: CountsMap;
  myVote: VoteValue | null;
  onVote: (value: VoteValue) => void;
  // Tapping the currently-active chip clears the vote — mirrors the toggle
  // behavior of check/single styles so users can change their mind to "no
  // opinion" without having to pick another option.
  onClearVote: () => void;
  // Optional: when provided, a dedicated 👥 button sits next to the chips
  // and opens the voters modal. The whole chip stays tap-to-vote so the tap
  // targets remain large and unambiguous.
  onShowVoters?: () => void;
  size?: "sm" | "md";
  disabled?: boolean;
};

export function VoteChips({
  counts,
  myVote,
  onVote,
  onClearVote,
  onShowVoters,
  size = "md",
  disabled = false,
}: Props) {
  const isSm = size === "sm";
  const iconSize = isSm ? 13 : 15;
  const height = isSm ? 28 : 34;
  const paddingX = isSm ? 8 : 10;
  const fontSize = isSm ? 12 : 13;
  const peopleIconSize = isSm ? 14 : 16;

  return (
    <View className="flex-row items-center" style={{ gap: 6, opacity: disabled ? 0.5 : 1 }}>
      {ITEMS.map((it) => {
        const active = myVote === it.value;
        return (
          <Pressable
            key={it.value}
            onPress={
              disabled
                ? undefined
                : () => (active ? onClearVote() : onVote(it.value))
            }
            disabled={disabled}
            hitSlop={4}
            className="flex-row items-center justify-center rounded-full"
            style={{
              height,
              paddingHorizontal: paddingX,
              backgroundColor: active ? it.color : "#F3F0FA",
              borderWidth: 1,
              borderColor: active ? it.color : "#E8E3DB",
              gap: 4,
            }}
          >
            <Ionicons
              name={it.icon}
              size={iconSize}
              color={active ? "#FFFFFF" : it.color}
            />
            <Text
              style={{
                color: active ? "#FFFFFF" : "#1A1A1A",
                fontSize,
                fontWeight: "700",
              }}
            >
              {counts[it.value]}
            </Text>
          </Pressable>
        );
      })}
      {onShowVoters ? (
        <Pressable
          onPress={onShowVoters}
          hitSlop={6}
          className="flex-row items-center justify-center rounded-full active:opacity-70"
          style={{
            height,
            paddingHorizontal: paddingX,
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
              fontSize,
              fontWeight: "700",
            }}
          >
            {counts.for + counts.neutral + counts.against}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
