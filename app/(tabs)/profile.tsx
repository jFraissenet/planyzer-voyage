import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  Avatar,
  Button,
  Card,
  Input,
  ScreenHeader,
  Separator,
  Text,
} from "@/components/ui";
import { useSession } from "@/lib/useSession";
import { signOut } from "@/lib/auth";
import {
  getMyPaymentInfo,
  updateMyPaymentInfo,
} from "@/lib/payment";
import { useTutorial } from "@/lib/tutorials/TutorialContext";
import { theme } from "@/lib/theme";

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
  const { openPrompt } = useTutorial();
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

  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentSavedFlash, setPaymentSavedFlash] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const info = await getMyPaymentInfo();
        if (!active || !info) return;
        setIban(info.iban ?? "");
        setBic(info.bic ?? "");
        setAccountHolder(info.account_holder ?? "");
        setPhone(info.phone ?? "");
      } catch {
        // ignore
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const savePayment = async () => {
    setPaymentBusy(true);
    try {
      await updateMyPaymentInfo({
        iban: iban.trim() || null,
        bic: bic.trim() || null,
        account_holder: accountHolder.trim() || null,
        phone: phone.trim() || null,
      });
      setPaymentSavedFlash(true);
      setTimeout(() => setPaymentSavedFlash(false), 2000);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("save payment info failed:", err);
    } finally {
      setPaymentBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t("profile.title")} showLogo />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 80 }}>
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
                  <Text style={selected ? { color: theme.primary } : undefined}>
                    {lang.label}
                  </Text>
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      <Card className="mb-6">
        <Text variant="label" className="mb-1">
          {t("profile.paymentSection")}
        </Text>
        <Text variant="caption" className="mb-3">
          {t("profile.paymentHint")}
        </Text>
        <Input
          label={t("profile.accountHolderLabel")}
          placeholder={t("profile.accountHolderPlaceholder")}
          value={accountHolder}
          onChangeText={setAccountHolder}
          className="mb-3"
        />
        <Input
          label={t("profile.phoneLabel")}
          placeholder={t("profile.phonePlaceholder")}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoCapitalize="none"
          className="mb-3"
        />
        <Input
          label={t("profile.ibanLabel")}
          placeholder={t("profile.ibanPlaceholder")}
          value={iban}
          onChangeText={setIban}
          autoCapitalize="characters"
          className="mb-3"
        />
        <Input
          label={t("profile.bicLabel")}
          placeholder={t("profile.bicPlaceholder")}
          value={bic}
          onChangeText={setBic}
          autoCapitalize="characters"
          className="mb-3"
        />
        <Button
          label={
            paymentBusy
              ? t("profile.paymentSaving")
              : paymentSavedFlash
                ? t("profile.paymentSaved")
                : t("profile.paymentSave")
          }
          onPress={savePayment}
          disabled={paymentBusy}
        />
      </Card>

        <Button
          label="Revoir le tutoriel"
          variant="outline"
          onPress={openPrompt}
          className="mb-3"
        />

        <Button
          label={t("profile.logout")}
          variant="outline"
          onPress={() => signOut()}
        />
      </ScrollView>
    </View>
  );
}
