import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button, Input, Text } from "@/components/ui";
import { SocialLoginButtons } from "@/components/SocialLoginButtons";
import { signInWithEmail } from "@/lib/auth";

export default function LoginScreen() {
  const { t } = useTranslation();
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
      const msg = e.message ?? "";
      if (msg.includes("Invalid login credentials")) {
        setError(t("auth.login.errorInvalidCredentials"));
      } else if (msg.includes("Email not confirmed")) {
        setError(t("auth.login.errorEmailNotConfirmed"));
      } else {
        setError(msg || t("auth.login.errorGeneric"));
      }
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
          {t("auth.login.title")}
        </Text>
        <Text variant="caption" className="text-center mb-10">
          {t("auth.login.subtitle")}
        </Text>

        <View className="gap-4">
          <Input
            label={t("auth.login.emailLabel")}
            placeholder={t("auth.login.emailPlaceholder")}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label={t("auth.login.passwordLabel")}
            placeholder={t("auth.login.passwordPlaceholder")}
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
            label={loading ? t("auth.login.submitting") : t("auth.login.submit")}
            onPress={handleLogin}
            disabled={loading || !email || !password}
          />
        </View>

        <SocialLoginButtons onError={setError} />

        <View className="flex-row justify-center mt-8">
          <Text variant="caption">{t("auth.login.noAccount")}</Text>
          <Link href="/(auth)/signup" asChild>
            <Pressable>
              <Text className="text-sm text-primary font-semibold">
                {t("auth.login.signupLink")}
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
