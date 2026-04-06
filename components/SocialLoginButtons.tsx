import { useState } from "react";
import { View } from "react-native";
import { Button, Separator, Text } from "@/components/ui";
import { useGoogleAuth } from "@/lib/providers";

interface Props {
  onError: (message: string) => void;
}

export function SocialLoginButtons({ onError }: Props) {
  const google = useGoogleAuth();
  const [loading, setLoading] = useState(false);

  async function handleProvider(signIn: () => Promise<void>) {
    setLoading(true);
    try {
      await signIn();
    } catch (e: any) {
      onError(e.message ?? "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View>
      <View className="my-6 flex-row items-center">
        <Separator className="flex-1" />
        <Text variant="caption" className="mx-4">ou</Text>
        <Separator className="flex-1" />
      </View>

      <View className="gap-3">
        <Button
          label={google.label}
          variant="outline"
          disabled={loading || google.loading}
          onPress={() => handleProvider(google.signIn)}
        />
        {/* Ajouter d'autres providers ici :
        <Button
          label="Continuer avec Apple"
          variant="outline"
          onPress={() => handleProvider(apple.signIn)}
        />
        */}
      </View>
    </View>
  );
}
