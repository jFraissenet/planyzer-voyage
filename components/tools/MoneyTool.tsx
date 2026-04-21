import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { FAB, Text } from "@/components/ui";
import {
  getEffectiveMembers,
  listExpenses,
  listSettlements,
  type EffectiveMember,
  type Expense,
  type Settlement,
} from "@/lib/expenses";
import { useSession } from "@/lib/useSession";
import { BreakdownTab } from "./money/BreakdownTab";
import { ExpenseEditModal } from "./money/ExpenseEditModal";
import { ExpensesTab } from "./money/ExpensesTab";
import { SettleModal } from "./money/SettleModal";
import { ToolShell, type ToolProps } from "./ToolShell";

type Tab = "expenses" | "breakdown";

function TopTabs({
  value,
  onChange,
}: {
  value: Tab;
  onChange: (v: Tab) => void;
}) {
  const { t } = useTranslation();
  const tabs: { key: Tab; label: string }[] = [
    { key: "expenses", label: t("money.tabs.expenses") },
    { key: "breakdown", label: t("money.tabs.breakdown") },
  ];
  return (
    <View
      className="flex-row mb-6"
      style={{ borderBottomWidth: 1, borderBottomColor: "#E8E3DB" }}
    >
      {tabs.map((tab) => {
        const active = value === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            className="flex-1 items-center py-3"
            style={{
              borderBottomWidth: 2,
              borderBottomColor: active ? "#6050DC" : "transparent",
              marginBottom: -1,
            }}
          >
            <Text
              variant="label"
              style={{
                color: active ? "#6050DC" : "#A3A3A3",
                fontWeight: active ? "700" : "500",
                fontSize: 14,
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function MoneyTool(props: ToolProps) {
  const { session } = useSession();
  const currentUserId = session?.user?.id ?? "";
  const [tab, setTab] = useState<Tab>("expenses");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [members, setMembers] = useState<EffectiveMember[]>([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [settle, setSettle] = useState<{
    fromId: string;
    toId: string;
    amount: number;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, e, s] = await Promise.all([
        getEffectiveMembers(props.tool.event_tool_id),
        listExpenses(props.tool.event_tool_id),
        listSettlements(props.tool.event_tool_id),
      ]);
      setMembers(m);
      setExpenses(e);
      setSettlements(s);
    } catch {
      setMembers([]);
      setExpenses([]);
      setSettlements([]);
    }
  }, [props.tool.event_tool_id]);

  useEffect(() => {
    load();
  }, [load]);

  const memberById = new Map(members.map((m) => [m.user_id, m]));

  return (
    <>
      <ToolShell {...props}>
        <TopTabs value={tab} onChange={setTab} />
        {tab === "expenses" ? (
          <ExpensesTab
            expenses={expenses}
            members={members}
            currentUserId={currentUserId}
            onOpenExpense={setEditing}
          />
        ) : (
          <BreakdownTab
            expenses={expenses}
            members={members}
            settlements={settlements}
            currentUserId={currentUserId}
            onSettle={(fromId, toId, amount) =>
              setSettle({ fromId, toId, amount })
            }
            onChanged={load}
          />
        )}
      </ToolShell>

      {tab === "expenses" ? (
        <FAB
          icon="add"
          onPress={() => setCreating(true)}
          accessibilityLabel="Add expense"
        />
      ) : null}

      <ExpenseEditModal
        visible={creating || !!editing}
        toolId={props.tool.event_tool_id}
        members={members}
        currentUserId={currentUserId}
        existing={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          load();
        }}
      />

      <SettleModal
        visible={!!settle}
        toolId={props.tool.event_tool_id}
        from={settle ? memberById.get(settle.fromId) ?? null : null}
        to={settle ? memberById.get(settle.toId) ?? null : null}
        suggestedAmount={settle?.amount ?? 0}
        onClose={() => setSettle(null)}
        onSaved={() => {
          setSettle(null);
          load();
        }}
      />
    </>
  );
}
