import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Avatar, Text } from "@/components/ui";
import {
  addEventToolProposalComment,
  clearEventToolProposalVote,
  deleteEventToolProposal,
  deleteEventToolProposalComment,
  listEventToolProposalComments,
  setEventToolProposalStatus,
  setEventToolProposalVote,
  type EventToolProposal,
  type EventToolProposalComment,
  type ProposalStatus,
  type VoteValue,
} from "@/lib/proposals";
import { formatCapacityRange, formatPriceRange } from "./formatters";
import { VoteChips } from "./VoteChips";

type Props = {
  visible: boolean;
  proposal: EventToolProposal | null;
  currentUserId: string;
  isToolAdmin: boolean;
  isManager: boolean;
  locale: string;
  onClose: () => void;
  onEdit: () => void;
  onChanged: () => void;
};

const STATUS_COLORS: Record<ProposalStatus, { bg: string; fg: string }> = {
  proposed: { bg: "#EEECFC", fg: "#4F3FD1" },
  validated: { bg: "#DCFCE7", fg: "#166534" },
  rejected: { bg: "#FEE2E2", fg: "#991B1B" },
};

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

function firstName(full: string | null): string {
  if (!full) return "?";
  return full.trim().split(/\s+/)[0];
}

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function InfoRow({
  icon,
  children,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  children: React.ReactNode;
  onPress?: () => void;
}) {
  const inner = (
    <View className="flex-row items-center" style={{ gap: 8 }}>
      <Ionicons name={icon} size={16} color="#6050DC" />
      <View className="flex-1">{children}</View>
      {onPress ? (
        <Ionicons name="open-outline" size={14} color="#A3A3A3" />
      ) : null}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} className="py-2 active:opacity-70">
        {inner}
      </Pressable>
    );
  }
  return <View className="py-2">{inner}</View>;
}

