import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui";
import { theme } from "@/lib/theme";

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
          backgroundColor: theme.primarySoft,
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

const TOOLS: { code: string; icon: string }[] = [
  { code: "money", icon: "💰" },
  { code: "notes", icon: "📝" },
  { code: "car_sharing", icon: "🚗" },
  { code: "proposals", icon: "🗳️" },
];

export function AboutContent() {
  const { t } = useTranslation();
  return (
    <View>
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

      <Text
        variant="caption"
        className="mt-4 mb-4 uppercase"
        style={{
          letterSpacing: 1.2,
          fontWeight: "700",
          fontSize: 11,
          color: theme.sectionLabel,
        }}
      >
        {t("about.toolsSection")}
      </Text>

      {TOOLS.map((tool) => (
        <Feature
          key={tool.code}
          icon={tool.icon}
          title={t(`about.tools.${tool.code}.title`)}
          body={t(`about.tools.${tool.code}.body`)}
        />
      ))}
    </View>
  );
}
