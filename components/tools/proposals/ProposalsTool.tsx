import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Button, DateTimeInput, FAB, Text } from "@/components/ui";
import {
  applyVoteStyleChange,
  clearEventToolProposalVote,
  isEventToolManager,
  listEventToolAudit,
  listEventToolProposals,
  readProposalsToolSettings,
  setEventToolProposalVote,
  updateProposalsToolSettings,
  type EventToolAuditEntry,
  type EventToolProposal,
  type VoteValue,
} from "@/lib/proposals";
import {
  getMode,
  resolveOrderBy,
  resolveVoteStyle,
  type ProposalMode,
  type ProposalOrderBy,
  type VoteStyle,
} from "@/lib/proposals/modes";
import { useSession } from "@/lib/useSession";
import { isoToLocalInput, localInputToIso } from "./dateHelpers";
import { AuditHistoryModal } from "./AuditHistoryModal";
import { ConfirmVoteStyleChangeModal } from "./ConfirmVoteStyleChangeModal";
import { DateProposalEditModal } from "./DateProposalEditModal";
import { ProposalCard } from "./ProposalCard";
import { ProposalDetailModal } from "./ProposalDetailModal";
import { ProposalEditModal } from "./ProposalEditModal";
import { ProposalsTypePicker } from "./ProposalsTypePicker";
import { VotersModal } from "./VotersModal";
import { ToolShell, type ToolProps } from "../ToolShell";
import { theme } from "@/lib/theme";

function sortProposals(
  list: EventToolProposal[],
  order: ProposalOrderBy,
): EventToolProposal[] {
  const arr = [...list];
  const created = (p: EventToolProposal) =>
    new Date(p.created_at).getTime();
  switch (order) {
    case "votes":
      return arr.sort((a, b) => {
        const diff = b.votes_for - b.votes_against - (a.votes_for - a.votes_against);
        return diff !== 0 ? diff : created(a) - created(b);
      });
    case "date_asc":
      return arr.sort((a, b) => {
        const da = a.date_start ? new Date(a.date_start).getTime() : Infinity;
        const db = b.date_start ? new Date(b.date_start).getTime() : Infinity;
        return da !== db ? da - db : created(a) - created(b);
      });
    case "date_desc":
      return arr.sort((a, b) => {
        const da = a.date_start ? new Date(a.date_start).getTime() : -Infinity;
        const db = b.date_start ? new Date(b.date_start).getTime() : -Infinity;
        return db !== da ? db - da : created(a) - created(b);
      });
    case "created_asc":
      return arr.sort((a, b) => created(a) - created(b));
  }
}

