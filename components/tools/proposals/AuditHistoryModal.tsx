import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Avatar, Text } from "@/components/ui";
import {
  listEventToolAudit,
  type EventToolAuditEntry,
} from "@/lib/proposals";
import type { VoteStyle } from "@/lib/proposals/modes";
import { theme } from "@/lib/theme";

type Props = {
  visible: boolean;
  toolId: string;
  onClose: () => void;
};

const PAGE_SIZE = 20;
const VALID_STYLES: VoteStyle[] = ["tri", "check", "single"];

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

function readVoteStyle(value: unknown): VoteStyle | null {
  if (typeof value !== "string") return null;
  return VALID_STYLES.includes(value as VoteStyle) ? (value as VoteStyle) : null;
}

function formatDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleString(locale, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function VoteStyleChip({ style }: { style: VoteStyle | null }) {
  const { t } = useTranslation();
  const label = style
    ? t(`proposals.voteStyle.${style}`)
    : t("proposals.history.styleDefault");
  return (
    <View
      className="rounded-md px-2 py-0.5"
      style={{ backgroundColor: theme.primarySoft }}
    >
      <Text
        variant="caption"
        style={{ fontSize: 12, color: theme.primaryDeep, fontWeight: "600" }}
      >
        {label}
      </Text>
    </View>
  );
}

function VoteStyleChangeBody({ entry }: { entry: EventToolAuditEntry }) {
  const { t } = useTranslation();
  const from = readVoteStyle(
    entry.from_value && (entry.from_value as Record<string, unknown>).vote_style,
  );
  const to = readVoteStyle(
    entry.to_value && (entry.to_value as Record<string, unknown>).vote_style,
  );
  const removed = entry.removed_votes_count;
  const affected = entry.affected_user_ids.length;

  return (
    <View style={{ gap: 8 }}>
      <View className="flex-row flex-wrap items-center" style={{ gap: 6 }}>
        <Text variant="caption" style={{ fontSize: 13 }}>
          {t("proposals.history.voteStyleChangeIntro")}
        </Text>
        <VoteStyleChip style={from} />
        <Text variant="caption" style={{ fontSize: 13 }}>
          {t("proposals.history.voteStyleChangeArrow")}
        </Text>
        <VoteStyleChip style={to} />
      </View>
      {removed > 0 ? (
        <Text
          variant="caption"
          style={{ fontSize: 12, color: "#6B7280", fontStyle: "italic" }}
        >
          {t("proposals.history.removedVotes", { count: removed })}
          {affected > 0
            ? ` · ${t("proposals.history.affectedUsers", { count: affected })}`
            : ""}
        </Text>
      ) : (
        <Text
          variant="caption"
          style={{ fontSize: 12, color: "#6B7280", fontStyle: "italic" }}
        >
          {t("proposals.history.noImpact")}
        </Text>
      )}
    </View>
  );
}

function EntryCard({ entry, locale }: { entry: EventToolAuditEntry; locale: string }) {
  const { t } = useTranslation();
  const author = entry.changed_by_full_name ?? t("proposals.history.unknownAuthor");
  return (
    <View
      className="rounded-xl p-3 mb-3"
      style={{
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E5E7EB",
        gap: 10,
      }}
    >
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <Avatar
          src={entry.changed_by_avatar_url ?? undefined}
          initials={initialsOf(entry.changed_by_full_name)}
          size="xs"
        />
        <Text variant="label" style={{ fontSize: 13, fontWeight: "600" }}>
          {author}
        </Text>
        <Text variant="caption" style={{ fontSize: 12, color: "#9CA3AF" }}>
          · {formatDate(entry.changed_at, locale)}
        </Text>
      </View>

      {entry.change_type === "vote_style_change" ? (
        <VoteStyleChangeBody entry={entry} />
      ) : (
        <Text variant="caption" style={{ fontSize: 12, color: "#6B7280" }}>
          {entry.change_type}
        </Text>
      )}
    </View>
  );
}

export function AuditHistoryModal({ visible, toolId, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const [entries, setEntries] = useState<EventToolAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (offset: number) => {
      const page = await listEventToolAudit(toolId, PAGE_SIZE, offset);
      return page;
    },
    [toolId],
  );

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setEntries([]);
    setError(null);
    setHasMore(false);
    setLoading(true);
    fetchPage(0)
      .then((page) => {
        if (cancelled) return;
        setEntries(page);
        setHasMore(page.length === PAGE_SIZE);
      })
      .catch(() => {
        if (!cancelled) setError(t("common.error"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, fetchPage, t]);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(entries.length);
      setEntries((prev) => [...prev, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    } catch {
      setError(t("common.error"));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 justify-end"
        style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-surface rounded-t-2xl"
          style={{ maxHeight: "85%" }}
        >
          <View
            className="flex-row items-center justify-between px-5 pt-5 pb-3"
            style={{
              borderBottomWidth: 1,
              borderBottomColor: "#E5E7EB",
            }}
          >
            <Text variant="label" style={{ fontSize: 17, fontWeight: "700" }}>
              {t("proposals.history.title")}
            </Text>
            <Pressable
              onPress={onClose}
              className="rounded-full items-center justify-center"
              style={{
                width: 28,
                height: 28,
                backgroundColor: "#F3F4F6",
              }}
              accessibilityLabel={t("common.close")}
            >
              <Ionicons name="close" size={16} color="#6B7280" />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
          >
            {loading ? (
              <View className="py-8 items-center">
                <ActivityIndicator color={theme.primary} />
              </View>
            ) : error && entries.length === 0 ? (
              <Text variant="caption" style={{ color: "#991B1B" }}>
                {error}
              </Text>
            ) : entries.length === 0 ? (
              <View className="py-10 items-center">
                <Ionicons
                  name="time-outline"
                  size={28}
                  color="#9CA3AF"
                  style={{ marginBottom: 8 }}
                />
                <Text
                  variant="caption"
                  style={{
                    color: "#6B7280",
                    textAlign: "center",
                    fontSize: 13,
                  }}
                >
                  {t("proposals.history.empty")}
                </Text>
              </View>
            ) : (
              <>
                {entries.map((e) => (
                  <EntryCard key={e.audit_id} entry={e} locale={i18n.language} />
                ))}
                {hasMore ? (
                  <Pressable
                    onPress={loadMore}
                    disabled={loadingMore}
                    className="rounded-xl items-center justify-center"
                    style={{
                      paddingVertical: 12,
                      backgroundColor: theme.primarySoft,
                      opacity: loadingMore ? 0.6 : 1,
                    }}
                  >
                    {loadingMore ? (
                      <ActivityIndicator color={theme.primary} />
                    ) : (
                      <Text
                        variant="label"
                        style={{
                          fontWeight: "600",
                          color: theme.primaryDeep,
                          textAlign: "center",
                        }}
                      >
                        {t("proposals.history.loadMore")}
                      </Text>
                    )}
                  </Pressable>
                ) : null}
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
