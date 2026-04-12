import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

export default function ExploreScreen() {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold mb-2">{t("explore.title")}</Text>
      <Text className="text-base text-gray-500">{t("explore.subtitle")}</Text>
    </View>
  );
}
