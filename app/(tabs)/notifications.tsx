import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Avatar, ScreenHeader, Text } from "@/components/ui";
import { listActivity, type ActivityItem } from "@/lib/notifications";
import { useNotifications } from "@/lib/useNotifications";
import { theme } from "@/lib/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

// Page size for the activity feed — older entries load on scroll.
const PAGE_SIZE = 30;

// Leading icon per activity category (matches the tool icons used elsewhere).
function iconFor(type: string): IconName {
  if (type.startsWith("expense") || type.startsWith("settlement"))
    return "wallet-outline";
  if (type.startsWith("proposal")) return "bulb-outline";
  if (type.startsWith("planning")) return "calendar-outline";
  if (type.startsWith("meal")) return "restaurant-outline";
  if (type.startsWith("note")) return "document-text-outline";
  if (type.startsWith("vehicle") || type.startsWith("carpool"))
    return "car-outline";
  if (type.startsWith("team")) return "people-outline";
  if (type.startsWith("tool")) return "construct-outline";
  if (type.startsWith("participant")) return "person-add-outline";
  return "notifications-outline";
}

function initialsOf(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// A run of adjacent activities sharing (actor, tool, type) — rendered as one
// row ("Marie added 3 expenses"). The representative is the newest item.
type ActivityGroup = {
  key: string;
  item: ActivityItem;
  count: number;
  is_unread: boolean;
};

function groupActivity(items: ActivityItem[]): ActivityGroup[] {
  const groups: ActivityGroup[] = [];
  for (const it of items) {
    const last = groups[groups.length - 1];
    if (
      last &&
      last.item.actor_id === it.actor_id &&
      last.item.tool_id === it.tool_id &&
      last.item.type === it.type
    ) {
      last.count += 1;
      last.is_unread = last.is_unread || it.is_unread;
    } else {
      groups.push({ key: it.id, item: it, count: 1, is_unread: it.is_unread });
    }
  }
  return groups;
}

function useFormatters() {
  const { t } = useTranslation();

  const describe = (group: ActivityGroup): string => {
    const item = group.item;
    const actor = item.actor_name ?? t("notifications.someone");
    if (group.count > 1) {
      const grouped = t(`notifications.feedGroup.${item.type}`, {
        actor,
        count: group.count,
        defaultValue: "",
      });
      return (
        grouped ||
        t("notifications.feedGroup.fallback", { actor, count: group.count })
      );
    }
    const msg = t(`notifications.feed.${item.type}`, {
      actor,
      ...item.payload,
      defaultValue: "",
    });
    return msg || t("notifications.feed.fallback", { actor });
  };

  const timeAgo = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return t("notifications.time.now");
    if (min < 60) return t("notifications.time.minute", { count: min });
    const h = Math.floor(min / 60);
    if (h < 24) return t("notifications.time.hour", { count: h });
    const d = Math.floor(h / 24);
    if (d < 7) return t("notifications.time.day", { count: d });
    return t("notifications.time.week", { count: Math.floor(d / 7) });
  };

  return { describe, timeAgo };
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { markSeen } = useNotifications();
  const { describe, timeAgo } = useFormatters();

  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const groups = useMemo(() => groupActivity(items), [items]);

  const openTarget = useCallback(
    (item: ActivityItem) => {
      if (item.tool_id) {
        router.push(`/events/${item.event_id}/tools/${item.tool_id}`);
      } else {
        router.push(`/events/${item.event_id}`);
      }
    },
    [router],
  );

  // Load the first page. Older pages are fetched on scroll (see loadMore),
  // so we never pull the whole history at once.
  const loadFirst = useCallback(async () => {
    try {
      const page = await listActivity(PAGE_SIZE);
      setItems(page);
      setHasMore(page.length === PAGE_SIZE);
    } catch {
      setItems([]);
      setHasMore(false);
    }
  }, []);

  // Fetch the next page using the oldest loaded item as the cursor.
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || items.length === 0) return;
    setLoadingMore(true);
    try {
      const before = items[items.length - 1].created_at;
      const page = await listActivity(PAGE_SIZE, before);
      setItems((prev) => [...prev, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, items]);

  // Each time the tab gains focus: load the first page (with its unread
  // highlights relative to the previous cursor), then move the cursor so the
  // badge clears.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        await loadFirst();
        if (active) setLoading(false);
        await markSeen();
      })();
      return () => {
        active = false;
      };
    }, [loadFirst, markSeen]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFirst();
    setRefreshing(false);
  }, [loadFirst]);

  const renderItem = ({ item: group }: { item: ActivityGroup }) => {
    const item = group.item;
    return (
      <Pressable
        onPress={() => openTarget(item)}
        className="flex-row items-start active:opacity-70"
        style={{
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 4,
          backgroundColor: group.is_unread ? "#FEF9EC" : "transparent",
          borderRadius: 12,
        }}
      >
        <View style={{ position: "relative" }}>
          <Avatar
            src={item.actor_avatar_url ?? undefined}
            initials={initialsOf(item.actor_name)}
            size="md"
          />
          <View
            className="items-center justify-center rounded-full"
            style={{
              position: "absolute",
              bottom: -2,
              right: -2,
              width: 20,
              height: 20,
              backgroundColor: "#FFFFFF",
            }}
          >
            <Ionicons
              name={iconFor(item.type)}
              size={13}
              color={theme.primary}
            />
          </View>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 14, color: "#1A1A1A", lineHeight: 19 }}>
            {describe(group)}
          </Text>
          <View className="flex-row items-center" style={{ gap: 6 }}>
            {item.event_title ? (
              <Text
                variant="caption"
                style={{ fontSize: 12 }}
                numberOfLines={1}
              >
                {item.event_title}
              </Text>
            ) : null}
            <Text variant="caption" style={{ fontSize: 12, color: "#9CA3AF" }}>
              · {timeAgo(item.created_at)}
            </Text>
          </View>
        </View>
        {group.is_unread ? (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: "#FBBF24",
              marginTop: 6,
            }}
          />
        ) : null}
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t("notifications.title")} showLogo />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : items.length === 0 ? (
        <View
          className="flex-1 items-center justify-center px-10"
          style={{ gap: 12 }}
        >
          <Ionicons
            name="notifications-outline"
            size={48}
            color={theme.primary}
          />
          <Text variant="caption" style={{ textAlign: "center" }}>
            {t("notifications.empty")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.key}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 120,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}
