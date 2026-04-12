import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Avatar, Button, Card, Separator, Text } from "@/components/ui";
import { useSession } from "@/lib/useSession";
import { signOut } from "@/lib/auth";

const languages = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
];

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const user = session?.user;
  const fullName = user?.user_metadata?.full_name;
  const avatarUrl = user?.user_metadata?.avatar_url;
  const initials = fullName
    ? fullName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <View className="flex-1 bg-background px-6 pt-16">
      <View className="items-center mb-8">
        <Avatar
          src={avatarUrl}
          initials={initials}
          size="lg"
          className="mb-3"
        />
        <Text variant="h2">{fullName ?? t("profile.defaultName")}</Text>
        <Text variant="caption">{user?.email}</Text>
      </View>

      <Card className="mb-6">
        <Text variant="label" className="mb-1">
          {t("profile.emailLabel")}
        </Text>
        <Text>{user?.email}</Text>
        <Separator className="my-3" />
        <Text variant="label" className="mb-1">
          {t("profile.providerLabel")}
        </Text>
        <Text className="capitalize">
          {user?.app_metadata?.provider ?? "email"}
        </Text>
        <Separator className="my-3" />
        <Text variant="label" className="mb-2">
          {t("profile.languageLabel")}
        </Text>
        <View className="flex-row gap-2">
          {languages.map((lang) => (
            <Pressable
              key={lang.code}
              onPress={() => i18n.changeLanguage(lang.code)}
              className={`flex-1 items-center py-2 rounded-lg border ${
                i18n.language === lang.code
                  ? "border-primary bg-primary/10"
                  : "border-border"
              }`}
            >
              <Text
                variant="label"
                style={
                  i18n.language === lang.code
                    ? { color: "#2563eb" }
                    : undefined
                }
              >
                {lang.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Button
        label={t("profile.logout")}
        variant="outline"
        onPress={() => signOut()}
      />
    </View>
  );
}
