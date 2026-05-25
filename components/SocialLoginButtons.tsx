import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Separator, Text } from "@/components/ui";
import { GoogleAuthButton } from "./GoogleAuthButton";

interface Props {
  onError: (message: string) => void;
}

export function SocialLoginButtons({ onError }: Props) {
  const { t } = useTranslation();

  return (
    <View>
      <View className="my-6 flex-row items-center">
        <Separator className="flex-1" />
        <Text variant="caption" className="mx-4">{t("common.or")}</Text>
        <Separator className="flex-1" />
      </View>

      <View className="gap-3">
        <GoogleAuthButton onError={onError} />
      </View>
    </View>
  );
}
