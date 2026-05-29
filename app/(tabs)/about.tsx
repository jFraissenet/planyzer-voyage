import { ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AboutContent } from "@/components/AboutContent";
import { Button, ScreenHeader } from "@/components/ui";
import { useTutorial } from "@/lib/tutorials/TutorialContext";

export default function AboutScreen() {
  const { t } = useTranslation();
  const { openPrompt } = useTutorial();
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t("about.title")} subtitle={t("about.tagline")} showLogo />
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 32 }}>
        <AboutContent />
        <View className="mt-6">
          <Button label="Voir un tutoriel" onPress={openPrompt} />
        </View>
      </ScrollView>
    </View>
  );
}
