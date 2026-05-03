import Ionicons from "@expo/vector-icons/Ionicons";
import { Image, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsMobile } from "@/lib/responsive";
import { Text } from "./Text";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onAction?: () => void;
  actionIcon?: IconName;
  actionLabel?: string;
  onSecondaryAction?: () => void;
  secondaryActionIcon?: IconName;
  secondaryActionLabel?: string;
  onTitlePress?: () => void;
  showLogo?: boolean;
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  onAction,
  actionIcon,
  actionLabel,
  onSecondaryAction,
  secondaryActionIcon,
  secondaryActionLabel,
  onTitlePress,
  showLogo = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const isMobile = useIsMobile();
  const btnSize = isMobile ? 36 : 44;
  const backIconSize = isMobile ? 22 : 26;
  const actionIconSize = isMobile ? 20 : 24;
  const logoSize = btnSize * 2;

  const titleStyle = {
    color: "#1A1A1A",
    fontSize: 22,
    fontWeight: "800" as const,
    letterSpacing: -0.3,
  };

  const titleNode = onTitlePress ? (
    <Pressable
      onPress={onTitlePress}
      accessibilityLabel={actionLabel ?? title}
      className="active:opacity-70"
      style={{ flex: 1, paddingHorizontal: 8 }}
    >
      <Text
        numberOfLines={2}
        style={{ ...titleStyle, textAlign: "center" }}
      >
        {title}
      </Text>
    </Pressable>
  ) : (
    <Text
      numberOfLines={2}
      style={{
        ...titleStyle,
        flex: 1,
        textAlign: "center",
        paddingHorizontal: 8,
      }}
    >
      {title}
    </Text>
  );

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
              width: btnSize,
              height: btnSize,
              borderRadius: btnSize / 2,
              backgroundColor: "rgba(26,26,26,0.08)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-back" size={backIconSize} color="#1A1A1A" />
          </Pressable>
        ) : showLogo ? (
          <View style={{ width: logoSize, height: btnSize }}>
            <Image
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require("@/assets/planyzer_logo.png")}
              accessibilityLabel="Planyzer"
              resizeMode="contain"
              style={{
                position: "absolute",
                width: logoSize,
                height: logoSize,
                left: 0,
                top: (btnSize - logoSize) / 2,
              }}
            />
          </View>
        ) : (
          <View style={{ width: btnSize }} />
        )}
        {titleNode}
        <View className="flex-row items-center" style={{ gap: 6 }}>
          {onSecondaryAction && secondaryActionIcon ? (
            <Pressable
              onPress={onSecondaryAction}
              hitSlop={10}
              accessibilityLabel={secondaryActionLabel ?? "Action"}
              style={{
                width: btnSize,
                height: btnSize,
                borderRadius: btnSize / 2,
                backgroundColor: "rgba(26,26,26,0.08)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={secondaryActionIcon}
                size={actionIconSize}
                color="#1A1A1A"
              />
            </Pressable>
          ) : null}
          {onAction && actionIcon ? (
            <Pressable
              onPress={onAction}
              hitSlop={10}
              accessibilityLabel={actionLabel ?? "Action"}
              style={{
                width: btnSize,
                height: btnSize,
                borderRadius: btnSize / 2,
                backgroundColor: "rgba(26,26,26,0.08)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={actionIcon}
                size={actionIconSize}
                color="#1A1A1A"
              />
            </Pressable>
          ) : !onSecondaryAction ? (
            <View style={{ width: showLogo ? logoSize : btnSize }} />
          ) : null}
        </View>
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
