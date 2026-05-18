import { useMemo } from "react";
import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Text } from "@/components/ui";
import { theme } from "@/lib/theme";

// Local YYYY-MM-DD key (timezone of the device). Slots and "today" comparison
// use the same key so it stays consistent across midnight boundaries.
export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Props = {
  // First day of the displayed month (any timestamp inside the month works).
  month: Date;
  // Currently highlighted day (or null = nothing selected).
  selectedDay: Date | null;
  // Set of YYYY-MM-DD strings for days that have at least one slot.
  slotDays: Set<string>;
  locale: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDay: (day: Date) => void;
};

const WEEKDAY_REF_DATES = [
  // Reference week starting Monday. Date.toLocaleDateString picks weekday
  // names per locale; we use these fixed dates as anchors for the formatter.
  new Date(2024, 0, 1), // Mon
  new Date(2024, 0, 2),
  new Date(2024, 0, 3),
  new Date(2024, 0, 4),
  new Date(2024, 0, 5),
  new Date(2024, 0, 6),
  new Date(2024, 0, 7), // Sun
];

function weekdayLabels(locale: string): string[] {
  return WEEKDAY_REF_DATES.map((d) =>
    d.toLocaleDateString(locale, { weekday: "narrow" }).toUpperCase(),
  );
}

function monthLabel(month: Date, locale: string): string {
  return month
    .toLocaleDateString(locale, { month: "long", year: "numeric" })
    .replace(/^./, (c) => c.toUpperCase());
}

// Returns 42 cells (6 weeks × 7 days) covering the month. Cells outside the
// current month are flagged so they can be rendered greyed out.
function buildCells(month: Date): { date: Date; inMonth: boolean }[] {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  // 0=Sun,1=Mon,... → shift so Monday=0
  const offset = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - offset);

  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({ date: d, inMonth: d.getMonth() === month.getMonth() });
  }
  return cells;
}

export function CalendarGrid({
  month,
  selectedDay,
  slotDays,
  locale,
  onPrevMonth,
  onNextMonth,
  onSelectDay,
}: Props) {
  const cells = useMemo(() => buildCells(month), [month]);
  const days = useMemo(() => weekdayLabels(locale), [locale]);
  const todayKey = useMemo(() => localDayKey(new Date()), []);
  const selectedKey = selectedDay ? localDayKey(selectedDay) : null;

  return (
    <View
      className="mb-4 rounded-2xl"
      style={{
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E8E3DB",
        padding: 12,
      }}
    >
      {/* Month header */}
      <View
        className="flex-row items-center justify-between mb-3"
        style={{ paddingHorizontal: 4 }}
      >
        <Pressable
          onPress={onPrevMonth}
          hitSlop={8}
          className="rounded-full items-center justify-center active:opacity-70"
          style={{
            width: 32,
            height: 32,
            backgroundColor: "#F3F0FA",
          }}
        >
          <Ionicons name="chevron-back" size={16} color={theme.primary} />
        </Pressable>
        <Text
          style={{ fontSize: 15, fontWeight: "700", color: "#1A1A1A" }}
        >
          {monthLabel(month, locale)}
        </Text>
        <Pressable
          onPress={onNextMonth}
          hitSlop={8}
          className="rounded-full items-center justify-center active:opacity-70"
          style={{
            width: 32,
            height: 32,
            backgroundColor: "#F3F0FA",
          }}
        >
          <Ionicons name="chevron-forward" size={16} color={theme.primary} />
        </Pressable>
      </View>

      {/* Weekday labels */}
      <View className="flex-row" style={{ marginBottom: 4 }}>
        {days.map((d, i) => (
          <View
            key={i}
            style={{ flex: 1, alignItems: "center", paddingVertical: 4 }}
          >
            <Text
              variant="caption"
              style={{
                fontSize: 11,
                color: "#9CA3AF",
                fontWeight: "700",
              }}
            >
              {d}
            </Text>
          </View>
        ))}
      </View>

      {/* 6 rows of 7 cells */}
      {[0, 1, 2, 3, 4, 5].map((row) => (
        <View key={row} className="flex-row">
          {cells.slice(row * 7, row * 7 + 7).map((cell) => {
            const key = localDayKey(cell.date);
            const isSelected = key === selectedKey;
            const isToday = key === todayKey;
            const hasSlot = slotDays.has(key);
            return (
              <Pressable
                key={key}
                onPress={() => onSelectDay(cell.date)}
                className="items-center justify-center active:opacity-70"
                style={{
                  flex: 1,
                  aspectRatio: 1,
                  padding: 2,
                }}
              >
                <View
                  className="items-center justify-center rounded-full"
                  style={{
                    width: 32,
                    height: 32,
                    backgroundColor: isSelected
                      ? theme.primary
                      : "transparent",
                    borderWidth: isToday && !isSelected ? 1.5 : 0,
                    borderColor: theme.primary,
                  }}
                >
                  <Text
                    style={{
                      color: isSelected
                        ? "#FFFFFF"
                        : cell.inMonth
                          ? "#1A1A1A"
                          : "#D1D5DB",
                      fontSize: 13,
                      fontWeight: isSelected || isToday ? "700" : "500",
                    }}
                  >
                    {cell.date.getDate()}
                  </Text>
                </View>
                {hasSlot ? (
                  <View
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: isSelected ? "#FFFFFF" : theme.primary,
                      marginTop: 2,
                    }}
                  />
                ) : (
                  <View style={{ height: 6 }} />
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
