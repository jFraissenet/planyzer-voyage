import { useMemo } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui";
import type { PlanningSlot } from "@/lib/planning";
import { localDayKey } from "./CalendarGrid";
import { theme } from "@/lib/theme";

// Visible hours window. Slots outside this range are clipped (a small dot at
// the top/bottom hints there's something beyond — Phase 2 polish).
const HOUR_START = 6;
const HOUR_END = 23;
const HOUR_HEIGHT = 48;
const TOTAL_HEIGHT = (HOUR_END - HOUR_START + 1) * HOUR_HEIGHT;
const HOUR_COL_WIDTH = 40;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Continuous hour (e.g., 19.5 for 19:30) so absolute-positioning is precise
// even on non-round times.
function isoToHour(iso: string): number {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60;
}

type OverlapLayout = { columnIndex: number; columnCount: number };

// Lays out overlapping slots into side-by-side columns within a single day.
// Algorithm (classic calendar split):
//   1. Sort by start time.
//   2. Build clusters of transitively-overlapping slots (max end time grows
//      as we add to the cluster).
//   3. Greedy column assignment inside each cluster: each new slot drops into
//      the first column whose last slot already ended; otherwise a new
//      column is opened.
//   4. All slots in a cluster get the same columnCount so they share width.
function computeOverlapLayout(
  slots: PlanningSlot[],
): Map<string, OverlapLayout> {
  const result = new Map<string, OverlapLayout>();
  if (slots.length === 0) return result;

  const sorted = [...slots].sort((a, b) =>
    a.starts_at.localeCompare(b.starts_at),
  );

  // Walk slots, growing the current cluster until a slot starts after the
  // running max end time.
  let cluster: PlanningSlot[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;
    // Greedy column assignment within the cluster.
    const columnEnds: number[] = [];
    const assignments: Array<{ id: string; col: number }> = [];
    for (const s of cluster) {
      const startH = isoToHour(s.starts_at);
      const endH = s.ends_at ? isoToHour(s.ends_at) : startH + 1;
      let col = -1;
      for (let c = 0; c < columnEnds.length; c++) {
        if (startH >= columnEnds[c]) {
          col = c;
          columnEnds[c] = endH;
          break;
        }
      }
      if (col === -1) {
        col = columnEnds.length;
        columnEnds.push(endH);
      }
      assignments.push({ id: s.slot_id, col });
    }
    const colCount = columnEnds.length;
    for (const a of assignments) {
      result.set(a.id, { columnIndex: a.col, columnCount: colCount });
    }
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const s of sorted) {
    const startH = isoToHour(s.starts_at);
    const endH = s.ends_at ? isoToHour(s.ends_at) : startH + 1;
    if (cluster.length > 0 && startH >= clusterEnd) {
      // Gap → close previous cluster.
      flush();
    }
    cluster.push(s);
    clusterEnd = Math.max(clusterEnd, endH);
  }
  flush();
  return result;
}

function formatDayHeader(day: Date, locale: string): string {
  return day.toLocaleDateString(locale, {
    weekday: "short",
    day: "2-digit",
  });
}

function formatRange(
  rangeStart: Date,
  daysCount: number,
  locale: string,
): string {
  if (daysCount === 1) {
    return rangeStart.toLocaleDateString(locale, {
      weekday: "long",
      day: "2-digit",
      month: "short",
    });
  }
  const end = new Date(rangeStart);
  end.setDate(end.getDate() + daysCount - 1);
  const sameMonth = rangeStart.getMonth() === end.getMonth();
  const fmtShort = (d: Date) =>
    d.toLocaleDateString(locale, { day: "2-digit", month: sameMonth ? undefined : "short" });
  return `${fmtShort(rangeStart)} – ${end.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
  })}`;
}

type Props = {
  slots: PlanningSlot[];
  daysCount: number;
  setDaysCount: (n: number) => void;
  rangeStart: Date;
  onNext: () => void;
  onPrev: () => void;
  onSlotPress: (slot: PlanningSlot) => void;
  // Called when user taps an empty hour cell — pre-fills slot creation with
  // that day + hour.
  onEmptyCellPress: (day: Date, hour: number) => void;
  locale: string;
};

