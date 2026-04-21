import { ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AboutContent } from "@/components/AboutContent";
import { ScreenHeader } from "@/components/ui";

export default function AuthAboutScreen() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t("about.title")} subtitle={t("about.tagline")} />
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 32 }}>
        <AboutContent />
      </ScrollView>
    </View>
  );
}
