import { useEffect, useState } from "react";
import { Modal, Platform, Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui";
import {
  getUserPaymentInfo,
  type UserPaymentInfo,
} from "@/lib/payment";
import { theme } from "@/lib/theme";

type Props = {
  visible: boolean;
  userId: string | null;
  displayName: string | null;
  onClose: () => void;
};

function Row({
  label,
  value,
  copyLabel,
}: {
  label: string;
  value: string | null;
  copyLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  const copy = async () => {
    try {
      if (
        Platform.OS === "web"
        && typeof navigator !== "undefined"
        && navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(value);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <View
      className="rounded-xl px-3 py-2 mb-2"
      style={{ backgroundColor: "#F3F0FA" }}
    >
      <Text
        variant="caption"
        style={{ fontSize: 11, color: theme.sectionLabel, marginBottom: 2 }}
      >
        {label}
      </Text>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <Text
          selectable
          style={{
            flex: 1,
            fontSize: 14,
            fontWeight: "600",
            color: "#1A1A1A",
          }}
        >
          {value}
        </Text>
        <Pressable
          onPress={copy}
          hitSlop={6}
          className="flex-row items-center px-2 py-1 rounded-full active:opacity-70"
          style={{
            backgroundColor: copied ? theme.primary : "#FFFFFF",
            borderWidth: 1,
            borderColor: copied ? theme.primary : "#E8E3DB",
            gap: 4,
          }}
        >
          <Ionicons
            name={copied ? "checkmark" : "copy-outline"}
            size={12}
            color={copied ? "#FFFFFF" : theme.primary}
          />
          <Text
            style={{
              color: copied ? "#FFFFFF" : theme.primary,
              fontSize: 11,
              fontWeight: "700",
            }}
          >
            {copied ? "✓" : copyLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function RibModal({ visible, userId, displayName, onClose }: Props) {
  const { t } = useTranslation();
  const [info, setInfo] = useState<UserPaymentInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !userId) {
      setInfo(null);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const data = await getUserPaymentInfo(userId);
        if (active) setInfo(data);
      } catch {
        if (active) setInfo(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [visible, userId]);

  const isEmpty =
    !loading
    && info
    && !info.iban
    && !info.bic
    && !info.account_holder
    && !info.phone;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/40 items-center justify-center px-4"
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full max-w-sm bg-background rounded-2xl"
          style={{ padding: 20 }}
        >
          <View
            className="flex-row items-center justify-between mb-3"
            style={{ gap: 12 }}
          >
            <Text variant="h2" numberOfLines={1} style={{ flex: 1 }}>
              {displayName ?? info?.full_name ?? "RIB"}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              className="rounded-full items-center justify-center"
              style={{ width: 30, height: 30, backgroundColor: "#F3F4F6" }}
            >
              <Ionicons name="close" size={14} color="#6B7280" />
            </Pressable>
          </View>

          {loading ? (
            <Text variant="caption">…</Text>
          ) : !info || isEmpty ? (
            <Text variant="caption">{t("money.breakdown.ribEmpty")}</Text>
          ) : (
            <>
              <Row
                label={t("profile.accountHolderLabel")}
                value={info.account_holder}
                copyLabel={t("money.breakdown.ribCopy")}
              />
              <Row
                label={t("profile.phoneLabel")}
                value={info.phone}
                copyLabel={t("money.breakdown.ribCopy")}
              />
              <Row
                label={t("profile.ibanLabel")}
                value={info.iban}
                copyLabel={t("money.breakdown.ribCopy")}
              />
              <Row
                label={t("profile.bicLabel")}
                value={info.bic}
                copyLabel={t("money.breakdown.ribCopy")}
              />
              {Platform.OS === "web" ? null : (
                <Text
                  variant="caption"
                  style={{ fontSize: 11, marginTop: 4 }}
                >
                  {t("money.breakdown.ribCopyHint")}
                </Text>
              )}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
