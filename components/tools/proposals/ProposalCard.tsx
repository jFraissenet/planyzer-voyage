import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Avatar, Card, Text } from "@/components/ui";
import {
  addEventToolProposalComment,
  clearEventToolProposalVote,
  deleteEventToolProposalComment,
  listEventToolProposalComments,
  setEventToolProposalVote,
  type EventToolProposal,
  type EventToolProposalComment,
  type ProposalStatus,
  type VoteValue,
} from "@/lib/proposals";
import { formatCapacityRange, formatPriceRange } from "./formatters";
import { VoteChips } from "./VoteChips";

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
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  if (start) return fmt(start);
  return fmt(end!);
}

const STATUS_COLORS: Record<ProposalStatus, { bg: string; fg: string }> = {
  proposed: { bg: "#EEECFC", fg: "#4F3FD1" },
  validated: { bg: "#DCFCE7", fg: "#166534" },
  rejected: { bg: "#FEE2E2", fg: "#991B1B" },
};

function Chip({
  icon,
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
}) {
  return (
    <View
      className="flex-row items-center px-2 py-0.5 rounded-full"
      style={{ backgroundColor: "#F3F0FA", gap: 4 }}
    >
      <Ionicons name={icon} size={11} color="#6050DC" />
      <Text style={{ color: "#4F3FD1", fontSize: 11, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
  );
}

type Props = {
  proposal: EventToolProposal;
  locale: string;
  currentUserId: string;
  isToolAdmin: boolean;
  onOpen: () => void;
  onEdit: (() => void) | null;
  onChanged: () => void;
};

export function ProposalCard({
  proposal,
  locale,
  currentUserId,
  isToolAdmin,
  onOpen,
  onEdit,
  onChanged,
}: Props) {
  const { t } = useTranslation();
  const coverUrl = proposal.images[0]?.url ?? null;
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
  );
  const dateLabel = formatDateRange(
    proposal.date_start,
    proposal.date_end,
    locale,
  );

  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<EventToolProposalComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);

  const loadComments = useCallback(async () => {
    try {
      const list = await listEventToolProposalComments(proposal.proposal_id);
      setComments(list);
    } catch {
      setComments([]);
    } finally {
      setCommentsLoaded(true);
    }
  }, [proposal.proposal_id]);

  useEffect(() => {
    if (expanded && !commentsLoaded) {
      loadComments();
    }
  }, [expanded, commentsLoaded, loadComments]);

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

  return (
    <Card className="mb-3 overflow-hidden p-0">
      <Pressable onPress={onOpen} className="active:opacity-90">
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={{
              width: "100%",
              height: 160,
              backgroundColor: "#EEECFC",
            }}
            resizeMode="cover"
          />
        ) : null}
        <View className="p-4">
          <View
            className="flex-row items-start mb-1.5"
            style={{ gap: 6 }}
          >
            <Text
              numberOfLines={2}
              style={{
                flex: 1,
                fontSize: 16,
                fontWeight: "700",
                color: "#1A1A1A",
              }}
            >
              {proposal.title}
            </Text>
            <View
              className="px-2 py-0.5 rounded-full"
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
            {onEdit ? (
              <Pressable
                onPress={onEdit}
                hitSlop={8}
                accessibilityLabel={t("proposals.edit")}
                className="items-center justify-center rounded-full active:opacity-70"
                style={{
                  width: 26,
                  height: 26,
                  backgroundColor: "#EEECFC",
                }}
              >
                <Ionicons name="pencil" size={12} color="#6050DC" />
              </Pressable>
            ) : null}
          </View>

          {proposal.description ? (
            <Text
              variant="caption"
              numberOfLines={2}
              className="mb-2"
              style={{ color: "#6B6B6B" }}
            >
              {proposal.description}
            </Text>
          ) : null}

          {priceLabel || proposal.location || dateLabel || capacityLabel ? (
            <View className="flex-row flex-wrap mb-2" style={{ gap: 6 }}>
              {priceLabel ? <Chip icon="pricetag" label={priceLabel} /> : null}
              {proposal.location ? (
                <Chip icon="location" label={proposal.location} />
              ) : null}
              {dateLabel ? <Chip icon="calendar" label={dateLabel} /> : null}
              {capacityLabel ? (
                <Chip icon="people" label={capacityLabel} />
              ) : null}
            </View>
          ) : null}
        </View>
      </Pressable>

      <View
        className="px-4 pb-3"
        style={{
          borderTopWidth: 1,
          borderTopColor: "#F2EDE4",
          paddingTop: 10,
          gap: 10,
        }}
      >
        <View className="flex-row items-center justify-between" style={{ gap: 8 }}>
          <View className="flex-row items-center flex-1" style={{ gap: 6 }}>
            <Avatar
              src={proposal.author_avatar_url ?? undefined}
              initials={initialsOf(proposal.author_full_name)}
              size="xs"
            />
            <Text
              variant="caption"
              style={{ fontSize: 11 }}
              numberOfLines={1}
            >
              {firstName(proposal.author_full_name)}
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

        <Pressable
          onPress={() => setExpanded((v) => !v)}
          hitSlop={4}
          className="flex-row items-center justify-center py-1.5"
          style={{ gap: 5 }}
        >
          <Ionicons
            name={expanded ? "chevron-up" : "chatbubble-outline"}
            size={13}
            color="#6050DC"
          />
          <Text
            style={{
              color: "#6050DC",
              fontSize: 12,
              fontWeight: "600",
            }}
          >
            {expanded
              ? t("proposals.hideComments")
              : proposal.comments_count > 0
                ? t("proposals.showCommentsCount", {
                    count: proposal.comments_count,
                  })
                : t("proposals.addComment")}
          </Text>
        </Pressable>

        {expanded ? (
          <View style={{ gap: 10 }}>
            {comments.length === 0 ? (
              <Text
                variant="caption"
                style={{ fontSize: 12, textAlign: "center" }}
              >
                {t("proposals.commentsEmpty")}
              </Text>
            ) : (
              comments.map((c) => (
                <View
                  key={c.comment_id}
                  className="flex-row items-start"
                  style={{ gap: 8 }}
                >
                  <Avatar
                    src={c.author_avatar_url ?? undefined}
                    initials={initialsOf(c.author_full_name)}
                    size="xs"
                  />
                  <View
                    className="flex-1 rounded-xl px-3 py-2"
                    style={{ backgroundColor: "#F3F0FA" }}
                  >
                    <View className="flex-row items-center justify-between mb-0.5">
                      <Text
                        style={{
                          fontSize: 11,
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
                          <Ionicons name="close" size={12} color="#A3A3A3" />
                        </Pressable>
                      ) : null}
                    </View>
                    <Text
                      style={{
                        fontSize: 13,
                        color: "#1A1A1A",
                        lineHeight: 18,
                      }}
                    >
                      {c.text}
                    </Text>
                  </View>
                </View>
              ))
            )}

            <View
              className="flex-row items-center rounded-2xl px-3 py-1"
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
                  fontSize: 13,
                  color: "#1A1A1A",
                  paddingVertical: 6,
                  paddingHorizontal: 4,
                }}
              />
              <Pressable
                onPress={submitComment}
                disabled={!commentText.trim() || commentBusy}
                hitSlop={6}
                className="items-center justify-center"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: commentText.trim() ? "#6050DC" : "#E8E3DB",
                  opacity: commentBusy ? 0.5 : 1,
                }}
              >
                <Ionicons name="arrow-up" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
