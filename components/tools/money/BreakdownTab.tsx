import { useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Avatar, Card, Text } from "@/components/ui";
import {
  computeBalances,
  deleteSettlement,
  formatAmount,
  settleBalances,
  type EffectiveMember,
  type Expense,
  type Settlement,
} from "@/lib/expenses";
import { firstName, initialsOf } from "./shared";

export function BreakdownTab({
  expenses,
  members,
  settlements,
  currentUserId,
  onSettle,
  onChanged,
}: {
  expenses: Expense[];
  members: EffectiveMember[];
  settlements: Settlement[];
  currentUserId: string;
  onSettle: (fromId: string, toId: string, amount: number) => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(members.map((m) => m.user_id)),
  );

  const memberById = useMemo(
    () => new Map(members.map((m) => [m.user_id, m])),
    [members],
  );

  const balances = useMemo(
    () =>
      computeBalances(
        expenses,
        members.map((m) => m.user_id),
        settlements,
      ),
    [expenses, members, settlements],
  );

  const suggestions = useMemo(() => settleBalances(balances), [balances]);

  const allSelected = selected.size === members.length;

  const toggle = (uid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const bulkToggle = () => {
    setSelected(
      allSelected ? new Set() : new Set(members.map((m) => m.user_id)),
    );
  };

  const confirmDeleteSettlement = (settlement: Settlement) => {
    if (!settlement.settlement_id) return;
    const msg = t("money.breakdown.recordedDelete");
    const doDelete = async () => {
      await deleteSettlement(settlement.settlement_id!);
      onChanged();
    };
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (window.confirm(t("money.breakdown.recordedDelete"))) void doDelete();
      return;
    }
    Alert.alert(msg, undefined, [
      { text: t("settle.cancel"), style: "cancel" },
      { text: t("money.delete"), style: "destructive", onPress: () => void doDelete() },
    ]);
  };

  if (expenses.length === 0) {
    return (
      <View className="py-10 items-center">
        <Text variant="caption">{t("money.breakdown.empty")}</Text>
      </View>
    );
  }

  const visibleBalances = balances.filter((b) => selected.has(b.user_id));
  const visibleSuggestions = suggestions.filter(
    (s) => selected.has(s.from) && selected.has(s.to),
  );
  const visibleSettlements = settlements.filter(
    (s) => selected.has(s.from_user_id) && selected.has(s.to_user_id),
  );

  return (
    <View>
      {/* Filter chips */}
      <Text
        variant="caption"
        className="mb-2 uppercase"
        style={{
          letterSpacing: 1.2,
          fontWeight: "700",
          fontSize: 11,
          color: "#6050DC",
        }}
      >
        {t("money.breakdown.filterLabel")}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
        className="mb-3"
      >
        <Pressable
          onPress={bulkToggle}
          className="px-3 py-1.5 rounded-full"
          style={{
            backgroundColor: allSelected ? "#6050DC" : "#EEECFC",
          }}
        >
          <Text
            variant="label"
            style={{
              color: allSelected ? "#FFFFFF" : "#6050DC",
              fontWeight: "700",
            }}
          >
            {allSelected
              ? t("money.breakdown.deselectAll")
              : t("money.breakdown.selectAll")}
          </Text>
        </Pressable>
        {members.map((m) => {
          const active = selected.has(m.user_id);
          return (
            <Pressable
              key={m.user_id}
              onPress={() => toggle(m.user_id)}
              className="flex-row items-center px-2 py-1 rounded-full"
              style={{
                backgroundColor: active ? "#6050DC" : "#EEECFC",
                gap: 6,
              }}
            >
              <Avatar
                src={m.avatar_url ?? undefined}
                initials={initialsOf(m.full_name)}
                size="xs"
              />
              <Text
                variant="label"
                style={{
                  color: active ? "#FFFFFF" : "#6050DC",
                  fontWeight: "700",
                  paddingRight: 6,
                }}
              >
                {firstName(m.full_name)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Per-member balance cards */}
      <View className="mb-6">
        {visibleBalances.map((b) => {
          const m = memberById.get(b.user_id);
          const balance = b.balance;
          const positive = balance > 0.01;
          const negative = balance < -0.01;
          const balanceColor = positive
            ? "#10B981"
            : negative
              ? "#EF4444"
              : "#525252";
          return (
            <Card key={b.user_id} className="mb-3">
              <View className="flex-row items-center">
                <Avatar
                  src={m?.avatar_url ?? undefined}
                  initials={initialsOf(m?.full_name ?? null)}
                  size="md"
                  className="mr-3"
                />
                <View className="flex-1">
                  <Text variant="h3">{m?.full_name ?? "?"}</Text>
                  <View className="flex-row mt-1" style={{ gap: 12 }}>
                    <Text variant="caption">
                      {t("money.breakdown.paid")} · {formatAmount(b.paid)}
                    </Text>
                    <Text variant="caption">
                      {t("money.breakdown.owed")} · {formatAmount(b.owed)}
                    </Text>
                  </View>
                </View>
                <View className="items-end">
                  <Text variant="caption" style={{ fontSize: 11 }}>
                    {t("money.breakdown.balance")}
                  </Text>
                  <Text
                    variant="label"
                    style={{
                      color: balanceColor,
                      fontWeight: "800",
                      fontSize: 16,
                    }}
                  >
                    {balance > 0 ? "+" : ""}
                    {formatAmount(balance)}
                  </Text>
                </View>
              </View>
            </Card>
          );
        })}
      </View>

      {/* Suggestions */}
      <Text
        variant="caption"
        className="mb-3 uppercase"
        style={{
          letterSpacing: 1.2,
          fontWeight: "700",
          fontSize: 11,
          color: "#6050DC",
        }}
      >
        {t("money.breakdown.settleTitle")}
      </Text>
      {visibleSuggestions.length === 0 ? (
        <View
          className="rounded-2xl p-4 mb-6"
          style={{ backgroundColor: "#EEECFC" }}
        >
          <Text variant="caption" style={{ color: "#4F3FD1" }}>
            {t("money.breakdown.settleEmpty")}
          </Text>
        </View>
      ) : (
        <Card className="mb-6 p-0 overflow-hidden">
          {visibleSuggestions.map((s, idx) => {
            const from = memberById.get(s.from);
            const to = memberById.get(s.to);
            return (
              <View
                key={`${s.from}-${s.to}-${idx}`}
                className="flex-row items-center px-4 py-3"
                style={{
                  borderBottomWidth:
                    idx < visibleSuggestions.length - 1 ? 1 : 0,
                  borderBottomColor: "#F2EDE4",
                }}
              >
                <Avatar
                  src={from?.avatar_url ?? undefined}
                  initials={initialsOf(from?.full_name ?? null)}
                  size="sm"
                  className="mr-2"
                />
                <Text className="mx-1">→</Text>
                <Avatar
                  src={to?.avatar_url ?? undefined}
                  initials={initialsOf(to?.full_name ?? null)}
                  size="sm"
                  className="mr-3"
                />
                <View className="flex-1">
                  <Text numberOfLines={1}>
                    {firstName(from?.full_name ?? null)}{" "}
                    <Text variant="caption">→</Text>{" "}
                    {firstName(to?.full_name ?? null)}
                  </Text>
                  <Text
                    variant="label"
                    style={{ color: "#1A1A1A", fontWeight: "800" }}
                  >
                    {formatAmount(s.amount)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => onSettle(s.from, s.to, s.amount)}
                  className="px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: "#EEECFC" }}
                >
                  <Text
                    variant="label"
                    style={{ color: "#6050DC", fontWeight: "700" }}
                  >
                    {t("money.breakdown.settleAction")}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </Card>
      )}

      {/* Recorded settlements */}
      <Text
        variant="caption"
        className="mb-3 uppercase"
        style={{
          letterSpacing: 1.2,
          fontWeight: "700",
          fontSize: 11,
          color: "#6050DC",
        }}
      >
        {t("money.breakdown.recordedTitle")}
      </Text>
      {visibleSettlements.length === 0 ? (
        <View
          className="rounded-2xl p-4"
          style={{ backgroundColor: "#F2EDE4" }}
        >
          <Text variant="caption">
            {t("money.breakdown.recordedEmpty")}
          </Text>
        </View>
      ) : (
        <Card className="p-0 overflow-hidden">
          {visibleSettlements.map((s, idx) => {
            const from = memberById.get(s.from_user_id);
            const to = memberById.get(s.to_user_id);
            const canDelete = s.created_by === currentUserId;
            return (
              <View
                key={s.settlement_id ?? idx}
                className="flex-row items-center px-4 py-3"
                style={{
                  borderBottomWidth:
                    idx < visibleSettlements.length - 1 ? 1 : 0,
                  borderBottomColor: "#F2EDE4",
                }}
              >
                <Avatar
                  src={from?.avatar_url ?? s.from_avatar_url ?? undefined}
                  initials={initialsOf(
                    from?.full_name ?? s.from_full_name ?? null,
                  )}
                  size="sm"
                  className="mr-2"
                />
                <Text className="mx-1">→</Text>
                <Avatar
                  src={to?.avatar_url ?? s.to_avatar_url ?? undefined}
                  initials={initialsOf(
                    to?.full_name ?? s.to_full_name ?? null,
                  )}
                  size="sm"
                  className="mr-3"
                />
                <Text
                  variant="label"
                  className="flex-1"
                  style={{ color: "#1A1A1A", fontWeight: "700" }}
                >
                  {formatAmount(s.amount)}
                </Text>
                {canDelete ? (
                  <Pressable
                    onPress={() => confirmDeleteSettlement(s)}
                    hitSlop={8}
                    className="items-center justify-center"
                    style={{ width: 32, height: 32 }}
                  >
                    <Ionicons name="close" size={18} color="#A3A3A3" />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </Card>
      )}
    </View>
  );
}