export function ProposalDetailModal({
  visible,
  proposal,
  currentUserId,
  isToolAdmin,
  isManager,
  locale,
  onClose,
  onEdit,
  onChanged,
}: Props) {
  const { t } = useTranslation();
  const [comments, setComments] = useState<EventToolProposalComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [imageIdx, setImageIdx] = useState(0);

  const width = Dimensions.get("window").width;
  const carouselWidth = Math.min(width - 32, 600);

  const loadComments = useCallback(async () => {
    if (!proposal) return;
    try {
      const list = await listEventToolProposalComments(proposal.proposal_id);
      setComments(list);
    } catch {
      setComments([]);
    }
  }, [proposal]);

  useEffect(() => {
    if (!visible) return;
    setImageIdx(0);
    setCommentText("");
    loadComments();
  }, [visible, loadComments]);

  const dateLabel = useMemo(() => {
    if (!proposal) return null;
    if (!proposal.date_start && !proposal.date_end) return null;
    if (proposal.date_start && proposal.date_end) {
      return `${formatDate(proposal.date_start, locale)} → ${formatDate(
        proposal.date_end,
        locale,
      )}`;
    }
    return formatDate(
      (proposal.date_start ?? proposal.date_end) as string,
      locale,
    );
  }, [proposal, locale]);

  if (!proposal) return null;

  const canEdit =
    proposal.author_id === currentUserId || isToolAdmin || isManager;
  const canDelete = proposal.author_id === currentUserId || isToolAdmin;

  const vote = async (value: VoteValue) => {
    try {
      if (proposal.my_vote === value) {
        await clearEventToolProposalVote(proposal.proposal_id);
      } else {
        await setEventToolProposalVote(proposal.proposal_id, value);
      }
      onChanged();
    } catch {
      // ignore
    }
  };

  const changeStatus = async (status: ProposalStatus) => {
    try {
      await setEventToolProposalStatus(proposal.proposal_id, status);
      onChanged();
    } catch {
      // ignore
    }
  };

  const openUrl = (url: string | null) => {
    if (!url) return;
    Linking.openURL(url).catch(() => undefined);
  };

  const confirmDelete = () => {
    const msg = t("proposals.deleteConfirm");
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (window.confirm(msg)) void runDelete();
      return;
    }
    Alert.alert(msg, undefined, [
      { text: t("proposals.cancel"), style: "cancel" },
      {
        text: t("proposals.delete"),
        style: "destructive",
        onPress: () => runDelete(),
      },
    ]);
  };

  const runDelete = async () => {
    try {
      await deleteEventToolProposal(proposal.proposal_id);
      onClose();
      onChanged();
    } catch {
      // ignore
    }
  };

  const submitComment = async () => {
    const text = commentText.trim();
    if (!text || commentBusy) return;
    setCommentBusy(true);
    try {
      await addEventToolProposalComment(proposal.proposal_id, text);
      setCommentText("");
      await loadComments();
      onChanged();
    } finally {
      setCommentBusy(false);
    }
  };

  const deleteComment = async (c: EventToolProposalComment) => {
    try {
      await deleteEventToolProposalComment(c.comment_id);
      await loadComments();
      onChanged();
    } catch {
      // ignore
    }
  };

  const statusColors = STATUS_COLORS[proposal.status];
  const priceLabel = formatPriceRange(
    proposal.price_min,
    proposal.price_max,
    locale,
  );
  const capacityLabel = formatCapacityRange(
    proposal.capacity_min,
    proposal.capacity_max,
    (k, opts) => t(k, opts),
    "proposals.capacityFull",
    "proposals.capacityFullUpTo",
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/40 items-center justify-center px-4"
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full max-w-2xl bg-background rounded-2xl overflow-hidden"
          style={{ maxHeight: "92%" }}
        >
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            {proposal.images.length > 0 ? (
              <View>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) => {
                    const i = Math.round(
                      e.nativeEvent.contentOffset.x / carouselWidth,
                    );
                    setImageIdx(i);
                  }}
                >
                  {proposal.images.map((img) => (
                    <Image
                      key={img.id}
                      source={{ uri: img.url }}
                      style={{
                        width: carouselWidth,
                        height: 220,
                        backgroundColor: "#EEECFC",
                      }}
                      resizeMode="cover"
                    />
                  ))}
                </ScrollView>
                {proposal.images.length > 1 ? (
                  <View
                    className="flex-row absolute bottom-2 left-0 right-0 justify-center"
                    style={{ gap: 4 }}
                  >
                    {proposal.images.map((img, i) => (
                      <View
                        key={img.id}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor:
                            i === imageIdx ? "#FFFFFF" : "rgba(255,255,255,0.5)",
                        }}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            <View className="p-5">
              <View
                className="flex-row items-start justify-between mb-2"
                style={{ gap: 8 }}
              >
                <Text
                  className="flex-1"
                  style={{
                    fontSize: 20,
                    fontWeight: "700",
                    color: "#1A1A1A",
                  }}
                >
                  {proposal.title}
                </Text>
                <View
                  className="px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: statusColors.bg }}
                >
                  <Text
                    style={{
                      color: statusColors.fg,
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    {t(`proposals.status.${proposal.status}`)}
                  </Text>
                </View>
              </View>

              <View
                className="flex-row items-center justify-between mb-4"
                style={{ gap: 8 }}
              >
                <View className="flex-row items-center flex-1" style={{ gap: 6 }}>
                  <Avatar
                    src={proposal.author_avatar_url ?? undefined}
                    initials={initialsOf(proposal.author_full_name)}
                    size="xs"
                  />
                  <Text variant="caption" style={{ fontSize: 12 }}>
                    {t("proposals.proposedBy", {
                      name: firstName(proposal.author_full_name),
                    })}
                  </Text>
                </View>
                <VoteChips
                  counts={{
                    for: proposal.votes_for,
                    neutral: proposal.votes_neutral,
                    against: proposal.votes_against,
                  }}
                  myVote={proposal.my_vote}
                  onVote={vote}
                  size="sm"
                />
              </View>

              {proposal.description ? (
                <Text
                  className="mb-3"
                  style={{ color: "#3A3A3A", fontSize: 14, lineHeight: 20 }}
                >
                  {proposal.description}
                </Text>
              ) : null}

              {priceLabel || proposal.location || dateLabel || capacityLabel ? (
                <View
                  className="rounded-xl px-3 mb-3"
                  style={{
                    borderWidth: 1,
                    borderColor: "#E8E3DB",
                    backgroundColor: "#FFFFFF",
                  }}
                >
                  {priceLabel ? (
                    <InfoRow icon="pricetag">
                      <Text style={{ fontSize: 14, color: "#1A1A1A" }}>
                        {priceLabel}
                      </Text>
                    </InfoRow>
                  ) : null}
                  {proposal.location ? (
                    <InfoRow
                      icon="location"
                      onPress={
                        proposal.location_url
                          ? () => openUrl(proposal.location_url)
                          : undefined
                      }
                    >
                      <Text style={{ fontSize: 14, color: "#1A1A1A" }}>
                        {proposal.location}
                      </Text>
                    </InfoRow>
                  ) : null}
                  {dateLabel ? (
                    <InfoRow icon="calendar">
                      <Text style={{ fontSize: 14, color: "#1A1A1A" }}>
                        {dateLabel}
                      </Text>
                    </InfoRow>
                  ) : null}
                  {capacityLabel ? (
                    <InfoRow icon="people">
                      <Text style={{ fontSize: 14, color: "#1A1A1A" }}>
                        {capacityLabel}
                      </Text>
                    </InfoRow>
                  ) : null}
                </View>
              ) : null}

              {proposal.links.length > 0 ? (
                <View className="mb-4">
                  <Text
                    variant="caption"
                    className="mb-2"
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: "#6050DC",
                      letterSpacing: 1,
                    }}
                  >
                    {t("proposals.linksSection").toUpperCase()}
                  </Text>
                  {proposal.links.map((l) => (
                    <Pressable
                      key={l.id}
                      onPress={() => openUrl(l.url)}
                      className="flex-row items-center py-2 active:opacity-70"
                      style={{ gap: 8 }}
                    >
                      <Ionicons name="link" size={14} color="#6050DC" />
                      <Text
                        className="flex-1"
                        numberOfLines={1}
                        style={{
                          color: "#6050DC",
                          fontSize: 14,
                          fontWeight: "600",
                        }}
                      >
                        {l.label || l.url}
                      </Text>
                      <Ionicons name="open-outline" size={14} color="#A3A3A3" />
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {isManager ? (
                <View className="mb-4">
                  <Text
                    variant="caption"
                    className="mb-2"
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: "#6050DC",
                      letterSpacing: 1,
                    }}
                  >
                    {t("proposals.changeStatus").toUpperCase()}
                  </Text>
                  <View className="flex-row" style={{ gap: 6 }}>
                    {(["proposed", "validated", "rejected"] as ProposalStatus[]).map(
                      (s) => {
                        const active = proposal.status === s;
                        const c = STATUS_COLORS[s];
                        return (
                          <Pressable
                            key={s}
                            onPress={() => changeStatus(s)}
                            className="flex-1 items-center justify-center py-2 rounded-lg"
                            style={{
                              backgroundColor: active ? c.fg : "#FFFFFF",
                              borderWidth: 1,
                              borderColor: active ? c.fg : "#E8E3DB",
                            }}
                          >
                            <Text
                              style={{
                                color: active ? "#FFFFFF" : c.fg,
                                fontSize: 12,
                                fontWeight: "700",
                              }}
                            >
                              {t(`proposals.status.${s}`)}
                            </Text>
                          </Pressable>
                        );
                      },
                    )}
                  </View>
                </View>
              ) : null}

              {canEdit || canDelete ? (
                <View className="flex-row mb-4" style={{ gap: 8 }}>
                  {canEdit ? (
                    <Pressable
                      onPress={onEdit}
                      className="flex-1 items-center justify-center py-2.5 rounded-lg"
                      style={{ backgroundColor: "#EEECFC" }}
                    >
                      <Text
                        style={{
                          color: "#6050DC",
                          fontWeight: "700",
                          fontSize: 13,
                        }}
                      >
                        {t("proposals.edit")}
                      </Text>
                    </Pressable>
                  ) : null}
                  {canDelete ? (
                    <Pressable
                      onPress={confirmDelete}
                      className="flex-1 items-center justify-center py-2.5 rounded-lg"
                      style={{ backgroundColor: "#FEE2E2" }}
                    >
                      <Text
                        style={{
                          color: "#991B1B",
                          fontWeight: "700",
                          fontSize: 13,
                        }}
                      >
                        {t("proposals.delete")}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <View
                style={{
                  height: 1,
                  backgroundColor: "#F2EDE4",
                  marginVertical: 8,
                }}
              />

              <Text
                variant="caption"
                className="mb-2"
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: "#6050DC",
                  letterSpacing: 1,
                }}
              >
                {t("proposals.commentsSection", { count: comments.length })}
              </Text>

              {comments.length === 0 ? (
                <Text variant="caption" className="mb-3">
                  {t("proposals.commentsEmpty")}
                </Text>
              ) : (
                comments.map((c) => (
                  <View
                    key={c.comment_id}
                    className="flex-row items-start mb-3"
                    style={{ gap: 8 }}
                  >
                    <Avatar
                      src={c.author_avatar_url ?? undefined}
                      initials={initialsOf(c.author_full_name)}
                      size="sm"
                    />
                    <View
                      className="flex-1 rounded-xl px-3 py-2"
                      style={{ backgroundColor: "#F3F0FA" }}
                    >
                      <View className="flex-row items-center justify-between mb-0.5">
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color: "#4F3FD1",
                          }}
                        >
                          {firstName(c.author_full_name)}
                        </Text>
                        {c.author_id === currentUserId || isToolAdmin ? (
                          <Pressable
                            onPress={() => deleteComment(c)}
                            hitSlop={6}
                          >
                            <Ionicons name="close" size={14} color="#A3A3A3" />
                          </Pressable>
                        ) : null}
                      </View>
                      <Text
                        style={{
                          fontSize: 14,
                          color: "#1A1A1A",
                          lineHeight: 19,
                        }}
                      >
                        {c.text}
                      </Text>
                    </View>
                  </View>
                ))
              )}

              <View
                className="flex-row items-center rounded-2xl px-3 py-1.5 mt-1"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderWidth: 1,
                  borderColor: "#E8E3DB",
                }}
              >
                <TextInput
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder={t("proposals.commentPlaceholder")}
                  placeholderTextColor="#A3A3A3"
                  onSubmitEditing={submitComment}
                  returnKeyType="send"
                  style={{
                    flex: 1,
                    fontSize: 14,
                    color: "#1A1A1A",
                    paddingVertical: 8,
                    paddingHorizontal: 4,
                  }}
                />
                <Pressable
                  onPress={submitComment}
                  disabled={!commentText.trim() || commentBusy}
                  hitSlop={6}
                  className="items-center justify-center"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: commentText.trim() ? "#6050DC" : "#E8E3DB",
                    opacity: commentBusy ? 0.5 : 1,
                  }}
                >
                  <Ionicons name="arrow-up" size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
          </ScrollView>

          <View style={{ position: "absolute", top: 8, right: 8 }}>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              className="items-center justify-center rounded-full"
              style={{
                width: 32,
                height: 32,
                backgroundColor: "rgba(0,0,0,0.4)",
              }}
            >
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
