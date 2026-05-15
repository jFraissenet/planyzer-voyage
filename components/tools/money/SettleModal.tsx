import { useEffect, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button, Input, Text } from "@/components/ui";
import {
  createSettlement,
  formatAmount,
  type EffectiveMember,
} from "@/lib/expenses";

type Props = {
  visible: boolean;
  toolId: string;
  from: EffectiveMember | null;
  to: EffectiveMember | null;
  suggestedAmount: number;
  onClose: () => void;
  onSaved: () => void;
};

function parseAmount(text: string): number {
  const n = Number(text.replace(",", ".").trim());
  return Number.isFinite(n) ? n : 0;
}

export function SettleModal({
  visible,
  toolId,
  from,
  to,
  suggestedAmount,
  onClose,
  onSaved,
}: Props) {
  const { t } = useTranslation();
  const [amountText, setAmountText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setAmountText(
        suggestedAmount > 0
          ? suggestedAmount.toFixed(2).replace(".", ",")
          : "",
      );
      setError(null);
      setBusy(false);
    }
  }, [visible, suggestedAmount]);

  const submit = async () => {
    if (!from || !to) return;
    const amount = parseAmount(amountText);
    if (!(amount > 0)) {
      setError(t("settle.errorAmount"));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await createSettlement({
        tool_id: toolId,
        from_user_id: from.user_id,
        to_user_id: to.user_id,
        amount,
      });
      onSaved();
    } catch {
      setError(t("settle.errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

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
          className="w-full max-w-md bg-background rounded-2xl p-5"
        >
          <Text variant="h2" className="mb-1">
            {t("settle.title")}
          </Text>
          <Text variant="caption" className="mb-5">
            {t("settle.subtitle", {
              from: from?.full_name ?? "?",
              to: to?.full_name ?? "?",
            })}
          </Text>

          <Input
            label={t("settle.amountLabel")}
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="decimal-pad"
            autoFocus
            className="mb-2"
            required
          />
          {suggestedAmount > 0 ? (
            <Text variant="caption" className="mb-4">
              {t("settle.fullAmountHint", {
                amount: formatAmount(suggestedAmount),
              })}
            </Text>
          ) : null}

          {error ? (
            <Text className="text-error text-sm mb-3">{error}</Text>
          ) : null}

          <View className="gap-2 mt-2">
            <Button
              variant="cta"
              size="lg"
              label={busy ? t("settle.saving") : t("settle.save")}
              onPress={submit}
              disabled={busy}
            />
            <Button
              variant="ghost"
              label={t("settle.cancel")}
              onPress={onClose}
              disabled={busy}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
