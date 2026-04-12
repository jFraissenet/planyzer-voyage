import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button, Separator, Text } from "@/components/ui";
import { useGoogleAuth } from "@/lib/providers";

interface Props {
  onError: (message: string) => void;
}

export function SocialLoginButtons({ onError }: Props) {
  const { t } = useTranslation();
  const google = useGoogleAuth();
  const [loading, setLoading] = useState(false);

  async function handleProvider(signIn: () => Promise<void>) {
    setLoading(true);
    try {
      await signIn();
    } catch (e: any) {
      onError(e.message ?? t("auth.social.errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View>
      <View className="my-6 flex-row items-center">
        <Separator className="flex-1" />
        <Text variant="caption" className="mx-4">{t("common.or")}</Text>
        <Separator className="flex-1" />
      </View>

      <View className="gap-3">
        <Button
          label={google.label}
          variant="outline"
          disabled={loading || google.loading}
          onPress={() => handleProvider(google.signIn)}
        />
      </View>
    </View>
  );
}
