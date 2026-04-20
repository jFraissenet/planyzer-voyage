import { ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ScreenHeader, Text } from "@/components/ui";

function Feature({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <View className="flex-row mb-5">
      <View
        className="mr-4 items-center justify-center rounded-2xl"
        style={{
          width: 48,
          height: 48,
          backgroundColor: "#EEECFC",
        }}
      >
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
      <View className="flex-1">
        <Text variant="label" className="mb-1" style={{ fontSize: 15 }}>
          {title}
        </Text>
        <Text variant="caption">{body}</Text>
      </View>
    </View>
  );
}

export default function AboutScreen() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t("about.title")}
        subtitle={t("about.tagline")}
      />
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: 32 }}
      >
        <Text
          variant="body"
          className="mb-8"
          style={{ fontSize: 15, lineHeight: 22 }}
        >
          {t("about.description")}
        </Text>

        <Feature
          icon="🗓"
          title={t("about.feature1Title")}
          body={t("about.feature1Body")}
        />
        <Feature
          icon="🧩"
          title={t("about.feature2Title")}
          body={t("about.feature2Body")}
        />
        <Feature
          icon="🔒"
          title={t("about.feature3Title")}
          body={t("about.feature3Body")}
        />
      </ScrollView>
    </View>
  );
}