export function DaysView({
  slots,
  daysCount,
  setDaysCount,
  rangeStart,
  onNext,
  onPrev,
  onSlotPress,
  onEmptyCellPress,
  locale,
}: Props) {
  const { t } = useTranslation();
  const { height: windowHeight } = useWindowDimensions();
  // Available height for the hour grid = window height minus what's stacked
  // above it (ScreenHeader, ToolShell participants header, view toggle row,
  // range nav, day-count pills, day headers row, and the tool's padding).
  // Tuned empirically; the floor avoids absurdly tiny grids on small phones.
  const gridScrollHeight = Math.max(240, Math.round(windowHeight - 420));

  // Build the day list. rangeStart is treated as local midnight.
  const days = useMemo(() => {
    const list: Date[] = [];
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(rangeStart);
      d.setDate(rangeStart.getDate() + i);
      d.setHours(0, 0, 0, 0);
      list.push(d);
    }
    return list;
  }, [rangeStart, daysCount]);

  const todayKey = useMemo(() => localDayKey(new Date()), []);

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let h = HOUR_START; h <= HOUR_END; h++) list.push(h);
    return list;
  }, []);

  // Bucket slots by local day key for quick lookup.
  const slotsByDay = useMemo(() => {
    const map = new Map<string, PlanningSlot[]>();
    for (const s of slots) {
      if (!s.has_time) continue; // all-day slots handled separately below
      const k = localDayKey(new Date(s.starts_at));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return map;
  }, [slots]);

  // Precompute per-day overlap layouts so DayColumn can render slots
  // side-by-side when they share a time range.
  const layoutsByDay = useMemo(() => {
    const map = new Map<string, Map<string, OverlapLayout>>();
    for (const [day, list] of slotsByDay) {
      map.set(day, computeOverlapLayout(list));
    }
    return map;
  }, [slotsByDay]);

  // Same but for all-day slots.
  const allDayByDay = useMemo(() => {
    const map = new Map<string, PlanningSlot[]>();
    for (const s of slots) {
      if (s.has_time) continue;
      const k = localDayKey(new Date(s.starts_at));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return map;
  }, [slots]);

  return (
    <View
      className="rounded-2xl mb-4"
      style={{
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E8E3DB",
      }}
    >
      {/* Range navigation + day-count selector */}
      <View
        className="flex-row items-center justify-between"
        style={{
          padding: 12,
          borderBottomWidth: 1,
          borderBottomColor: "#F2EDE4",
        }}
      >
        <Pressable
          onPress={onPrev}
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
          style={{ fontSize: 13, fontWeight: "700", color: "#1A1A1A" }}
          numberOfLines={1}
        >
          {formatRange(rangeStart, daysCount, locale)}
        </Text>
        <Pressable
          onPress={onNext}
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

      {/* Day-count pills [1][2][3][4][5][6] */}
      <View
        className="flex-row items-center justify-center"
        style={{
          padding: 8,
          gap: 6,
          borderBottomWidth: 1,
          borderBottomColor: "#F2EDE4",
        }}
      >
        <Text variant="caption" style={{ fontSize: 11, marginRight: 4 }}>
          {t("planning.daysCountLabel")}
        </Text>
        {[1, 2, 3, 4, 5, 6].map((n) => {
          const active = n === daysCount;
          return (
            <Pressable
              key={n}
              onPress={() => setDaysCount(n)}
              hitSlop={4}
              className="items-center justify-center rounded-full active:opacity-70"
              style={{
                width: 26,
                height: 26,
                backgroundColor: active ? theme.primary : "#F3F0FA",
                borderWidth: 1,
                borderColor: active ? theme.primary : "#E8E3DB",
              }}
            >
              <Text
                style={{
                  color: active ? "#FFFFFF" : theme.primaryDeep,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Day headers row */}
      <View className="flex-row" style={{ paddingTop: 6 }}>
        <View style={{ width: HOUR_COL_WIDTH }} />
        {days.map((day) => {
          const key = localDayKey(day);
          const isToday = key === todayKey;
          return (
            <View key={key} style={{ flex: 1, alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 11,
                  color: isToday ? theme.primary : "#6B6B6B",
                  fontWeight: "700",
                  textTransform: "uppercase",
                }}
              >
                {formatDayHeader(day, locale)}
              </Text>
            </View>
          );
        })}
      </View>

      {/* All-day strip (only renders when at least one day has an all-day slot) */}
      {Array.from(allDayByDay.values()).some((list) => list.length > 0) ? (
        <View
          className="flex-row"
          style={{
            paddingVertical: 4,
            borderTopWidth: 1,
            borderTopColor: "#F2EDE4",
            marginTop: 4,
            backgroundColor: "#FAF7F2",
          }}
        >
          <View
            style={{
              width: HOUR_COL_WIDTH,
              alignItems: "flex-end",
              paddingRight: 4,
            }}
          >
            <Text
              variant="caption"
              style={{ fontSize: 9, color: "#9CA3AF" }}
            >
              {t("planning.allDay")}
            </Text>
          </View>
          {days.map((day) => {
            const key = localDayKey(day);
            const items = allDayByDay.get(key) ?? [];
            return (
              <View
                key={key}
                style={{ flex: 1, paddingHorizontal: 2, gap: 2 }}
              >
                {items.map((s) => (
                  <Pressable
                    key={s.slot_id}
                    onPress={() => onSlotPress(s)}
                    className="rounded active:opacity-70"
                    style={{
                      paddingHorizontal: 4,
                      paddingVertical: 2,
                      backgroundColor: theme.primarySoft,
                      borderLeftWidth: 2,
                      borderLeftColor: theme.primary,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 10,
                        color: theme.primaryDeep,
                        fontWeight: "600",
                      }}
                    >
                      {s.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Scrollable hour grid — sized to fit the screen so the outer page
          scroll stays inert and the user only ever scrolls the hours. */}
      <ScrollView
        style={{ height: gridScrollHeight }}
        contentContainerStyle={{ paddingBottom: 8 }}
      >
        <View className="flex-row">
          {/* Hours column */}
          <View style={{ width: HOUR_COL_WIDTH }}>
            {hours.map((h) => (
              <View
                key={h}
                style={{
                  height: HOUR_HEIGHT,
                  alignItems: "flex-end",
                  paddingRight: 4,
                  paddingTop: 2,
                  borderTopWidth: 1,
                  borderTopColor: "#F2EDE4",
                }}
              >
                <Text
                  variant="caption"
                  style={{ fontSize: 10, color: "#9CA3AF" }}
                >
                  {pad(h)}h
                </Text>
              </View>
            ))}
          </View>

          {/* Day columns */}
          {days.map((day) => {
            const k = localDayKey(day);
            return (
              <DayColumn
                key={k}
                day={day}
                slots={slotsByDay.get(k) ?? []}
                layouts={layoutsByDay.get(k) ?? new Map()}
                onSlotPress={onSlotPress}
                onEmptyCellPress={onEmptyCellPress}
              />
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function DayColumn({
  day,
  slots,
  layouts,
  onSlotPress,
  onEmptyCellPress,
}: {
  day: Date;
  slots: PlanningSlot[];
  layouts: Map<string, OverlapLayout>;
  onSlotPress: (s: PlanningSlot) => void;
  onEmptyCellPress: (day: Date, hour: number) => void;
}) {
  return (
    <View
      style={{
        flex: 1,
        height: TOTAL_HEIGHT,
        borderLeftWidth: 1,
        borderLeftColor: "#F2EDE4",
        position: "relative",
      }}
    >
      {/* Empty hour cells (tap target for "create at this hour") */}
      {Array.from(
        { length: HOUR_END - HOUR_START + 1 },
        (_, i) => HOUR_START + i,
      ).map((h) => (
        <Pressable
          key={h}
          onPress={() => onEmptyCellPress(day, h)}
          style={{
            height: HOUR_HEIGHT,
            borderTopWidth: 1,
            borderTopColor: "#F2EDE4",
          }}
        />
      ))}

      {/* Slot overlays positioned by absolute time + side-by-side when
          overlapping (Google-Calendar-style column split). */}
      {slots.map((s) => {
        const startH = isoToHour(s.starts_at);
        const endH = s.ends_at ? isoToHour(s.ends_at) : startH + 1;
        if (endH <= HOUR_START || startH > HOUR_END + 1) return null;
        const clampedStart = Math.max(startH, HOUR_START);
        const clampedEnd = Math.min(endH, HOUR_END + 1);
        const top = (clampedStart - HOUR_START) * HOUR_HEIGHT;
        const height = Math.max((clampedEnd - clampedStart) * HOUR_HEIGHT, 22);
        const layout = layouts.get(s.slot_id) ?? {
          columnIndex: 0,
          columnCount: 1,
        };
        const widthPct = 100 / layout.columnCount;
        const leftPct = layout.columnIndex * widthPct;
        return (
          <Pressable
            key={s.slot_id}
            onPress={() => onSlotPress(s)}
            className="active:opacity-80"
            style={{
              position: "absolute",
              top,
              left: `${leftPct}%`,
              width: `${widthPct}%`,
              height,
              paddingLeft: 2,
              paddingRight: 2,
            }}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: theme.primarySoft,
                borderLeftWidth: 3,
                borderLeftColor: theme.primary,
                borderRadius: 6,
                padding: 4,
                overflow: "hidden",
              }}
            >
              <Text
                numberOfLines={height >= 36 ? 2 : 1}
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: theme.primaryDeep,
                  lineHeight: 14,
                }}
              >
                {s.title}
              </Text>
              {height >= 48 && layout.columnCount === 1 && s.location ? (
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 10,
                    color: theme.primary,
                    marginTop: 1,
                  }}
                >
                  {s.location}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
