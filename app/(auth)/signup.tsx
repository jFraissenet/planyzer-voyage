import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";
import { Link } from "expo-router";
import { useTranslation, Trans } from "react-i18next";
import { Button, Input, Text } from "@/components/ui";
import { SocialLoginButtons } from "@/components/SocialLoginButtons";
import { signUpWithEmail } from "@/lib/auth";

export default function SignupScreen() {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleSignup() {
    setError("");
    if (password.length < 6) {
      setError(t("auth.signup.errorPasswordTooShort"));
      return;
    }
    setLoading(true);
    try {
      const data = await signUpWithEmail(email.trim(), password, fullName.trim());
      if (data.user && data.user.identities?.length === 0) {
        setError(t("auth.signup.errorEmailExists"));
        return;
      }
      if (!data.session) {
        setConfirmationSent(true);
      }
    } catch (e: any) {
      setError(e.message ?? t("auth.signup.errorGeneric"));
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
              {t("auth.signup.confirmationTitle")}
            </Text>
            <Text variant="caption" className="text-center">
              <Trans
                i18nKey="auth.signup.confirmationMessage"
                values={{ email }}
                components={{ bold: <Text className="text-sm font-semibold" /> }}
              />
            </Text>
            <View className="flex-row justify-center mt-6">
              <Link href="/(auth)/login" asChild>
                <Pressable>
                  <Text className="text-sm text-primary font-semibold">
                    {t("auth.signup.backToLogin")}
                  </Text>
                </Pressable>
              </Link>
            </View>
          </View>
        ) : (
          <>
            <Text variant="h1" className="text-center mb-2">
              {t("auth.signup.title")}
            </Text>
            <Text variant="caption" className="text-center mb-10">
              {t("auth.signup.subtitle")}
            </Text>

            <View className="gap-4">
              <Input
                label={t("auth.signup.fullNameLabel")}
                placeholder={t("auth.signup.fullNamePlaceholder")}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                required
              />
              <Input
                label={t("auth.signup.emailLabel")}
                placeholder={t("auth.signup.emailPlaceholder")}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                required
              />
              <Input
                label={t("auth.signup.passwordLabel")}
                placeholder={t("auth.signup.passwordPlaceholder")}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                required
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
                label={loading ? t("auth.signup.submitting") : t("auth.signup.submit")}
                onPress={handleSignup}
                disabled={loading || !email || !password || !fullName}
              />
            </View>

            <SocialLoginButtons onError={setError} />

            <View className="flex-row justify-center mt-8">
              <Text variant="caption">{t("auth.signup.hasAccount")}</Text>
              <Link href="/(auth)/login" asChild>
                <Pressable>
                  <Text className="text-sm text-primary font-semibold">
                    {t("auth.signup.loginLink")}
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
