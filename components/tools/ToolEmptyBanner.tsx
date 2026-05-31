import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "@/components/ui";
import { theme } from "@/lib/theme";

// Big gradient call-to-action shown in a tool's empty state, mirroring the
// "create your first event" banner on the home screen. Gives a clear creation
// affordance so users (especially on desktop, where the floating + sits in a
// far corner of an otherwise empty screen) don't get lost.
export function ToolEmptyBanner({
  title,
  subtitle,
  onPress,
  icon = "add",
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? title}
      className="active:opacity-90 mb-6 overflow-hidden rounded-2xl"
    >
      <LinearGradient
        colors={[theme.primary, theme.primaryLight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingVertical: 28, paddingHorizontal: 20 }}
      >
        <View className="flex-row items-center" style={{ gap: 16 }}>
          <View
            className="rounded-full items-center justify-center"
            style={{
              width: 56,
              height: 56,
              backgroundColor: "rgba(255,255,255,0.2)",
            }}
          >
            <Ionicons name={icon} size={32} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "700" }}>
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={{
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 13,
                  marginTop: 2,
                }}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}
