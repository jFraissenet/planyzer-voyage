import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { DateTimeInput, FAB, Text } from "@/components/ui";
import {
  isEventToolManager,
  listEventToolProposals,
  readProposalsToolSettings,
  updateProposalsToolSettings,
  type EventToolProposal,
} from "@/lib/proposals";
import { useSession } from "@/lib/useSession";
import { isoToLocalInput, localInputToIso } from "./dateHelpers";
import { ProposalCard } from "./ProposalCard";
import { ProposalDetailModal } from "./ProposalDetailModal";
import { ProposalEditModal } from "./ProposalEditModal";
import { ToolShell, type ToolProps } from "../ToolShell";
import { theme } from "@/lib/theme";

export function ProposalsTool(props: ToolProps) {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const currentUserId = session?.user?.id ?? "";

  const [proposals, setProposals] = useState<EventToolProposal[]>([]);
  const [isManager, setIsManager] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EventToolProposal | null>(null);
  const [openDetail, setOpenDetail] = useState<EventToolProposal | null>(null);

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

  useEffect(() => {
    setDeadlineLocal(propSettings.vote_deadline);
    setLockedLocal(propSettings.proposals_locked);
  }, [propSettings.vote_deadline, propSettings.proposals_locked]);

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

  const canCreate = !lockedLocal || isManager;

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

  const changeDeadline = (local: string) => {
    const iso = localInputToIso(local);
    setDeadlineLocal(iso);
    void persist({ vote_deadline: iso, proposals_locked: lockedLocal });
  };

  const toggleLocked = () => {
    const next = !lockedLocal;
    setLockedLocal(next);
    void persist({ vote_deadline: deadlineLocal, proposals_locked: next });
  };

  const showSettings = isManager || !!deadlineDisplay || lockedLocal;

  return (
    <>
      <ToolShell {...props}>
        {showSettings ? (
          <View
            className="rounded-2xl px-4 py-3 mb-4"
            style={{
              backgroundColor: "#F3F0FA",
              borderWidth: 1,
              borderColor: "#E8E3DB",
              gap: 10,
            }}
          >
            {isManager ? (
              <>
                <View
                  className="flex-row items-center"
                  style={{ gap: 10 }}
                >
                  <Ionicons name="time-outline" size={16} color={theme.primary} />
                  <View className="flex-1">
                    <DateTimeInput
                      label={t("proposals.deadlineLabel")}
                      placeholder={t("proposals.datePlaceholder")}
                      value={isoToLocalInput(deadlineLocal)}
                      onChange={changeDeadline}
                    />
                  </View>
                </View>
                <Pressable
                  onPress={toggleLocked}
                  className="flex-row items-center justify-between"
                  style={{ gap: 10 }}
                >
                  <View
                    className="flex-row items-center flex-1"
                    style={{ gap: 10 }}
                  >
                    <Ionicons
                      name={lockedLocal ? "lock-closed" : "lock-open"}
                      size={16}
                      color={lockedLocal ? "#78350F" : theme.primary}
                    />
                    <View className="flex-1">
                      <Text
                        style={{
                          color: "#1A1A1A",
                          fontSize: 13,
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
              </>
            ) : (
              <View style={{ gap: 6 }}>
                {deadlineDisplay ? (
                  <View
                    className="flex-row items-center"
                    style={{ gap: 6 }}
                  >
                    <Ionicons name="time-outline" size={14} color={theme.primary} />
                    <Text
                      style={{
                        color: "#1A1A1A",
                        fontSize: 13,
                        fontWeight: "700",
                      }}
                    >
                      {t("proposals.deadlineAt", { date: deadlineDisplay })}
                    </Text>
                  </View>
                ) : null}
                {lockedLocal ? (
                  <View
                    className="flex-row items-center"
                    style={{ gap: 6 }}
                  >
                    <Ionicons name="lock-closed" size={13} color="#78350F" />
                    <Text
                      style={{
                        color: "#78350F",
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      {t("proposals.locked")}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        ) : null}

        {proposals.length === 0 ? (
          <View className="py-10 items-center">
            <Text variant="caption" className="text-center">
              {t("proposals.empty")}
            </Text>
          </View>
        ) : (
          proposals.map((p) => {
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
                onOpen={() => setOpenDetail(p)}
                onEdit={canEditThis ? () => setEditing(p) : null}
                onChanged={load}
              />
            );
          })
        )}
      </ToolShell>

      {canCreate ? (
        <FAB
          icon="add"
          onPress={() => setCreating(true)}
          accessibilityLabel={t("proposals.add")}
        />
      ) : null}

      <ProposalEditModal
        mode="create"
        visible={creating}
        toolId={props.tool.event_tool_id}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          load();
        }}
      />

      {editing ? (
        <ProposalEditModal
          mode="edit"
          visible
          toolId={props.tool.event_tool_id}
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : null}

      <ProposalDetailModal
        visible={!!openDetail}
        proposal={openDetail}
        currentUserId={currentUserId}
        isToolAdmin={props.isToolAdmin}
        isManager={isManager}
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
    </>
  );
}
