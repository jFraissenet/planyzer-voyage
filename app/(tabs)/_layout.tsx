import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#2563eb",
        headerStyle: { backgroundColor: "#fff" },
        headerTitleStyle: { fontWeight: "bold" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("trips.title"),
          tabBarLabel: t("tabs.trips"),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t("explore.title"),
          tabBarLabel: t("tabs.explore"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("profile.title"),
          tabBarLabel: t("tabs.profile"),
        }}
      />
    </Tabs>
  );
}
