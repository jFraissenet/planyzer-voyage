import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Avatar, Button, Input, Text } from "@/components/ui";
import {
  computeExpenseShares,
  createExpense,
  deleteExpense,
  formatAmount,
  replaceExpenseShares,
  updateExpense,
  type EffectiveMember,
  type Expense,
  type ExpenseShare,
  type ShareMode,
} from "@/lib/expenses";
import { initialsOf, SectionLabel } from "./shared";
import { theme } from "@/lib/theme";

type LocalShare = {
  user_id: string;
  mode: ShareMode;
  valueText: string;
};

function toLocalShares(
  members: EffectiveMember[],
  existing: ExpenseShare[] | undefined,
): LocalShare[] {
  const byUser = new Map(existing?.map((s) => [s.user_id, s]) ?? []);
  return members.map((m) => {
    const s = byUser.get(m.user_id);
    return {
      user_id: m.user_id,
      mode: s?.mode ?? "equal",
      valueText:
        s && s.mode !== "equal" && s.value != null
          ? s.value.toString().replace(".", ",")
          : "",
    };
  });
}

function parseValue(text: string): number {
  const normalized = text.replace(",", ".").trim();
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

type Props = {
  visible: boolean;
  toolId: string;
  members: EffectiveMember[];
  currentUserId: string;
  existing: Expense | null;
  onClose: () => void;
  onSaved: () => void;
};

export function ExpenseEditModal({
  visible,
  toolId,
  members,
  currentUserId,
  existing,
  onClose,
  onSaved,
}: Props) {
  const { t } = useTranslation();
  const isEdit = !!existing;

  const [label, setLabel] = useState("");
  const [amountText, setAmountText] = useState("");
  const [paidBy, setPaidBy] = useState<string>("");
  const [shares, setShares] = useState<LocalShare[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (existing) {
      setLabel(existing.label);
      setAmountText(existing.amount.toString().replace(".", ","));
      setPaidBy(existing.paid_by ?? "");
      setShares(toLocalShares(members, existing.shares));
    } else {
      setLabel("");
      setAmountText("");
      setPaidBy(currentUserId);
      setShares(
        members.map((m) => ({
          user_id: m.user_id,
          mode: "equal" as const,
          valueText: "",
        })),
      );
    }
    setFormError(null);
    setSubmitting(false);
  }, [visible, existing, members, currentUserId]);

  const amount = useMemo(() => parseValue(amountText), [amountText]);

  const computedShares = useMemo(() => {
    const sharesForCompute: ExpenseShare[] = shares.map((s) => ({
      user_id: s.user_id,
      mode: s.mode,
      value: s.mode === "equal" ? null : parseValue(s.valueText),
    }));
    return computeExpenseShares(amount, sharesForCompute);
  }, [shares, amount]);

  const cycleMode = (user_id: string) => {
    setShares((prev) =>
      prev.map((s) => {
        if (s.user_id !== user_id) return s;
        const order: ShareMode[] = ["equal", "percent", "amount"];
        const next = order[(order.indexOf(s.mode) + 1) % order.length];
        return { ...s, mode: next, valueText: next === "equal" ? "" : s.valueText };
      }),
    );
  };

  const setShareValue = (user_id: string, text: string) => {
    setShares((prev) =>
      prev.map((s) => (s.user_id === user_id ? { ...s, valueText: text } : s)),
    );
  };

  const validate = (): string | null => {
    if (!label.trim()) return t("money.errorLabelRequired");
    if (!(amount > 0)) return t("money.errorAmountRequired");
    if (!paidBy) return t("money.errorPayerRequired");

    let percentSum = 0;
    let fixedSum = 0;
    let equalCount = 0;
    for (const s of shares) {
      if (s.mode === "percent") percentSum += parseValue(s.valueText);
      else if (s.mode === "amount") fixedSum += parseValue(s.valueText);
      else equalCount++;
    }
    if (percentSum > 100 + 0.01) return t("money.errorPercentOver");
    const percentAmount = (percentSum * amount) / 100;
    if (percentAmount + fixedSum > amount + 0.01)
      return t("money.errorAmountOver");
    if (
      equalCount === 0 &&
      Math.abs(percentAmount + fixedSum - amount) > 0.01
    )
      return t("money.errorNoEqualLeft");
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const outShares: ExpenseShare[] = shares.map((s) => ({
        user_id: s.user_id,
        mode: s.mode,
        value: s.mode === "equal" ? null : parseValue(s.valueText),
      }));

      if (existing) {
        await updateExpense(existing.expense_id, {
          label: label.trim(),
          amount,
          paid_by: paidBy,
        });
        await replaceExpenseShares(existing.expense_id, outShares);
      } else {
        const newId = await createExpense({
          tool_id: toolId,
          label: label.trim(),
          amount,
          paid_by: paidBy,
          member_ids: members.map((m) => m.user_id),
        });
        await replaceExpenseShares(newId, outShares);
      }
      onSaved();
    } catch {
      setFormError(t("money.errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  };

  const canDelete =
    existing &&
    (existing.creator_id === currentUserId ||
      existing.paid_by === currentUserId);

  const confirmDelete = () => {
    if (!existing) return;
    const msg = t("money.deleteConfirm");
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (window.confirm(msg)) void runDelete();
      return;
    }
    Alert.alert(msg, undefined, [
      { text: t("money.cancel"), style: "cancel" },
      {
        text: t("money.delete"),
        style: "destructive",
        onPress: () => runDelete(),
      },
    ]);
  };

  const runDelete = async () => {
    if (!existing) return;
    setSubmitting(true);
    try {
      await deleteExpense(existing.expense_id);
      onSaved();
    } finally {
      setSubmitting(false);
    }
  };

  const memberById = useMemo(
    () => new Map(members.map((m) => [m.user_id, m])),
    [members],
  );

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
          style={{ maxHeight: "92%" }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text variant="h2" className="mb-4">
              {isEdit ? t("money.edit") : t("money.add")}
            </Text>

            <View className="gap-3 mb-5">
              <Input
                label={t("money.labelField")}
                placeholder={t("money.labelPlaceholder")}
                value={label}
                onChangeText={setLabel}
                autoFocus
              />
              <Input
                label={t("money.amountField")}
                placeholder={t("money.amountPlaceholder")}
                value={amountText}
                onChangeText={setAmountText}
                keyboardType="decimal-pad"
              />
            </View>

            <SectionLabel>{t("money.paidByField")}</SectionLabel>
            <View className="gap-2 mb-5">
              {members.map((m) => {
                const selected = paidBy === m.user_id;
                return (
                  <Pressable
                    key={m.user_id}
                    onPress={() => setPaidBy(m.user_id)}
                    className={`flex-row items-center p-3 rounded-xl border ${
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-surface"
                    }`}
                  >
                    <Avatar
                      src={m.avatar_url ?? undefined}
                      initials={initialsOf(m.full_name)}
                      size="sm"
                      className="mr-3"
                    />
                    <Text className="flex-1">{m.full_name ?? "?"}</Text>
                    {selected ? (
                      <Text style={{ color: theme.primary, fontWeight: "700" }}>
                        ✓
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <SectionLabel>{t("money.sharesSection")}</SectionLabel>
            <View className="mb-5">
              {shares.map((s) => {
                const m = memberById.get(s.user_id);
                const computed = computedShares[s.user_id] ?? 0;
                return (
                  <View
                    key={s.user_id}
                    className="flex-row items-center py-2"
                  >
                    <Avatar
                      src={m?.avatar_url ?? undefined}
                      initials={initialsOf(m?.full_name ?? null)}
                      size="sm"
                      className="mr-3"
                    />
                    <View className="flex-1 pr-2">
                      <Text numberOfLines={1}>{m?.full_name ?? "?"}</Text>
                      <Text
                        variant="caption"
                        style={{ fontSize: 12, color: theme.primary }}
                      >
                        {formatAmount(computed)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => cycleMode(s.user_id)}
                      className="mr-2 px-2 py-1 rounded-lg"
                      style={{
                        backgroundColor: theme.primarySoft,
                        minWidth: 44,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        variant="label"
                        style={{ color: theme.primary, fontWeight: "700" }}
                      >
                        {t(`money.mode.${s.mode}`)}
                      </Text>
                    </Pressable>
                    {s.mode !== "equal" ? (
                      <TextInput
                        value={s.valueText}
                        onChangeText={(txt) => setShareValue(s.user_id, txt)}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor="#A3A3A3"
                        style={{
                          width: 72,
                          textAlign: "right",
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: "#E8E3DB",
                          backgroundColor: "#FFFFFF",
                          fontSize: 14,
                          color: "#1A1A1A",
                        }}
                      />
                    ) : (
                      <View style={{ width: 72 }} />
                    )}
                  </View>
                );
              })}
            </View>

            {formError ? (
              <Text className="text-error text-sm mb-3">{formError}</Text>
            ) : null}

            <View className="gap-2">
              <Button
                variant="cta"
                size="lg"
                label={
                  submitting
                    ? isEdit
                      ? t("money.saving")
                      : t("money.creating")
                    : isEdit
                      ? t("money.save")
                      : t("money.create")
                }
                onPress={handleSubmit}
                disabled={submitting}
              />
              {isEdit && canDelete ? (
                <Pressable
                  onPress={confirmDelete}
                  disabled={submitting}
                  className="py-3 items-center"
                  style={{ opacity: submitting ? 0.5 : 1 }}
                >
                  <Text
                    variant="label"
                    style={{ color: "#EF4444", fontWeight: "600" }}
                  >
                    {t("money.delete")}
                  </Text>
                </Pressable>
              ) : null}
              <Button
                variant="ghost"
                label={t("money.cancel")}
                onPress={onClose}
                disabled={submitting}
              />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
