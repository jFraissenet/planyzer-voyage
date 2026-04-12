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
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleSignup() {
    setError("");
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    setLoading(true);
    try {
      const data = await signUpWithEmail(email.trim(), password, fullName.trim());
      // Supabase returns a user with empty identities when the email already exists
      if (data.user && data.user.identities?.length === 0) {
        setError(
          "Un compte existe déjà avec cet email. Essayez de vous connecter avec Google ou avec votre mot de passe."
        );
        return;
      }
      if (!data.session) {
        setConfirmationSent(true);
      }
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
        {confirmationSent ? (
          <View className="gap-4">
            <Text variant="h1" className="text-center mb-2">
              Vérifiez vos emails
            </Text>
            <Text variant="caption" className="text-center">
              Un email de confirmation a été envoyé à{" "}
              <Text className="text-sm font-semibold">{email}</Text>.
              {"\n"}Cliquez sur le lien pour activer votre compte.
            </Text>
            <View className="flex-row justify-center mt-6">
              <Link href="/(auth)/login" asChild>
                <Pressable>
                  <Text className="text-sm text-primary font-semibold">
                    Retour à la connexion
                  </Text>
                </Pressable>
              </Link>
            </View>
          </View>
        ) : (
          <>
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
                <View className="bg-error/10 rounded-lg px-4 py-3">
                  <Text
                    variant="label"
                    className="text-center"
                    style={{ color: "#ef4444" }}
                  >
                    {error}
                  </Text>
                </View>
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
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
