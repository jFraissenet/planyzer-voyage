import { Pressable, ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AboutContent } from "@/components/AboutContent";
import { ScreenHeader, Text } from "@/components/ui";
import { theme } from "@/lib/theme";

// Same inline language strip as the login screen — lets a visitor switch
// the marketing copy's language before any account exists.
const LANGUAGES = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "zh", label: "中文" },
];

export default function AuthAboutScreen() {
  const { t, i18n } = useTranslation();
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t("about.title")}
        subtitle={t("about.tagline")}
        showLogo
      />
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 32 }}>
        <AboutContent />

        <View
          className="flex-row justify-center flex-wrap mt-10"
          style={{ gap: 16 }}
        >
          {LANGUAGES.map((lang) => {
            const selected = i18n.language === lang.code;
            return (
              <Pressable
                key={lang.code}
                onPress={() => i18n.changeLanguage(lang.code)}
                hitSlop={6}
                className="active:opacity-70"
              >
                <Text
                  style={{
                    color: selected ? theme.primary : "#9CA3AF",
                    fontSize: 13,
                    fontWeight: selected ? "700" : "500",
                  }}
                >
                  {lang.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
