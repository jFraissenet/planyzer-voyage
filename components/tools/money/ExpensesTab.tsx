import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Card, Text } from "@/components/ui";
import {
  computeExpenseShares,
  formatAmount,
  type EffectiveMember,
  type Expense,
} from "@/lib/expenses";
import { firstName, initialsOf, useIsMobile } from "./shared";

function ExpenseRow({
  expense,
  onPress,
}: {
  expense: Expense;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  return (
    <Card
      pressable
      onPress={onPress}
      className="mb-3 overflow-hidden p-0"
    >
      <View className="flex-row p-4 items-start">
        <View
          className="mr-3 items-center justify-center rounded-full"
          style={{
            width: 36,
            height: 36,
            backgroundColor: "#EEECFC",
          }}
        >
          <Text
            variant="label"
            style={{ color: "#6050DC", fontWeight: "700", fontSize: 12 }}
          >
            #{expense.expense_order + 1}
          </Text>
        </View>
        <View className="flex-1 pr-2">
          <Text
            numberOfLines={isMobile ? 2 : 1}
            style={{
              color: "#1A1A1A",
              fontSize: isMobile ? 15 : 18,
              fontWeight: "700",
              lineHeight: isMobile ? 19 : 24,
            }}
          >
            {expense.label}
          </Text>
          <Text variant="caption" className="mt-0.5">
            {t("money.paidBy", {
              name: firstName(expense.paid_by_name),
            })}
          </Text>
        </View>
        <Text
          style={{
            color: "#1A1A1A",
            fontSize: isMobile ? 15 : 17,
            fontWeight: "800",
          }}
        >
          {formatAmount(expense.amount, expense.currency)}
        </Text>
      </View>
    </Card>
  );
}

export function ExpensesTab({
  expenses,
  members,
  currentUserId,
  onOpenExpense,
}: {
  expenses: Expense[];
  members: EffectiveMember[];
  currentUserId: string;
  onOpenExpense: (e: Expense) => void;
}) {
  const { t } = useTranslation();
  const memberIds = members.map((m) => m.user_id);

  const { total, iPaid, myShare } = useMemo(() => {
    let tot = 0;
    let paid = 0;
    let share = 0;
    for (const e of expenses) {
      tot += e.amount;
      if (e.paid_by === currentUserId) paid += e.amount;
      const shares = computeExpenseShares(e.amount, e.shares);
      share += shares[currentUserId] ?? 0;
    }
    return { total: tot, iPaid: paid, myShare: share };
  }, [expenses, currentUserId, memberIds]);

  return (
    <View>
      {expenses.length === 0 ? (
        <View className="py-10 items-center">
          <Text variant="caption">{t("money.empty")}</Text>
        </View>
      ) : (
        <View className="mb-4">
          {expenses.map((e) => (
            <ExpenseRow
              key={e.expense_id}
              expense={e}
              onPress={() => onOpenExpense(e)}
            />
          ))}
        </View>
      )}

      {expenses.length > 0 ? (
        <View
          className="rounded-2xl p-4 mb-4"
          style={{
            backgroundColor: "#EEECFC",
          }}
        >
          <View className="flex-row justify-between mb-2">
            <Text variant="label" style={{ color: "#4F3FD1" }}>
              {t("money.totals.pot")}
            </Text>
            <Text
              variant="label"
              style={{ color: "#4F3FD1", fontWeight: "700" }}
            >
              {formatAmount(total)}
            </Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text variant="caption" style={{ color: "#4F3FD1" }}>
              {t("money.totals.paid")}
            </Text>
            <Text variant="caption" style={{ color: "#4F3FD1" }}>
              {formatAmount(iPaid)}
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text variant="caption" style={{ color: "#4F3FD1" }}>
              {t("money.totals.share")}
            </Text>
            <Text variant="caption" style={{ color: "#4F3FD1" }}>
              {formatAmount(myShare)}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
