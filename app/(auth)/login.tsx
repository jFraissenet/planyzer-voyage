import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button, Input, ScreenHeader, Text } from "@/components/ui";
import { SocialLoginButtons } from "@/components/SocialLoginButtons";
import { signInWithEmail } from "@/lib/auth";
import { theme } from "@/lib/theme";

// Available languages mirror what the profile screen exposes; kept inline
// here so the auth flow stays self-contained.
const LANGUAGES = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "zh", label: "中文" },
];

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
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
      <ScreenHeader
        title={t("auth.login.title")}
        subtitle={t("auth.login.subtitle")}
        showLogo
      />
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-4">
          <Input
            label={t("auth.login.emailLabel")}
            placeholder={t("auth.login.emailPlaceholder")}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            required
          />
          <Input
            label={t("auth.login.passwordLabel")}
            placeholder={t("auth.login.passwordPlaceholder")}
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
            variant="cta"
            size="lg"
            label={
              loading ? t("auth.login.submitting") : t("auth.login.submit")
            }
            onPress={handleLogin}
            disabled={loading || !email || !password}
          />
        </View>

        <SocialLoginButtons onError={setError} />

        <View className="flex-row justify-center mt-8">
          <Text variant="caption">{t("auth.login.noAccount")}</Text>
          <Link href="/(auth)/signup" asChild>
            <Pressable>
              <Text
                className="text-sm font-semibold"
                style={{ color: theme.primary }}
              >
                {t("auth.login.signupLink")}
              </Text>
            </Pressable>
          </Link>
        </View>

        {/* Inline language picker so a user can switch UI language before
            even logging in — useful when the auto-detected locale is wrong. */}
        <View
          className="flex-row justify-center flex-wrap mt-10"
          style={{ gap: 16 }}
        >
          {LANGUAGES.map((lang) => {
            const selected = i18n.language === lang.code;
            return (
              <Pressable
                key={lang.code}
                onPress={() => i18n.changeLanguage(lang.code)}
                hitSlop={6}
                className="active:opacity-70"
              >
                <Text
                  style={{
                    color: selected ? theme.primary : "#9CA3AF",
                    fontSize: 13,
                    fontWeight: selected ? "700" : "500",
                  }}
                >
                  {lang.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
