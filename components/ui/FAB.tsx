import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, View } from "react-native";
import { useIsMobile } from "@/lib/responsive";
import { Text } from "./Text";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

interface Props {
  onPress: () => void;
  icon?: IconName;
  label?: string;
  accessibilityLabel?: string;
}

export function FAB({
  onPress,
  icon = "add",
  label,
  accessibilityLabel,
}: Props) {
  const isMobile = useIsMobile();
  const size = isMobile ? 64 : 76;
  const iconSize = isMobile ? 30 : 36;
  const radius = size / 2;
  return (
    <View pointerEvents="box-none" className="absolute right-6 bottom-6">
      <Pressable
        onPress={onPress}
        accessibilityLabel={accessibilityLabel ?? label ?? "Add"}
        style={{ borderRadius: radius }}
      >
        {({ pressed }) => (
          <LinearGradient
            colors={["#4F3FD1", "#6050DC", "#8B7BEE"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              minWidth: size,
              height: size,
              paddingHorizontal: label ? 24 : 0,
              width: label ? undefined : size,
              borderRadius: radius,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              transform: [{ scale: pressed ? 0.95 : 1 }],
              shadowColor: "#6050DC",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.5,
              shadowRadius: 20,
              elevation: 12,
            }}
          >
            <Ionicons name={icon} size={iconSize} color="#fff" />
            {label ? (
              <Text
                className="ml-2 font-bold"
                style={{ color: "#fff", fontSize: 16 }}
              >
                {label}
              </Text>
            ) : null}
          </LinearGradient>
        )}
      </Pressable>
    </View>
  );
}
