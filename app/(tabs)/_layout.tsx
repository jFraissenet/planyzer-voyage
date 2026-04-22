import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

function tabIcon(name: IconName, nameFocused: IconName) {
  return ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
    <Ionicons name={focused ? nameFocused : name} size={size} color={color} />
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#6050DC",
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
          tabBarIcon: tabIcon("calendar-outline", "calendar"),
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          headerShown: false,
          tabBarLabel: t("tabs.about"),
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
          tabBarIcon: tabIcon("person-outline", "person"),
        }}
      />
    </Tabs>
  );
}
