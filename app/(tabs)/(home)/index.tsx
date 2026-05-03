import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { EditEventModal } from "@/components/EditEventModal";
import { NewEventModal } from "@/components/NewEventModal";
import { Card, FAB, ScreenHeader, Text } from "@/components/ui";
import {
  Event,
  archiveEvent,
  listMyEvents,
  listSharedEvents,
  unarchiveEvent,
} from "@/lib/events";
import { useIsMobile } from "@/lib/responsive";
import { theme } from "@/lib/theme";

function formatDateRange(
  start: string | null,
  end: string | null,
  locale: string,
): string | null {
  if (!start && !end) return null;
  const opts: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  };
  const fmt = (iso: string) => new Date(iso).toLocaleString(locale, opts);
  if (start && end) return `${fmt(start)} — ${fmt(end)}`;
  return fmt((start ?? end) as string);
}

function EventRow({
  event,
  locale,
  archivedMode,
  onArchive,
  onUnarchive,
  onEdit,
}: {
  event: Event;
  locale: string;
  archivedMode: boolean;
  onArchive: (eventId: string) => void;
  onUnarchive: (eventId: string) => void;
  onEdit: (event: Event) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const isMobile = useIsMobile();
  const iconBtnSize = isMobile ? 24 : 32;
  const pencilSize = isMobile ? 12 : 16;
  const archiveSize = isMobile ? 13 : 17;
  const range = formatDateRange(
    event.event_start_date,
    event.event_end_date,
    locale,
  );

  const requestArchive = () => {
    const title = t("events.card.archiveConfirmTitle");
    const message = t("events.card.archiveConfirmMessage");
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (window.confirm(`${title}\n\n${message}`)) onArchive(event.event_id);
      return;
    }
    Alert.alert(title, message, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("events.card.archive"),
        style: "destructive",
        onPress: () => onArchive(event.event_id),
      },
    ]);
  };

  const actionLabel = archivedMode
    ? t("events.card.unarchive")
    : t("events.card.archive");
  const handleAction = archivedMode
    ? () => onUnarchive(event.event_id)
    : requestArchive;
  const isAdmin = event.my_role === "admin";

  const archiveIcon: React.ComponentProps<typeof Ionicons>["name"] = archivedMode
    ? "arrow-undo-outline"
    : "archive-outline";

  return (
    <Card
      pressable
      onPress={() => router.push(`/events/${event.event_id}`)}
      className="mb-3 overflow-hidden p-0"
    >
      <View className="flex-row">
        <LinearGradient
          colors={[theme.primary, theme.primaryLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ width: 6 }}
        />
        <View className="flex-1 p-4">
          <Text variant="h3" className="mb-1" numberOfLines={2}>
            {event.event_title}
          </Text>
          <View
            className="flex-row items-center"
            style={{ gap: 6 }}
          >
            <Text variant="caption" className="flex-1" numberOfLines={1}>
              {range ?? t("events.card.noDates")}
            </Text>
            {isAdmin ? (
              <Pressable
                onPress={() => onEdit(event)}
                accessibilityLabel={t("events.edit.action")}
                hitSlop={10}
                className="items-center justify-center rounded-full active:opacity-70"
                style={{
                  width: iconBtnSize,
                  height: iconBtnSize,
                  backgroundColor: theme.primarySoft,
                }}
              >
                <Ionicons name="pencil" size={pencilSize} color={theme.primary} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={handleAction}
              accessibilityLabel={actionLabel}
              hitSlop={10}
              className="items-center justify-center rounded-full active:opacity-70"
              style={{
                width: iconBtnSize,
                height: iconBtnSize,
                backgroundColor: "#FEF3C7",
              }}
            >
              <Ionicons name={archiveIcon} size={archiveSize} color="#92400E" />
            </Pressable>
          </View>
          {event.event_description ? (
            <Text variant="body" className="mt-2" numberOfLines={2}>
              {event.event_description}
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

function Section({
  title,
  events,
  emptyLabel,
  locale,
  archivedMode,
  onArchive,
  onUnarchive,
  onEdit,
}: {
  title: string;
  events: Event[];
  emptyLabel: string;
  locale: string;
  archivedMode: boolean;
  onArchive: (eventId: string) => void;
  onUnarchive: (eventId: string) => void;
  onEdit: (event: Event) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <View className="mb-6">
      <Pressable
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center py-2 mb-4"
      >
        <Text
          className="flex-1 uppercase"
          style={{
            color: theme.sectionLabel,
            fontSize: 12,
            fontWeight: "700",
            letterSpacing: 1.5,
          }}
        >
          {title}
        </Text>
        <Text
          variant="caption"
          className="mr-2"
          style={{ color: theme.sectionLabel }}
        >
          {open ? "▾" : "▸"}
        </Text>
        <View
          className="px-2.5 py-0.5 rounded-full"
          style={{ backgroundColor: theme.primarySoft }}
        >
          <Text
            variant="caption"
            style={{ color: theme.primary, fontWeight: "700" }}
          >
            {events.length}
          </Text>
        </View>
      </Pressable>
      {open ? (
        events.length === 0 ? (
          <View className="py-4">
            <Text variant="caption">{emptyLabel}</Text>
          </View>
        ) : (
          events.map((e) => (
            <EventRow
              key={e.event_id}
              event={e}
              locale={locale}
              archivedMode={archivedMode}
              onArchive={onArchive}
              onUnarchive={onUnarchive}
              onEdit={onEdit}
            />
          ))
        )
      ) : null}
    </View>
  );
}

export default function EventsScreen() {
  const { t, i18n } = useTranslation();
  const [showArchived, setShowArchived] = useState(false);
  const [newEventOpen, setNewEventOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [mine, setMine] = useState<Event[]>([]);
  const [shared, setShared] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [m, s] = await Promise.all([
      listMyEvents({ archived: showArchived }),
      listSharedEvents({ archived: showArchived }),
    ]);
    setMine(m);
    setShared(s);
  }, [showArchived]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      load()
        .catch(() => {
          if (active) {
            setMine([]);
            setShared([]);
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const showCreateBanner = !loading && mine.length === 0 && !showArchived;

  const removeFromLists = useCallback((eventId: string) => {
    setMine((prev) => prev.filter((e) => e.event_id !== eventId));
    setShared((prev) => prev.filter((e) => e.event_id !== eventId));
  }, []);

  const handleArchive = useCallback(
    async (eventId: string) => {
      removeFromLists(eventId);
      try {
        await archiveEvent(eventId);
      } catch {
        await load();
      }
    },
    [load, removeFromLists],
  );

  const handleUnarchive = useCallback(
    async (eventId: string) => {
      removeFromLists(eventId);
      try {
        await unarchiveEvent(eventId);
      } catch {
        await load();
      }
    },
    [load, removeFromLists],
  );

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t("events.title")} showLogo />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 120,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View className="flex-row items-center justify-between mb-4">
            <Text variant="label">{t("events.showArchived")}</Text>
            <Switch
              value={showArchived}
              onValueChange={setShowArchived}
              trackColor={{ false: "#E8E3DB", true: theme.primary }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E8E3DB"
            />
          </View>

          {showCreateBanner ? (
            <Pressable
              onPress={() => setNewEventOpen(true)}
              accessibilityLabel={t("events.newButton")}
              className="active:opacity-90 mb-6 overflow-hidden rounded-2xl"
            >
              <LinearGradient
                colors={[theme.primary, theme.primaryLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ paddingVertical: 28, paddingHorizontal: 20 }}
              >
                <View
                  className="flex-row items-center"
                  style={{ gap: 16 }}
                >
                  <View
                    className="rounded-full items-center justify-center"
                    style={{
                      width: 56,
                      height: 56,
                      backgroundColor: "rgba(255,255,255,0.2)",
                    }}
                  >
                    <Ionicons name="add" size={32} color="#FFFFFF" />
                  </View>
                  <View className="flex-1">
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontSize: 18,
                        fontWeight: "700",
                      }}
                    >
                      {t("events.createBanner.title")}
                    </Text>
                    <Text
                      style={{
                        color: "rgba(255,255,255,0.85)",
                        fontSize: 13,
                        marginTop: 2,
                      }}
                    >
                      {t("events.createBanner.subtitle")}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </Pressable>
          ) : null}

          <Section
            title={t("events.sections.mine")}
            events={mine}
            emptyLabel={t("events.empty.mine")}
            locale={i18n.language}
            archivedMode={showArchived}
            onArchive={handleArchive}
            onUnarchive={handleUnarchive}
            onEdit={setEditingEvent}
          />
          <Section
            title={t("events.sections.shared")}
            events={shared}
            emptyLabel={t("events.empty.shared")}
            locale={i18n.language}
            archivedMode={showArchived}
            onArchive={handleArchive}
            onUnarchive={handleUnarchive}
            onEdit={setEditingEvent}
          />
        </ScrollView>
      )}
      {!showCreateBanner && !showArchived ? (
        <FAB
          onPress={() => setNewEventOpen(true)}
          accessibilityLabel={t("events.newButton")}
        />
      ) : null}
      <NewEventModal
        visible={newEventOpen}
        onClose={() => setNewEventOpen(false)}
        onCreated={() => {
          setNewEventOpen(false);
          load();
        }}
      />
      <EditEventModal
        visible={!!editingEvent}
        event={editingEvent}
        onClose={() => setEditingEvent(null)}
        onSaved={() => {
          setEditingEvent(null);
          load();
        }}
      />
    </View>
  );
}
