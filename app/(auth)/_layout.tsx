import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

function tabIcon(name: IconName, nameFocused: IconName) {
  return ({ color, focused, size }: { color: string; focused: boolean; size: number }) => (
    <Ionicons name={focused ? nameFocused : name} size={size} color={color} />
  );
}

export default function AuthLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#6050DC",
        tabBarInactiveTintColor: "#A3A3A3",
        tabBarStyle: {
          borderTopColor: "#E8E3DB",
          backgroundColor: "#FFFFFF",
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="login"
        options={{
          tabBarLabel: t("auth.switcher.login"),
          tabBarIcon: tabIcon("log-in-outline", "log-in"),
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          tabBarLabel: t("auth.switcher.about"),
          tabBarIcon: tabIcon(
            "information-circle-outline",
            "information-circle",
          ),
        }}
      />
      <Tabs.Screen name="signup" options={{ href: null }} />
    </Tabs>
  );
}
