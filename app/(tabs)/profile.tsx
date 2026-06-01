import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Input,
  ScreenHeader,
  Separator,
  Text,
  useToast,
} from "@/components/ui";
import { useSession } from "@/lib/useSession";
import { signOut } from "@/lib/auth";
import {
  getMyPaymentInfo,
  updateMyPaymentInfo,
} from "@/lib/payment";
import {
  listAllBugReports,
  submitBugReport,
  type BugReport,
} from "@/lib/bugReports";
import { theme } from "@/lib/theme";

const languages = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "zh", label: "中文" },
];

function initialsOf(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { show: showToast } = useToast();
  const [langOpen, setLangOpen] = useState(false);
  const [bugOpen, setBugOpen] = useState(false);
  const [bugTitle, setBugTitle] = useState("");
  const [bugDescription, setBugDescription] = useState("");
  const [bugBusy, setBugBusy] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [allBugs, setAllBugs] = useState<BugReport[]>([]);
  const [bugsLoading, setBugsLoading] = useState(false);
  const [bugSearch, setBugSearch] = useState("");
  const [bugStatusFilter, setBugStatusFilter] = useState<
    "all" | "open" | "resolved" | "closed"
  >("all");
  const [bugSortDesc, setBugSortDesc] = useState(true);
  const [bugOwnerFilter, setBugOwnerFilter] = useState<
    "all" | "mine" | "others"
  >("all");
  const [selectedBug, setSelectedBug] = useState<BugReport | null>(null);
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

  const closeBug = () => {
    if (bugBusy) return;
    setBugOpen(false);
    setBugTitle("");
    setBugDescription("");
  };

  const submitBug = async () => {
    const title = bugTitle.trim();
    if (!title) return;
    setBugBusy(true);
    try {
      await submitBugReport({ title, description: bugDescription.trim() });
      setBugOpen(false);
      setBugTitle("");
      setBugDescription("");
      showToast(t("profile.bugSuccess"), { variant: "success", duration: 3000 });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("submit bug report failed:", err);
      showToast(t("profile.bugError"), { variant: "error", duration: 3000 });
    } finally {
      setBugBusy(false);
    }
  };

  const openViewBugs = async () => {
    setViewOpen(true);
    setBugSearch("");
    setBugStatusFilter("all");
    setBugOwnerFilter("all");
    setBugSortDesc(true);
    setBugsLoading(true);
    try {
      setAllBugs(await listAllBugReports());
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("list bug reports failed:", err);
      setAllBugs([]);
    } finally {
      setBugsLoading(false);
    }
  };

  const statusVariant = (status: string) =>
    status === "resolved"
      ? "success"
      : status === "closed"
        ? "default"
        : "warning";

  const statusLabel = (status: string) =>
    status === "resolved"
      ? t("profile.bugStatusResolved")
      : status === "closed"
        ? t("profile.bugStatusClosed")
        : t("profile.bugStatusOpen");

  const statusFilters = [
    { key: "all" as const, label: t("profile.bugFilterAll") },
    { key: "open" as const, label: t("profile.bugStatusOpen") },
    { key: "resolved" as const, label: t("profile.bugStatusResolved") },
    { key: "closed" as const, label: t("profile.bugStatusClosed") },
  ];

  const ownerFilters = [
    { key: "all" as const, label: t("profile.bugFilterAll") },
    { key: "mine" as const, label: t("profile.bugFilterMine") },
    { key: "others" as const, label: t("profile.bugFilterOthers") },
  ];

  const filteredBugs = useMemo(() => {
    const q = bugSearch.trim().toLowerCase();
    let list = allBugs;
    if (bugStatusFilter !== "all") {
      list = list.filter((b) => b.status === bugStatusFilter);
    }
    if (bugOwnerFilter !== "all" && user?.id) {
      list = list.filter((b) =>
        bugOwnerFilter === "mine"
          ? b.reporter_id === user.id
          : b.reporter_id !== user.id,
      );
    }
    if (q) {
      list = list.filter((b) => b.title.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return bugSortDesc ? db - da : da - db;
    });
  }, [allBugs, bugSearch, bugStatusFilter, bugOwnerFilter, bugSortDesc, user?.id]);

  const shortDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });

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

        <View className="flex-row mb-2" style={{ gap: 8 }}>
          <View className="flex-1">
            <Button
              label={t("profile.reportBug")}
              variant="ghost"
              onPress={() => setBugOpen(true)}
            />
          </View>
          <View className="flex-1">
            <Button
              label={t("profile.viewBugs")}
              variant="ghost"
              onPress={openViewBugs}
            />
          </View>
        </View>

        <Button
          label={t("profile.logout")}
          variant="outline"
          onPress={() => signOut()}
        />
      </ScrollView>

      <Modal
        visible={bugOpen}
        transparent
        animationType="fade"
        onRequestClose={closeBug}
      >
        <Pressable
          className="flex-1 bg-black/40 items-center justify-center px-4"
          onPress={closeBug}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-background rounded-2xl p-5"
          >
            <Text variant="h2" className="mb-1">
              {t("profile.reportBug")}
            </Text>
            <Text variant="caption" className="mb-4">
              {t("profile.bugHint")}
            </Text>
            <Input
              label={t("profile.bugTitleLabel")}
              placeholder={t("profile.bugTitlePlaceholder")}
              value={bugTitle}
              onChangeText={setBugTitle}
              className="mb-3"
              required
            />
            <Input
              label={t("profile.bugDescriptionLabel")}
              placeholder={t("profile.bugDescriptionPlaceholder")}
              value={bugDescription}
              onChangeText={setBugDescription}
              multiline
              numberOfLines={4}
              className="mb-4"
              style={{ minHeight: 96, textAlignVertical: "top" }}
            />
            <View className="gap-2">
              <Button
                label={bugBusy ? t("profile.bugSubmitting") : t("profile.bugSubmit")}
                onPress={submitBug}
                disabled={bugBusy || !bugTitle.trim()}
              />
              <Button
                label={t("common.cancel")}
                variant="ghost"
                onPress={closeBug}
                disabled={bugBusy}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={viewOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setViewOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/40 items-center justify-center px-4"
          onPress={() => setViewOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-background rounded-2xl p-5"
            style={{ maxHeight: "85%" }}
          >
            <Text variant="h2" className="mb-3">
              {t("profile.bugsTitle")}
            </Text>

            <Input
              placeholder={t("profile.bugSearchPlaceholder")}
              value={bugSearch}
              onChangeText={setBugSearch}
              className="mb-2"
            />
            <View
              className="flex-row flex-wrap items-center mb-3"
              style={{ gap: 6 }}
            >
              {statusFilters.map((f) => {
                const active = bugStatusFilter === f.key;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => setBugStatusFilter(f.key)}
                    className="px-3 py-1 rounded-full"
                    style={{
                      backgroundColor: active
                        ? theme.primary
                        : theme.primarySoft,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? "#FFFFFF" : theme.primary,
                        fontWeight: "700",
                        fontSize: 12,
                      }}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View
              className="flex-row flex-wrap items-center mb-3"
              style={{ gap: 6 }}
            >
              {ownerFilters.map((f) => {
                const active = bugOwnerFilter === f.key;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => setBugOwnerFilter(f.key)}
                    className="px-3 py-1 rounded-full"
                    style={{
                      backgroundColor: active
                        ? theme.primary
                        : theme.primarySoft,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? "#FFFFFF" : theme.primary,
                        fontWeight: "700",
                        fontSize: 12,
                      }}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {bugsLoading ? (
              <Text variant="caption" className="py-6 text-center">
                {t("common.loading")}
              </Text>
            ) : filteredBugs.length === 0 ? (
              <Text variant="caption" className="py-6 text-center">
                {t("profile.bugEmpty")}
              </Text>
            ) : (
              <>
                {/* Table header */}
                <View
                  className="flex-row items-center border-b border-border pb-2 mb-1"
                  style={{ gap: 8 }}
                >
                  <Text
                    variant="caption"
                    className="flex-1"
                    style={{ fontWeight: "700" }}
                  >
                    {t("profile.bugTitleLabel")}
                  </Text>
                  <Pressable
                    onPress={() => setBugSortDesc((v) => !v)}
                    hitSlop={6}
                    className="flex-row items-center"
                    style={{ width: 60, gap: 2 }}
                  >
                    <Text variant="caption" style={{ fontWeight: "700" }}>
                      {t("profile.bugColDate")}
                    </Text>
                    <Ionicons
                      name={bugSortDesc ? "arrow-down" : "arrow-up"}
                      size={12}
                      color={theme.primary}
                    />
                  </Pressable>
                  <Text
                    variant="caption"
                    style={{ width: 76, fontWeight: "700", textAlign: "right" }}
                  >
                    {t("profile.bugColStatus")}
                  </Text>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  className="mb-4"
                >
                  {filteredBugs.map((b) => (
                    <Pressable
                      key={b.id}
                      onPress={() => setSelectedBug(b)}
                      className="flex-row items-center py-2.5 border-b border-border active:opacity-60"
                      style={{ gap: 8 }}
                    >
                      <Text
                        className="flex-1"
                        numberOfLines={1}
                        style={{ fontSize: 14 }}
                      >
                        {b.title}
                      </Text>
                      <Text
                        variant="caption"
                        style={{ width: 60, fontSize: 11 }}
                      >
                        {shortDate(b.created_at)}
                      </Text>
                      <View style={{ width: 76, alignItems: "flex-end" }}>
                        <Badge
                          label={statusLabel(b.status)}
                          variant={statusVariant(b.status)}
                        />
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}

            <Button
              label={t("common.close")}
              variant="ghost"
              onPress={() => setViewOpen(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!selectedBug}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedBug(null)}
      >
        <Pressable
          className="flex-1 bg-black/40 items-center justify-center px-4"
          onPress={() => setSelectedBug(null)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-background rounded-2xl p-5"
            style={{ maxHeight: "85%" }}
          >
            {selectedBug ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View
                  className="flex-row items-start mb-3"
                  style={{ gap: 8 }}
                >
                  <Text variant="h2" className="flex-1">
                    {selectedBug.title}
                  </Text>
                  <Badge
                    label={statusLabel(selectedBug.status)}
                    variant={statusVariant(selectedBug.status)}
                  />
                </View>

                {selectedBug.description ? (
                  <Text className="mb-2" style={{ lineHeight: 20 }}>
                    {selectedBug.description}
                  </Text>
                ) : null}

                <Separator className="my-3" />

                <Text variant="caption" className="mb-1">
                  {t("profile.bugReporterLabel")}
                </Text>
                <View
                  className="flex-row items-center mb-4"
                  style={{ gap: 6 }}
                >
                  <Avatar
                    src={selectedBug.reporter_avatar_url ?? undefined}
                    initials={initialsOf(selectedBug.reporter_name)}
                    size="sm"
                  />
                  <Text className="flex-1" numberOfLines={1}>
                    {selectedBug.reporter_name ?? t("profile.defaultName")}
                  </Text>
                </View>

                <Text variant="caption" className="mb-1">
                  {t("profile.bugColDate")}
                </Text>
                <Text className="mb-4">
                  {new Date(selectedBug.created_at).toLocaleDateString(
                    i18n.language,
                    { day: "2-digit", month: "long", year: "numeric" },
                  )}
                </Text>

                <Button
                  label={t("common.close")}
                  variant="ghost"
                  onPress={() => setSelectedBug(null)}
                />
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
