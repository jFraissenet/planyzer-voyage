import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui";
import {
  listEventToolPlanningSlots,
  type PlanningSlot,
} from "@/lib/planning";
import { useSession } from "@/lib/useSession";
import { CalendarGrid, localDayKey } from "./CalendarGrid";
import { DaysView } from "./DaysView";
import { SlotCard } from "./SlotCard";
import { SlotEditModal } from "./SlotEditModal";
import { ToolShell, type ToolProps } from "../ToolShell";
import { theme } from "@/lib/theme";

type PlanningView = "calendar" | "days" | "list";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Build a local input string (YYYY-MM-DDTHH:MM) for the given day at the
// given hour — feeds the SlotEditModal pre-fill so a calendar/days-grid tap
// lands the user on the right starting time.
function dayHourToLocalInput(d: Date, hour: number = 12): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:00`;
}

function formatDayHeader(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale, {
      weekday: "long",
      day: "2-digit",
      month: "short",
    });
  } catch {
    return iso;
  }
}

export function PlanningTool(props: ToolProps) {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const currentUserId = session?.user?.id ?? "";

  const [slots, setSlots] = useState<PlanningSlot[]>([]);
  const [view, setView] = useState<PlanningView>("calendar");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PlanningSlot | null>(null);

  // Calendar state: which month is shown, which day is highlighted.
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Days-view state: how many days side-by-side and where the window starts.
  const [daysCount, setDaysCount] = useState<number>(3);
  const [daysRangeStart, setDaysRangeStart] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  // initialStartsAt that the next "+" press should use (set when user taps an
  // empty hour cell in DaysView).
  const [pendingPrefill, setPendingPrefill] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await listEventToolPlanningSlots(props.tool.event_tool_id);
      setSlots(list);
    } catch {
      setSlots([]);
    }
  }, [props.tool.event_tool_id]);

  useEffect(() => {
    load();
  }, [load]);

  const canEdit = useCallback(
    (s: PlanningSlot): boolean =>
      s.author_id === currentUserId || props.isToolAdmin,
    [currentUserId, props.isToolAdmin],
  );

  const groupedByDay = useMemo(() => {
    const map = new Map<string, { iso: string; slots: PlanningSlot[] }>();
    for (const s of slots) {
      const k = localDayKey(new Date(s.starts_at));
      if (!map.has(k)) map.set(k, { iso: s.starts_at, slots: [] });
      map.get(k)!.slots.push(s);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({ key, ...value }));
  }, [slots]);

  const slotDays = useMemo(
    () => new Set(groupedByDay.map((g) => g.key)),
    [groupedByDay],
  );

  // Slots that fall on the selected day, sorted by start time.
  const selectedDaySlots = useMemo(() => {
    if (!selectedDay) return [];
    const key = localDayKey(selectedDay);
    return slots
      .filter((s) => localDayKey(new Date(s.starts_at)) === key)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }, [selectedDay, slots]);

  const handleSelectDay = (day: Date) => {
    setSelectedDay(day);
    // Move the displayed month to follow the selected day if it spilled
    // into the prev/next month grid.
    if (
      day.getMonth() !== calendarMonth.getMonth()
      || day.getFullYear() !== calendarMonth.getFullYear()
    ) {
      setCalendarMonth(new Date(day.getFullYear(), day.getMonth(), 1));
    }
  };

  const handleAddPress = () => {
    setCreating(true);
  };

  // initialStartsAt resolution order: explicit cell tap (pendingPrefill)
  //   > calendar view's selected day → noon
  //   > nothing (modal opens with empty start).
  const initialStartsAt =
    pendingPrefill
    ?? (view === "calendar" && selectedDay
      ? dayHourToLocalInput(selectedDay, 12)
      : undefined);

  const openCreateAt = (day: Date, hour: number) => {
    setPendingPrefill(dayHourToLocalInput(day, hour));
    setCreating(true);
  };

  return (
    <>
      <ToolShell {...props}>
        {/* View toggle + add, all on one compact row of icons. */}
        <View
          className="flex-row items-center mb-4"
          style={{ gap: 8 }}
        >
          <View
            className="flex-row rounded-full overflow-hidden"
            style={{
              borderWidth: 1,
              borderColor: "#E8E3DB",
              backgroundColor: "#F3F0FA",
            }}
          >
            <IconToggleButton
              icon="calendar-outline"
              active={view === "calendar"}
              accessibilityLabel={t("planning.viewCalendar")}
              onPress={() => setView("calendar")}
            />
            <IconToggleButton
              icon="grid-outline"
              active={view === "days"}
              accessibilityLabel={t("planning.viewDays")}
              onPress={() => setView("days")}
            />
            <IconToggleButton
              icon="list-outline"
              active={view === "list"}
              accessibilityLabel={t("planning.viewList")}
              onPress={() => setView("list")}
            />
          </View>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={handleAddPress}
            accessibilityLabel={t("planning.add")}
            className="rounded-full items-center justify-center active:opacity-80"
            style={{
              width: 36,
              height: 36,
              backgroundColor: theme.primary,
            }}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        {view === "days" ? (
          // ============================ DAYS VIEW ============================
          <DaysView
            slots={slots}
            daysCount={daysCount}
            setDaysCount={setDaysCount}
            rangeStart={daysRangeStart}
            onPrev={() => {
              const d = new Date(daysRangeStart);
              d.setDate(d.getDate() - daysCount);
              setDaysRangeStart(d);
            }}
            onNext={() => {
              const d = new Date(daysRangeStart);
              d.setDate(d.getDate() + daysCount);
              setDaysRangeStart(d);
            }}
            onSlotPress={(s) => setEditing(s)}
            onEmptyCellPress={openCreateAt}
            locale={i18n.language}
          />
        ) : view === "list" ? (
          // ============================ LIST VIEW ============================
          groupedByDay.length === 0 ? (
            <View className="py-10 items-center">
              <Ionicons
                name="calendar-outline"
                size={28}
                color="#9CA3AF"
                style={{ marginBottom: 8 }}
              />
              <Text variant="caption" className="text-center">
                {t("planning.empty")}
              </Text>
            </View>
          ) : (
            groupedByDay.map((group) => (
              <View key={group.key} className="mb-4">
                <Text
                  variant="caption"
                  className="mb-2 uppercase"
                  style={{
                    letterSpacing: 1,
                    fontWeight: "700",
                    fontSize: 11,
                    color: theme.primary,
                  }}
                >
                  {formatDayHeader(group.iso, i18n.language)}
                </Text>
                {group.slots.map((s) => (
                  <SlotCard
                    key={s.slot_id}
                    slot={s}
                    locale={i18n.language}
                    canEdit={canEdit(s)}
                    onOpen={() => setEditing(s)}
                    onEdit={() => setEditing(s)}
                  />
                ))}
              </View>
            ))
          )
        ) : (
          // ============================ CALENDAR VIEW ============================
          <>
            <CalendarGrid
              month={calendarMonth}
              selectedDay={selectedDay}
              slotDays={slotDays}
              locale={i18n.language}
              onPrevMonth={() =>
                setCalendarMonth(
                  new Date(
                    calendarMonth.getFullYear(),
                    calendarMonth.getMonth() - 1,
                    1,
                  ),
                )
              }
              onNextMonth={() =>
                setCalendarMonth(
                  new Date(
                    calendarMonth.getFullYear(),
                    calendarMonth.getMonth() + 1,
                    1,
                  ),
                )
              }
              onSelectDay={handleSelectDay}
            />

            {selectedDay ? (
              <>
                <Text
                  variant="caption"
                  className="mb-2 uppercase"
                  style={{
                    letterSpacing: 1,
                    fontWeight: "700",
                    fontSize: 11,
                    color: theme.primary,
                  }}
                >
                  {formatDayHeader(selectedDay.toISOString(), i18n.language)}
                </Text>
                {selectedDaySlots.length === 0 ? (
                  <View className="py-6 items-center">
                    <Text variant="caption" className="text-center">
                      {t("planning.empty")}
                    </Text>
                  </View>
                ) : (
                  selectedDaySlots.map((s) => (
                    <SlotCard
                      key={s.slot_id}
                      slot={s}
                      locale={i18n.language}
                      canEdit={canEdit(s)}
                      onOpen={() => setEditing(s)}
                      onEdit={() => setEditing(s)}
                    />
                  ))
                )}
              </>
            ) : (
              <Text
                variant="caption"
                className="text-center"
                style={{ paddingVertical: 16 }}
              >
                {t("planning.tapDayHint")}
              </Text>
            )}
          </>
        )}
      </ToolShell>

      <SlotEditModal
        mode="create"
        visible={creating}
        toolId={props.tool.event_tool_id}
        eventId={props.tool.event_tool_event_id}
        initialStartsAt={initialStartsAt}
        onClose={() => {
          setCreating(false);
          setPendingPrefill(null);
        }}
        onSaved={() => {
          setCreating(false);
          setPendingPrefill(null);
          load();
        }}
      />

      {editing ? (
        <SlotEditModal
          mode="edit"
          visible
          toolId={props.tool.event_tool_id}
          eventId={props.tool.event_tool_event_id}
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : null}
    </>
  );
}

function IconToggleButton({
  icon,
  active,
  accessibilityLabel,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  active: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
      className="items-center justify-center active:opacity-70"
      style={{
        paddingHorizontal: 14,
        height: 34,
        backgroundColor: active ? theme.primary : "transparent",
      }}
    >
      <Ionicons
        name={icon}
        size={17}
        color={active ? "#FFFFFF" : theme.primaryDeep}
      />
    </Pressable>
  );
}
