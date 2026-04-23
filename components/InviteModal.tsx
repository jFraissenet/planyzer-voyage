import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Avatar, Button, Input, Text } from "@/components/ui";
import {
  addParticipant,
  listFormerParticipants,
  listParticipants,
  rejoinParticipant,
  removeParticipant,
  searchUsers,
  type FormerParticipantEntry,
  type ParticipantEntry,
  type UserSearchResult,
} from "@/lib/events";

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      variant="caption"
      className="mb-2 uppercase"
      style={{
        letterSpacing: 1.2,
        fontWeight: "700",
        fontSize: 11,
        color: "#6050DC",
      }}
    >
      {children}
    </Text>
  );
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

type Props = {
  visible: boolean;
  eventId: string;
  isAdmin: boolean;
  currentUserId: string;
  eventCreatorId: string;
  onClose: () => void;
  onChanged?: () => void;
};

export function InviteModal({
  visible,
  eventId,
  isAdmin,
  currentUserId,
  eventCreatorId,
  onClose,
  onChanged,
}: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [participants, setParticipants] = useState<ParticipantEntry[]>([]);
  const [formerMembers, setFormerMembers] = useState<FormerParticipantEntry[]>(
    [],
  );
  const [searching, setSearching] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [formerOpen, setFormerOpen] = useState(false);

  const loadParticipants = useCallback(async () => {
    try {
      const p = await listParticipants(eventId);
      setParticipants(p);
    } catch {
      setParticipants([]);
    }
    if (isAdmin) {
      try {
        const f = await listFormerParticipants(eventId);
        setFormerMembers(f);
      } catch {
        setFormerMembers([]);
      }
    } else {
      setFormerMembers([]);
    }
  }, [eventId, isAdmin]);

  useEffect(() => {
    if (visible) {
      setQuery("");
      setResults([]);
      loadParticipants();
    }
  }, [visible, loadParticipants]);

  useEffect(() => {
    if (!visible) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    const h = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await searchUsers(trimmed);
        setResults(r);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(h);
  }, [query, visible]);

  const participantIds = useMemo(
    () => new Set(participants.map((p) => p.user_id)),
    [participants],
  );
  const formerIds = useMemo(
    () => new Set(formerMembers.map((f) => f.user_id)),
    [formerMembers],
  );

  const handleAdd = async (user: UserSearchResult) => {
    setBusyUserId(user.user_id);
    try {
      await addParticipant(eventId, user.user_id);
      await loadParticipants();
      onChanged?.();
    } finally {
      setBusyUserId(null);
    }
  };

  const confirmRemove = (p: ParticipantEntry) => {
    const title = t("invite.removeConfirm", { name: p.full_name ?? "?" });
    const body = t("invite.removeConfirmBody");
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (window.confirm(`${title}\n\n${body}`)) void doRemove(p.user_id);
      return;
    }
    Alert.alert(title, body, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("invite.remove"),
        style: "destructive",
        onPress: () => doRemove(p.user_id),
      },
    ]);
  };

  const doRemove = async (userId: string) => {
    setBusyUserId(userId);
    try {
      await removeParticipant(eventId, userId);
      await loadParticipants();
      onChanged?.();
    } finally {
      setBusyUserId(null);
    }
  };

  const handleRejoin = async (userId: string) => {
    setBusyUserId(userId);
    try {
      await rejoinParticipant(eventId, userId);
      await loadParticipants();
      onChanged?.();
    } finally {
      setBusyUserId(null);
    }
  };

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
          className="w-full max-w-md bg-background rounded-2xl p-5"
          style={{ maxHeight: "90%" }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text variant="h2" className="mb-1">
              {t("invite.title")}
            </Text>
            <Text variant="caption" className="mb-4">
              {t("invite.subtitle")}
            </Text>

            {isAdmin ? (
              <>
                <Input
                  placeholder={t("invite.searchPlaceholder")}
                  value={query}
                  onChangeText={setQuery}
                  autoFocus
                  autoCapitalize="none"
                  className="mb-3"
                />

                {query.trim().length >= 2 ? (
                  <View className="mb-5">
                    {searching ? (
                      <Text variant="caption">{t("common.loading")}</Text>
                    ) : results.length === 0 ? (
                      <Text variant="caption">{t("invite.noResults")}</Text>
                    ) : (
                      results.map((u) => {
                        const already = participantIds.has(u.user_id);
                        const isFormer = formerIds.has(u.user_id);
                        const busy = busyUserId === u.user_id;
                        return (
                          <View
                            key={u.user_id}
                            className="flex-row items-center py-2"
                          >
                            <Avatar
                              src={u.avatar_url ?? undefined}
                              initials={initialsOf(u.full_name)}
                              size="sm"
                              className="mr-3"
                            />
                            <View className="flex-1 pr-2">
                              <Text numberOfLines={1}>
                                {u.full_name ?? "?"}
                              </Text>
                              {isFormer ? (
                                <Text variant="caption">
                                  {t("invite.leftMember")}
                                </Text>
                              ) : null}
                            </View>
                            {already ? (
                              <Text
                                variant="caption"
                                style={{ color: "#6050DC", fontWeight: "600" }}
                              >
                                {t("invite.alreadyMember")}
                              </Text>
                            ) : isFormer ? (
                              <Pressable
                                onPress={() => handleRejoin(u.user_id)}
                                disabled={busy}
                                className="px-3 py-1.5 rounded-full"
                                style={{
                                  backgroundColor: "#EEECFC",
                                  opacity: busy ? 0.5 : 1,
                                }}
                              >
                                <Text
                                  variant="label"
                                  style={{
                                    color: "#6050DC",
                                    fontWeight: "700",
                                  }}
                                >
                                  {t("invite.rejoin")}
                                </Text>
                              </Pressable>
                            ) : (
                              <Pressable
                                onPress={() => handleAdd(u)}
                                disabled={busy}
                                className="px-3 py-1.5 rounded-full"
                                style={{
                                  backgroundColor: "#EEECFC",
                                  opacity: busy ? 0.5 : 1,
                                }}
                              >
                                <Text
                                  variant="label"
                                  style={{
                                    color: "#6050DC",
                                    fontWeight: "700",
                                  }}
                                >
                                  + {t("invite.add")}
                                </Text>
                              </Pressable>
                            )}
                          </View>
                        );
                      })
                    )}
                  </View>
                ) : null}
              </>
            ) : null}

            <SectionLabel>
              {t("invite.currentParticipants", { count: participants.length })}
            </SectionLabel>
            <View className="mb-5">
              {participants.map((p) => {
                const isSelf = p.user_id === currentUserId;
                const isCreator = p.user_id === eventCreatorId;
                const canRemove = isAdmin && !isSelf && !isCreator;
                const busy = busyUserId === p.user_id;
                return (
                  <View
                    key={p.user_id}
                    className="flex-row items-center py-2"
                  >
                    <Avatar
                      src={p.avatar_url ?? undefined}
                      initials={initialsOf(p.full_name)}
                      size="sm"
                      className="mr-3"
                    />
                    <View className="flex-1 pr-2">
                      <Text numberOfLines={1}>{p.full_name ?? "?"}</Text>
                      <Text variant="caption">
                        {t(`roles.${p.role_code}`, {
                          defaultValue: p.role_code,
                        })}
                        {isCreator ? " · ★" : null}
                      </Text>
                    </View>
                    {canRemove ? (
                      <Pressable
                        onPress={() => confirmRemove(p)}
                        disabled={busy}
                        hitSlop={8}
                        style={{ opacity: busy ? 0.5 : 1 }}
                      >
                        <Text
                          variant="caption"
                          style={{ color: "#EF4444", fontWeight: "600" }}
                        >
                          {t("invite.remove")}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>

            {isAdmin && formerMembers.length > 0 ? (
              <View className="mb-5">
                <Pressable
                  onPress={() => setFormerOpen((v) => !v)}
                  className="flex-row items-center py-2"
                >
                  <Text
                    className="flex-1 uppercase"
                    style={{
                      color: "#6050DC",
                      fontSize: 11,
                      fontWeight: "700",
                      letterSpacing: 1.2,
                    }}
                  >
                    {t("invite.formerMembers", {
                      count: formerMembers.length,
                    })}
                  </Text>
                  <Text
                    variant="caption"
                    style={{ color: "#6050DC" }}
                  >
                    {formerOpen ? "▾" : "▸"}
                  </Text>
                </Pressable>
                {formerOpen
                  ? formerMembers.map((f) => {
                      const busy = busyUserId === f.user_id;
                      return (
                        <View
                          key={f.user_id}
                          className="flex-row items-center py-2"
                          style={{ opacity: 0.6 }}
                        >
                          <Avatar
                            src={f.avatar_url ?? undefined}
                            initials={initialsOf(f.full_name)}
                            size="sm"
                            className="mr-3"
                          />
                          <View className="flex-1 pr-2">
                            <Text numberOfLines={1}>
                              {f.full_name ?? "?"}
                            </Text>
                            <Text variant="caption">
                              {t("invite.leftMember")}
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => handleRejoin(f.user_id)}
                            disabled={busy}
                            className="px-3 py-1.5 rounded-full"
                            style={{
                              backgroundColor: "#EEECFC",
                              opacity: busy ? 0.5 : 1,
                            }}
                          >
                            <Text
                              variant="label"
                              style={{
                                color: "#6050DC",
                                fontWeight: "700",
                              }}
                            >
                              {t("invite.rejoin")}
                            </Text>
                          </Pressable>
                        </View>
                      );
                    })
                  : null}
              </View>
            ) : null}

            <Button
              variant="ghost"
              label={t("invite.close")}
              onPress={onClose}
            />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
