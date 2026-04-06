import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";
import { Link } from "expo-router";
import { Button, Input, Text } from "@/components/ui";
import { SocialLoginButtons } from "@/components/SocialLoginButtons";
import { signInWithEmail } from "@/lib/auth";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError("");
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
    } catch (e: any) {
      setError(e.message ?? "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background"
    >
      <View className="flex-1 justify-center px-6">
        <Text variant="h1" className="text-center mb-2">
          Planyzer
        </Text>
        <Text variant="caption" className="text-center mb-10">
          Organisez vos voyages simplement
        </Text>

        <View className="gap-4">
          <Input
            label="Email"
            placeholder="votre@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label="Mot de passe"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error ? (
            <Text className="text-error text-sm text-center">{error}</Text>
          ) : null}

          <Button
            label={loading ? "Connexion..." : "Se connecter"}
            onPress={handleLogin}
            disabled={loading || !email || !password}
          />
        </View>

        <SocialLoginButtons onError={setError} />

        <View className="flex-row justify-center mt-8">
          <Text variant="caption">Pas encore de compte ? </Text>
          <Link href="/(auth)/signup" asChild>
            <Pressable>
              <Text className="text-sm text-primary font-semibold">
                S'inscrire
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
