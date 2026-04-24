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
  size?: "sm" | "md";
};

export function VoteChips({ counts, myVote, onVote, size = "md" }: Props) {
  const isSm = size === "sm";
  const iconSize = isSm ? 13 : 15;
  const height = isSm ? 28 : 34;
  const paddingX = isSm ? 8 : 10;
  const fontSize = isSm ? 12 : 13;

  return (
    <View className="flex-row" style={{ gap: 6 }}>
      {ITEMS.map((it) => {
        const active = myVote === it.value;
        return (
          <Pressable
            key={it.value}
            onPress={() => onVote(it.value)}
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
    </View>
  );
}
