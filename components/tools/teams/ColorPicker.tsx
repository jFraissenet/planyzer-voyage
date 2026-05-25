import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

const PRESETS: string[] = [
  "#10B981", // emerald (brand)
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#EF4444", // red
  "#F59E0B", // amber
  "#84CC16", // lime
  "#06B6D4", // cyan
  "#6366F1", // indigo
  "#F97316", // orange
  "#14B8A6", // teal
  "#A855F7", // purple
];

type Props = {
  value: string;
  onChange: (color: string) => void;
};

export function ColorPicker({ value, onChange }: Props) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: 10 }}>
      {PRESETS.map((c) => {
        const selected = c.toLowerCase() === value.toLowerCase();
        return (
          <Pressable
            key={c}
            onPress={() => onChange(c)}
            hitSlop={4}
            className="items-center justify-center"
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: c,
              borderWidth: selected ? 3 : 0,
              borderColor: "#1A1A1A",
            }}
          >
            {selected ? (
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
