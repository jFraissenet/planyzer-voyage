import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Avatar, Text } from "@/components/ui";
import {
  listEventToolProposalVoters,
  type ProposalVoter,
  type VoteValue,
} from "@/lib/proposals";
import type { VoteStyle } from "@/lib/proposals/modes";
import { theme } from "@/lib/theme";

type Props = {
  visible: boolean;
  proposalId: string | null;
  voteStyle: VoteStyle;
  // Optional: when tri, pre-scroll/highlight a section (e.g. user tapped 👎 count).
  initialFocus?: VoteValue | null;
  onClose: () => void;
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

type SectionConfig = {
  value: VoteValue;
  labelKey: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
};

const TRI_SECTIONS: SectionConfig[] = [
  { value: "for", labelKey: "proposals.voters.for", icon: "thumbs-up", color: "#16A34A" },
  { value: "neutral", labelKey: "proposals.voters.neutral", icon: "remove-circle", color: "#6B6B6B" },
  { value: "against", labelKey: "proposals.voters.against", icon: "thumbs-down", color: "#DC2626" },
];

function VoterRow({ voter }: { voter: ProposalVoter }) {
  return (
    <View
      className="flex-row items-center py-2"
      style={{ gap: 10 }}
    >
      <Avatar
        src={voter.avatar_url ?? undefined}
        initials={initialsOf(voter.full_name)}
        size="xs"
      />
      <Text
        style={{ fontSize: 14, color: "#1A1A1A", flex: 1 }}
        numberOfLines={1}
      >
        {voter.full_name ?? "?"}
      </Text>
    </View>
  );
}

function Section({
  icon,
  color,
  label,
  voters,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  label: string;
  voters: ProposalVoter[];
}) {
  return (
    <View className="mb-4">
      <View
        className="flex-row items-center mb-2"
        style={{ gap: 8 }}
      >
        <View
          className="items-center justify-center rounded-full"
          style={{
            width: 22,
            height: 22,
            backgroundColor: color + "22",
          }}
        >
          <Ionicons name={icon} size={12} color={color} />
        </View>
        <Text
          style={{ color: "#1A1A1A", fontSize: 14, fontWeight: "700" }}
        >
          {label} ({voters.length})
        </Text>
      </View>
      {voters.length === 0 ? null : (
        <View
          className="rounded-xl px-3"
          style={{
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: "#E5E7EB",
          }}
        >
          {voters.map((v, idx) => (
            <View
              key={v.user_id}
              style={
                idx > 0
                  ? { borderTopWidth: 1, borderTopColor: "#F2EDE4" }
                  : undefined
              }
            >
              <VoterRow voter={v} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export function VotersModal({
  visible,
  proposalId,
  voteStyle,
  initialFocus,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [voters, setVoters] = useState<ProposalVoter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !proposalId) return;
    let cancelled = false;
    setVoters([]);
    setError(null);
    setLoading(true);
    listEventToolProposalVoters(proposalId)
      .then((list) => {
        if (!cancelled) setVoters(list);
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
  }, [visible, proposalId, t]);

  const grouped = useMemo(() => {
    const map: Record<VoteValue, ProposalVoter[]> = {
      for: [],
      neutral: [],
      against: [],
    };
    for (const v of voters) {
      map[v.vote_value].push(v);
    }
    return map;
  }, [voters]);

  const isTri = voteStyle === "tri";
  const totalCount = voters.length;
  const empty = !loading && totalCount === 0;

  // Order sections to surface the focused one first when caller specified a
  // bucket (e.g. user tapped on the 👎 count → put "against" first).
  const orderedSections = useMemo(() => {
    if (!initialFocus) return TRI_SECTIONS;
    const focused = TRI_SECTIONS.filter((s) => s.value === initialFocus);
    const rest = TRI_SECTIONS.filter((s) => s.value !== initialFocus);
    return [...focused, ...rest];
  }, [initialFocus]);

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
              {t("proposals.voters.title")}
              {totalCount > 0 ? `  (${totalCount})` : ""}
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
            ) : error ? (
              <Text variant="caption" style={{ color: "#991B1B" }}>
                {error}
              </Text>
            ) : empty ? (
              <View className="py-10 items-center">
                <Ionicons
                  name="people-outline"
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
                  {t("proposals.voters.empty")}
                </Text>
              </View>
            ) : isTri ? (
              orderedSections.map((s) => (
                <Section
                  key={s.value}
                  icon={s.icon}
                  color={s.color}
                  label={t(s.labelKey)}
                  voters={grouped[s.value]}
                />
              ))
            ) : (
              // check / single — only the 'for' bucket has voters.
              <Section
                icon="thumbs-up"
                color={theme.primary}
                label={t("proposals.voters.for")}
                voters={grouped.for}
              />
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