export function ProposalsTool(props: ToolProps) {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const currentUserId = session?.user?.id ?? "";

  const [proposals, setProposals] = useState<EventToolProposal[]>([]);
  const [isManager, setIsManager] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EventToolProposal | null>(null);
  const [openDetail, setOpenDetail] = useState<EventToolProposal | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingVoteStyle, setPendingVoteStyle] = useState<VoteStyle | null>(
    null,
  );
  const [impactBanner, setImpactBanner] = useState<EventToolAuditEntry | null>(
    null,
  );
  const [votersFor, setVotersFor] = useState<{
    proposalId: string;
    focus: VoteValue | null;
  } | null>(null);

  const propSettings = useMemo(
    () => readProposalsToolSettings(props.tool.event_tool_settings),
    [props.tool.event_tool_settings],
  );
  const [deadlineLocal, setDeadlineLocal] = useState<string | null>(
    propSettings.vote_deadline,
  );
  const [lockedLocal, setLockedLocal] = useState<boolean>(
    propSettings.proposals_locked,
  );
  const [modeLocal, setModeLocal] = useState<ProposalMode | null>(
    propSettings.mode,
  );
  const [voteStyleLocal, setVoteStyleLocal] = useState<VoteStyle | null>(
    propSettings.vote_style,
  );
  const [orderByLocal, setOrderByLocal] = useState<ProposalOrderBy | null>(
    propSettings.order_by,
  );

  useEffect(() => {
    setDeadlineLocal(propSettings.vote_deadline);
    setLockedLocal(propSettings.proposals_locked);
    setModeLocal(propSettings.mode);
    setVoteStyleLocal(propSettings.vote_style);
    setOrderByLocal(propSettings.order_by);
  }, [
    propSettings.vote_deadline,
    propSettings.proposals_locked,
    propSettings.mode,
    propSettings.vote_style,
    propSettings.order_by,
  ]);

  const load = useCallback(async () => {
    try {
      const list = await listEventToolProposals(props.tool.event_tool_id);
      setProposals(list);
    } catch {
      setProposals([]);
    }
  }, [props.tool.event_tool_id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    isEventToolManager(props.tool.event_tool_id)
      .then(setIsManager)
      .catch(() => setIsManager(false));
  }, [props.tool.event_tool_id]);

  useEffect(() => {
    if (!openDetail) return;
    const fresh = proposals.find(
      (p) => p.proposal_id === openDetail.proposal_id,
    );
    if (fresh && fresh !== openDetail) setOpenDetail(fresh);
  }, [proposals, openDetail]);

  // Surface a banner to users whose votes were retroactively removed by the
  // most recent vote-style change. Dismissal is persisted per change_id so
  // it reappears if a fresh change happens.
  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    (async () => {
      try {
        const page = await listEventToolAudit(props.tool.event_tool_id, 1, 0);
        const last = page[0];
        if (
          !last ||
          last.change_type !== "vote_style_change" ||
          !last.affected_user_ids.includes(currentUserId)
        ) {
          if (!cancelled) setImpactBanner(null);
          return;
        }
        const dismissed = await AsyncStorage.getItem(
          `planyzer:dismissed_audit_${last.audit_id}`,
        );
        if (cancelled) return;
        setImpactBanner(dismissed ? null : last);
      } catch {
        if (!cancelled) setImpactBanner(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.tool.event_tool_id, currentUserId, proposals]);

  const dismissImpactBanner = async () => {
    const id = impactBanner?.audit_id;
    setImpactBanner(null);
    if (!id) return;
    try {
      await AsyncStorage.setItem(`planyzer:dismissed_audit_${id}`, "1");
    } catch {
      // ignore — worst case the banner reappears on next mount
    }
  };

  const deadlinePassed = useMemo(() => {
    if (!deadlineLocal) return false;
    const t = new Date(deadlineLocal).getTime();
    return Number.isFinite(t) && t < Date.now();
  }, [deadlineLocal]);
  const isClosed = lockedLocal || deadlinePassed;
  const canCreate = !isClosed;

  const deadlineDisplay = useMemo(() => {
    if (!deadlineLocal) return null;
    try {
      return new Date(deadlineLocal).toLocaleString(i18n.language, {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return deadlineLocal;
    }
  }, [deadlineLocal, i18n.language]);

  const persist = async (next: {
    vote_deadline: string | null;
    proposals_locked: boolean;
    mode: ProposalMode | null;
    order_by: ProposalOrderBy | null;
  }) => {
    try {
      await updateProposalsToolSettings(
        props.tool.event_tool_id,
        props.tool.event_tool_settings,
        next,
      );
    } catch {
      // ignore — local state will re-sync if props refresh
    }
  };

  const baseSettings = () => ({
    vote_deadline: deadlineLocal,
    proposals_locked: lockedLocal,
    mode: modeLocal,
    order_by: orderByLocal,
  });

  const changeDeadline = (local: string) => {
    const iso = localInputToIso(local);
    setDeadlineLocal(iso);
    void persist({ ...baseSettings(), vote_deadline: iso });
  };

  const toggleLocked = () => {
    const next = !lockedLocal;
    setLockedLocal(next);
    void persist({ ...baseSettings(), proposals_locked: next });
  };

  const pickMode = (mode: ProposalMode) => {
    setModeLocal(mode);
    void persist({ ...baseSettings(), mode });
    // Open the create modal directly so the flow is "tap question → fill in".
    setCreating(true);
  };

  // Destructive transitions delete orphan votes (against/neutral) or collapse
  // multi-`for` to a single pick — the user must see the impact before
  // committing. Free transitions (check→tri, single→tri, single→check) just
  // relax the UI; we still write an audit row so history stays complete.
  const isDestructiveStyleChange = (
    from: VoteStyle,
    to: VoteStyle,
  ): boolean =>
    (from === "tri" && (to === "check" || to === "single")) ||
    (from === "check" && to === "single");

  const changeVoteStyle = async (next: VoteStyle) => {
    if (next === activeVoteStyle) return;
    if (isDestructiveStyleChange(activeVoteStyle, next)) {
      setPendingVoteStyle(next);
      return;
    }
    setVoteStyleLocal(next);
    try {
      await applyVoteStyleChange(props.tool.event_tool_id, next);
      await load();
    } catch {
      // ignore — local state will re-sync if props refresh
    }
  };

  const onVoteStyleChangeConfirmed = async () => {
    const next = pendingVoteStyle;
    setPendingVoteStyle(null);
    if (!next) return;
    setVoteStyleLocal(next);
    await load();
  };

  const changeOrderBy = (next: ProposalOrderBy) => {
    setOrderByLocal(next);
    void persist({ ...baseSettings(), order_by: next });
  };

  const activeMode = getMode(modeLocal);
  const activeVoteStyle = resolveVoteStyle(modeLocal, voteStyleLocal);
  const activeOrderBy = resolveOrderBy(modeLocal, orderByLocal);
  const sortedProposals = useMemo(
    () => sortProposals(proposals, activeOrderBy),
    [proposals, activeOrderBy],
  );

  // Vote handlers — lifted up from ProposalCard so we can manage cross-
  // proposal exclusivity for the 'single' style.
  const setVote = useCallback(
    async (proposalId: string, value: VoteValue) => {
      try {
        if (activeVoteStyle === "single" && value === "for") {
          // Clear any other 'for' vote the user has on the same tool —
          // single-choice means at most one global pick.
          const others = proposals.filter(
            (p) => p.proposal_id !== proposalId && p.my_vote === "for",
          );
          for (const p of others) {
            await clearEventToolProposalVote(p.proposal_id);
          }
        }
        await setEventToolProposalVote(proposalId, value);
        await load();
      } catch {
        // ignore
      }
    },
    [activeVoteStyle, proposals, load],
  );

  const clearVote = useCallback(
    async (proposalId: string) => {
      try {
        await clearEventToolProposalVote(proposalId);
        await load();
      } catch {
        // ignore
      }
    },
    [load],
  );
  // The mode is only an "intent" until at least one proposal exists. As long
  // as the list is empty we keep showing the picker so the user can switch
  // their pick (e.g. after a back-out from the create modal).
  const showTypePicker = proposals.length === 0;

  const headerActions = !showTypePicker ? (
    <View className="flex-row items-center" style={{ gap: 6 }}>
      <Pressable
        onPress={() => setHistoryOpen(true)}
        accessibilityLabel={t("proposals.history.openButton")}
        className="items-center justify-center rounded-full active:opacity-70"
        style={{
          width: 28,
          height: 28,
          backgroundColor: theme.primarySoft,
        }}
      >
        <Ionicons name="time-outline" size={16} color={theme.primary} />
      </Pressable>
      {isManager ? (
        <Pressable
          onPress={() => setSettingsOpen(true)}
          accessibilityLabel={t("proposals.settingsAction")}
          className="items-center justify-center rounded-full active:opacity-70"
          style={{
            width: 28,
            height: 28,
            backgroundColor: theme.primarySoft,
          }}
        >
          <Ionicons name="settings-outline" size={16} color={theme.primary} />
        </Pressable>
      ) : null}
    </View>
  ) : null;

  return (
    <>
      <ToolShell {...props} headerActions={headerActions}>
        {isClosed && proposals.length > 0 ? (
          <View
            className="flex-row items-center rounded-xl px-3 py-2 mb-4"
            style={{
              backgroundColor: "#FEE2E2",
              borderWidth: 1,
              borderColor: "#FCA5A5",
              gap: 8,
            }}
          >
            <Ionicons name="lock-closed" size={14} color="#991B1B" />
            <View className="flex-1">
              <Text
                style={{
                  color: "#991B1B",
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {t("proposals.closed")}
                {deadlineDisplay && deadlinePassed
                  ? ` · ${deadlineDisplay}`
                  : ""}
              </Text>
            </View>
          </View>
        ) : null}

        {impactBanner && !showTypePicker ? (
          <View
            className="flex-row items-start rounded-xl px-3 py-2 mb-4"
            style={{
              backgroundColor: theme.primarySoft,
              borderWidth: 1,
              borderColor: theme.primary,
              gap: 8,
            }}
          >
            <Ionicons
              name="information-circle"
              size={16}
              color={theme.primaryDeep}
              style={{ marginTop: 2 }}
            />
            <View className="flex-1">
              <Text
                style={{
                  color: theme.primaryDeep,
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                {t("proposals.affectedBanner.message")}
              </Text>
            </View>
            <Pressable
              onPress={dismissImpactBanner}
              accessibilityLabel={t("proposals.affectedBanner.dismiss")}
              className="rounded-full items-center justify-center active:opacity-70"
              style={{
                width: 22,
                height: 22,
                backgroundColor: "#FFFFFF",
              }}
            >
              <Ionicons name="close" size={12} color={theme.primaryDeep} />
            </Pressable>
          </View>
        ) : null}

        {showTypePicker ? (
          <ProposalsTypePicker onPick={pickMode} />
        ) : proposals.length === 0 ? (
          <View className="py-10 items-center">
            <Text variant="caption" className="text-center">
              {t(activeMode.emptyHint)}
            </Text>
          </View>
        ) : (
          sortedProposals.map((p) => {
            const canEditThis =
              p.author_id === currentUserId ||
              props.isToolAdmin ||
              isManager;
            return (
              <ProposalCard
                key={p.proposal_id}
                proposal={p}
                locale={i18n.language}
                currentUserId={currentUserId}
                isToolAdmin={props.isToolAdmin || isManager}
                isClosed={isClosed}
                voteStyle={activeVoteStyle}
                onSetVote={setVote}
                onClearVote={clearVote}
                onShowVoters={(proposalId, focus) =>
                  setVotersFor({ proposalId, focus })
                }
                onOpen={() => setOpenDetail(p)}
                onEdit={canEditThis ? () => setEditing(p) : null}
                onChanged={load}
              />
            );
          })
        )}
      </ToolShell>

      {canCreate && !showTypePicker ? (
        <FAB
          icon="add"
          onPress={() => setCreating(true)}
          accessibilityLabel={t("proposals.add")}
        />
      ) : null}

      {activeMode.id === "date" ? (
        <DateProposalEditModal
          visible={creating}
          toolId={props.tool.event_tool_id}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            load();
          }}
        />
      ) : (
        <ProposalEditModal
          mode="create"
          proposalMode={activeMode.id}
          visible={creating}
          toolId={props.tool.event_tool_id}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            load();
          }}
        />
      )}

      {editing ? (
        activeMode.id === "date" ? (
          <DateProposalEditModal
            visible
            toolId={props.tool.event_tool_id}
            existing={editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              load();
            }}
          />
        ) : (
          <ProposalEditModal
            mode="edit"
            proposalMode={activeMode.id}
            visible
            toolId={props.tool.event_tool_id}
            existing={editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              load();
            }}
          />
        )
      ) : null}

      <ProposalDetailModal
        visible={!!openDetail}
        proposal={openDetail}
        currentUserId={currentUserId}
        isToolAdmin={props.isToolAdmin}
        isManager={isManager}
        isClosed={isClosed}
        voteStyle={activeVoteStyle}
        onSetVote={setVote}
        onClearVote={clearVote}
        onShowVoters={(proposalId, focus) =>
          setVotersFor({ proposalId, focus })
        }
        locale={i18n.language}
        onClose={() => setOpenDetail(null)}
        onEdit={() => {
          if (openDetail) {
            setEditing(openDetail);
            setOpenDetail(null);
          }
        }}
        onChanged={load}
      />

      <VotersModal
        visible={votersFor !== null}
        proposalId={votersFor?.proposalId ?? null}
        voteStyle={activeVoteStyle}
        initialFocus={votersFor?.focus ?? null}
        onClose={() => setVotersFor(null)}
      />

      <Modal
        visible={settingsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/40 items-center justify-center px-4"
          onPress={() => setSettingsOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-background rounded-2xl p-5"
            style={{ maxHeight: "90%" }}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text variant="h2" className="mb-4">
                {t("proposals.settingsTitle")}
              </Text>

              <View className="mb-4">
                <DateTimeInput
                  label={t("proposals.deadlineLabel")}
                  placeholder={t("proposals.datePlaceholder")}
                  value={isoToLocalInput(deadlineLocal)}
                  onChange={changeDeadline}
                />
                <Text variant="caption" className="mt-1" style={{ fontSize: 11 }}>
                  {t("proposals.deadlineHint")}
                </Text>
              </View>

              <Pressable
                onPress={toggleLocked}
                className="flex-row items-center justify-between mb-5"
                style={{ gap: 10 }}
              >
                <View
                  className="flex-row items-center flex-1"
                  style={{ gap: 10 }}
                >
                  <Ionicons
                    name={lockedLocal ? "lock-closed" : "lock-open"}
                    size={18}
                    color={lockedLocal ? "#78350F" : theme.primary}
                  />
                  <View className="flex-1">
                    <Text
                      style={{
                        color: "#1A1A1A",
                        fontSize: 14,
                        fontWeight: "700",
                      }}
                    >
                      {t("proposals.lockedLabel")}
                    </Text>
                    <Text variant="caption" style={{ fontSize: 11 }}>
                      {t("proposals.lockedHint")}
                    </Text>
                  </View>
                </View>
                <View
                  className="items-center justify-center rounded-full"
                  style={{
                    width: 44,
                    height: 26,
                    backgroundColor: lockedLocal ? theme.primary : "#E8E3DB",
                    padding: 3,
                    flexDirection: "row",
                    justifyContent: lockedLocal ? "flex-end" : "flex-start",
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: "#FFFFFF",
                    }}
                  />
                </View>
              </Pressable>

              <Text
                variant="label"
                className="mb-2"
                style={{ fontSize: 13, fontWeight: "700" }}
              >
                {t("proposals.voteStyle.label")}
              </Text>
              <View className="gap-2 mb-5">
                {(["tri", "check", "single"] as const).map((style) => {
                  const selected = activeVoteStyle === style;
                  return (
                    <Pressable
                      key={style}
                      onPress={() => changeVoteStyle(style)}
                      className={`p-3 rounded-lg border ${
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-surface"
                      }`}
                    >
                      <Text variant="label">
                        {t(`proposals.voteStyle.${style}`)}
                      </Text>
                      <Text variant="caption" className="mt-1">
                        {t(`proposals.voteStyle.${style}Hint`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text
                variant="label"
                className="mb-2"
                style={{ fontSize: 13, fontWeight: "700" }}
              >
                {t("proposals.orderBy.label")}
              </Text>
              <View className="gap-2 mb-5">
                {(
                  ["votes", "date_asc", "date_desc", "created_asc"] as const
                ).map((order) => {
                  const selected = activeOrderBy === order;
                  return (
                    <Pressable
                      key={order}
                      onPress={() => changeOrderBy(order)}
                      className={`p-3 rounded-lg border ${
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-surface"
                      }`}
                    >
                      <Text variant="label">
                        {t(`proposals.orderBy.${order}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Button
                variant="ghost"
                label={t("common.close")}
                onPress={() => setSettingsOpen(false)}
              />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmVoteStyleChangeModal
        visible={pendingVoteStyle !== null}
        toolId={props.tool.event_tool_id}
        currentStyle={activeVoteStyle}
        newStyle={pendingVoteStyle ?? "tri"}
        onCancel={() => setPendingVoteStyle(null)}
        onConfirmed={onVoteStyleChangeConfirmed}
      />

      <AuditHistoryModal
        visible={historyOpen}
        toolId={props.tool.event_tool_id}
        onClose={() => setHistoryOpen(false)}
      />
    </>
  );
}
