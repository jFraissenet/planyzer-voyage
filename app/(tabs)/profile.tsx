import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  Avatar,
  Button,
  Card,
  ScreenHeader,
  Separator,
  Text,
} from "@/components/ui";
import { useSession } from "@/lib/useSession";
import { signOut } from "@/lib/auth";

const languages = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "zh", label: "中文" },
];

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const [langOpen, setLangOpen] = useState(false);
  const { session } = useSession();
  const currentLang =
    languages.find((l) => l.code === i18n.language) ?? languages[1];
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
    <View className="flex-1 bg-background">
      <ScreenHeader title={t("profile.title")} showLogo />
      <View className="px-6 pt-8">
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
        <Pressable
          onPress={() => setLangOpen(true)}
          className="flex-row items-center justify-between py-3 px-3 rounded-lg border border-border"
        >
          <Text>{currentLang.label}</Text>
          <Text variant="caption">▾</Text>
        </Pressable>
      </Card>

      <Modal
        visible={langOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLangOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/40 items-center justify-center px-6"
          onPress={() => setLangOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-background rounded-xl overflow-hidden"
          >
            {languages.map((lang, idx) => {
              const selected = i18n.language === lang.code;
              return (
                <Pressable
                  key={lang.code}
                  onPress={() => {
                    i18n.changeLanguage(lang.code);
                    setLangOpen(false);
                  }}
                  className={`py-3 px-4 ${idx > 0 ? "border-t border-border" : ""} ${selected ? "bg-primary/10" : ""}`}
                >
                  <Text style={selected ? { color: "#6050DC" } : undefined}>
                    {lang.label}
                  </Text>
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

        <Button
          label={t("profile.logout")}
          variant="outline"
          onPress={() => signOut()}
        />
      </View>
    </View>
  );
}
