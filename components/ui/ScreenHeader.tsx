import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./Text";

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

export function ScreenHeader({ title, subtitle, onBack }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: "#FEF3C7",
        paddingTop: insets.top + 16,
        paddingBottom: 20,
        paddingHorizontal: 16,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
      }}
    >
      <View className="flex-row items-center">
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={10}
            accessibilityLabel="Back"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "rgba(26,26,26,0.08)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            color: "#1A1A1A",
            fontSize: 22,
            fontWeight: "800",
            letterSpacing: -0.3,
            textAlign: "center",
            paddingHorizontal: 8,
          }}
        >
          {title}
        </Text>
        <View style={{ width: 36 }} />
      </View>
      {subtitle ? (
        <Text
          style={{
            color: "#78350F",
            fontSize: 14,
            marginTop: 8,
            fontWeight: "500",
            textAlign: "center",
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
