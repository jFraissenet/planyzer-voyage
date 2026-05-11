import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Avatar, Text } from "@/components/ui";
import {
  applyVoteStyleChange,
  previewVoteStyleChange,
  type VoteStyleChangePreview,
} from "@/lib/proposals";
import type { VoteStyle } from "@/lib/proposals/modes";
import { theme } from "@/lib/theme";

type Props = {
  visible: boolean;
  toolId: string;
  currentStyle: VoteStyle;
  newStyle: VoteStyle;
  onCancel: () => void;
  onConfirmed: () => void;
};

const MAX_NAMES = 3;

function firstName(full: string | null): string {
  if (!full) return "?";
  return full.trim().split(/\s+/)[0];
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

function StylePill({ style }: { style: VoteStyle }) {
  const { t } = useTranslation();
  return (
    <View
      className="flex-1 rounded-xl px-3 py-3 items-center"
      style={{
        backgroundColor: theme.primarySoft,
        borderWidth: 1,
        borderColor: theme.primary,
      }}
    >
      <Text
        variant="label"
        style={{
          fontSize: 13,
          fontWeight: "700",
          color: theme.primaryDeep,
          textAlign: "center",
        }}
      >
        {t(`proposals.voteStyle.${style}`)}
      </Text>
    </View>
  );
}

export function ConfirmVoteStyleChangeModal({
  visible,
  toolId,
  currentStyle,
  newStyle,
  onCancel,
  onConfirmed,
}: Props) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<VoteStyleChangePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setPreview(null);
    setError(null);
    setLoading(true);
    previewVoteStyleChange(toolId, newStyle)
      .then((p) => {
        if (!cancelled) setPreview(p);
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
  }, [visible, toolId, newStyle, t]);

  const confirm = async () => {
    setBusy(true);
    try {
      await applyVoteStyleChange(toolId, newStyle);
      onConfirmed();
    } catch {
      setError(t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const removed = preview?.removed_votes_count ?? 0;
  const users = preview?.affected_users ?? [];
  const visibleUsers = users.slice(0, MAX_NAMES);
  const extraUsers = Math.max(0, users.length - visibleUsers.length);
  const isSingleTarget = newStyle === "single";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View
        className="flex-1 items-center justify-center px-4"
        style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      >
        <View
          className="w-full bg-surface rounded-2xl p-5"
          style={{ maxWidth: 480 }}
        >
          <Text
            variant="label"
            style={{ fontSize: 17, fontWeight: "700", marginBottom: 16 }}
          >
            {t("proposals.voteStyleChange.title")}
          </Text>

          <View
            className="flex-row items-center mb-5"
            style={{ gap: 8 }}
          >
            <StylePill style={currentStyle} />
            <Ionicons
              name="arrow-forward"
              size={20}
              color={theme.primary}
            />
            <StylePill style={newStyle} />
          </View>

          {loading ? (
            <View className="py-6 items-center">
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : error && !preview ? (
            <Text variant="caption" style={{ color: "#991B1B" }}>
              {error}
            </Text>
          ) : preview ? (
            <>
              <View
                className="rounded-xl p-3 mb-4"
                style={{
                  backgroundColor: "#FEF2F2",
                  borderWidth: 1,
                  borderColor: "#FCA5A5",
                  gap: 10,
                }}
              >
                <View
                  className="flex-row items-center"
                  style={{ gap: 8 }}
                >
                  <Ionicons name="warning" size={16} color="#991B1B" />
                  <Text
                    variant="label"
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: "#991B1B",
                    }}
                  >
                    {t("proposals.voteStyleChange.impactTitle")}
                  </Text>
                </View>

                <Text
                  variant="caption"
                  style={{ color: "#991B1B", fontSize: 13 }}
                >
                  {t("proposals.voteStyleChange.removedVotes", {
                    count: removed,
                  })}
                </Text>

                {users.length > 0 ? (
                  <View style={{ gap: 6 }}>
                    <Text
                      variant="caption"
                      style={{ color: "#991B1B", fontSize: 12 }}
                    >
                      {t("proposals.voteStyleChange.affectedUsers", {
                        count: users.length,
                      })}
                    </Text>
                    <View
                      className="flex-row flex-wrap"
                      style={{ gap: 6 }}
                    >
                      {visibleUsers.map((u) => (
                        <View
                          key={u.id}
                          className="flex-row items-center rounded-full"
                          style={{
                            backgroundColor: "#FFFFFF",
                            paddingLeft: 2,
                            paddingRight: 8,
                            paddingVertical: 2,
                            gap: 6,
                            borderWidth: 1,
                            borderColor: "#FCA5A5",
                          }}
                        >
                          <Avatar
                            src={u.avatar_url ?? undefined}
                            initials={initialsOf(u.full_name)}
                            size="xs"
                          />
                          <Text
                            variant="caption"
                            style={{ fontSize: 12, color: "#991B1B" }}
                          >
                            {firstName(u.full_name)}
                          </Text>
                        </View>
                      ))}
                      {extraUsers > 0 ? (
                        <View
                          className="rounded-full px-2 items-center justify-center"
                          style={{
                            backgroundColor: "#FFFFFF",
                            borderWidth: 1,
                            borderColor: "#FCA5A5",
                            paddingVertical: 4,
                          }}
                        >
                          <Text
                            variant="caption"
                            style={{ fontSize: 12, color: "#991B1B" }}
                          >
                            {t("proposals.voteStyleChange.moreUsers", {
                              count: extraUsers,
                            })}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </View>

              {isSingleTarget &&
              preview.multi_for_user_ids.length > 0 ? (
                <View
                  className="rounded-xl p-3 mb-4 flex-row"
                  style={{
                    backgroundColor: theme.primarySoft,
                    gap: 8,
                  }}
                >
                  <Ionicons
                    name="information-circle"
                    size={16}
                    color={theme.primaryDeep}
                  />
                  <Text
                    variant="caption"
                    style={{
                      flex: 1,
                      fontSize: 12,
                      color: theme.primaryDeep,
                    }}
                  >
                    {t("proposals.voteStyleChange.singleResolutionHint")}
                  </Text>
                </View>
              ) : null}

              <Text
                variant="caption"
                style={{
                  fontSize: 12,
                  color: "#991B1B",
                  fontWeight: "600",
                  marginBottom: 16,
                }}
              >
                {t("proposals.voteStyleChange.warning")}
              </Text>
            </>
          ) : null}

          <View className="flex-row" style={{ gap: 8 }}>
            <Pressable
              onPress={onCancel}
              disabled={busy}
              className="flex-1 rounded-xl items-center justify-center"
              style={{
                paddingVertical: 12,
                backgroundColor: "#F3F4F6",
                opacity: busy ? 0.6 : 1,
              }}
            >
              <Text
                variant="label"
                style={{ fontWeight: "600", textAlign: "center" }}
              >
                {t("common.cancel")}
              </Text>
            </Pressable>
            <Pressable
              onPress={confirm}
              disabled={busy || loading || !!error}
              className="flex-1 rounded-xl items-center justify-center"
              style={{
                paddingVertical: 12,
                backgroundColor: "#DC2626",
                opacity: busy || loading || !!error ? 0.6 : 1,
              }}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  variant="label"
                  style={{
                    color: "#FFFFFF",
                    fontWeight: "700",
                    textAlign: "center",
                  }}
                >
                  {t("proposals.voteStyleChange.confirm")}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
