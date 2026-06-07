import Ionicons from "@expo/vector-icons/Ionicons";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui";
import { theme } from "@/lib/theme";
import { useNotifications } from "@/lib/useNotifications";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

function tabIcon(name: IconName, nameFocused: IconName) {
  return ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
    <Ionicons name={focused ? nameFocused : name} size={size} color={color} />
  );
}

function NotificationsTabButton({ onPress }: BottomTabBarButtonProps) {
  const { unread: count } = useNotifications();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Wrapper sized to the icon so the badge hugs the bell's corner
          (positioned relative to the icon, not the wide tab cell). */}
      <View style={{ position: "relative" }}>
        {/* Solid (filled) bell in amber — not the outline — so it reads clearly. */}
        <Ionicons name="notifications" size={26} color="#FBBF24" />
        {count > 0 ? (
          <View
            style={{
              position: "absolute",
              top: -5,
              right: -7,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              paddingHorizontal: 3,
              backgroundColor: "#EF4444",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1.5,
              borderColor: "#FFFFFF",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "800" }}>
              {count > 99 ? "99+" : count}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: "#A3A3A3",
        tabBarStyle: {
          borderTopColor: "#E8E3DB",
          backgroundColor: "#FFFFFF",
          paddingTop: 2,
          paddingBottom: 2,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          lineHeight: 14,
          paddingTop: 2,
        },
        tabBarIconStyle: {
          marginTop: 0,
          marginBottom: 0,
        },
        tabBarLabelPosition: "below-icon",
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          headerShown: false,
          tabBarLabel: t("tabs.events"),
          // Explicit equal flex so the three labelled tabs share the width
          // evenly (longer labels like "À propos" don't widen their cell).
          tabBarItemStyle: { flex: 1 },
          tabBarIcon: tabIcon("calendar-outline", "calendar"),
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          headerShown: false,
          tabBarLabel: t("tabs.about"),
          tabBarItemStyle: { flex: 1 },
          tabBarIcon: tabIcon(
            "information-circle-outline",
            "information-circle",
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("profile.title"),
          tabBarLabel: t("tabs.profile"),
          tabBarItemStyle: { flex: 1 },
          tabBarIcon: tabIcon("person-outline", "person"),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          headerShown: false,
          // Bell takes only a slim column on the far right (small flex), with a
          // custom button: amber icon + numbered badge.
          tabBarItemStyle: { flex: 0.4 },
          tabBarButton: (props) => <NotificationsTabButton {...props} />,
        }}
      />
    </Tabs>
  );
}
