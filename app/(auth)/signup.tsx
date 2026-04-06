import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";
import { Link } from "expo-router";
import { Button, Input, Text } from "@/components/ui";
import { SocialLoginButtons } from "@/components/SocialLoginButtons";
import { signUpWithEmail } from "@/lib/auth";

export default function SignupScreen() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    setError("");
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    setLoading(true);
    try {
      await signUpWithEmail(email.trim(), password, fullName.trim());
    } catch (e: any) {
      setError(e.message ?? "Erreur lors de l'inscription");
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
          Créer un compte
        </Text>
        <Text variant="caption" className="text-center mb-10">
          Rejoignez Planyzer
        </Text>

        <View className="gap-4">
          <Input
            label="Nom complet"
            placeholder="Jean Dupont"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
          />
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
            placeholder="6 caractères minimum"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error ? (
            <Text className="text-error text-sm text-center">{error}</Text>
          ) : null}

          <Button
            label={loading ? "Création..." : "Créer mon compte"}
            onPress={handleSignup}
            disabled={loading || !email || !password || !fullName}
          />
        </View>

        <SocialLoginButtons onError={setError} />

        <View className="flex-row justify-center mt-8">
          <Text variant="caption">Déjà un compte ? </Text>
          <Link href="/(auth)/login" asChild>
            <Pressable>
              <Text className="text-sm text-primary font-semibold">
                Se connecter
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
