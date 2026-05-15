import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SvgUri } from "react-native-svg";
import { EditEventModal } from "@/components/EditEventModal";
import { EditToolModal } from "@/components/EditToolModal";
import { InviteModal } from "@/components/InviteModal";
import {
  AvatarStack,
  Button,
  Card,
  Input,
  ScreenHeader,
  Text,
} from "@/components/ui";
import {
  Event,
  EventTool,
  ParticipantEntry,
  ToolType,
  createEventTool,
  ensureEventShareToken,
  getEvent,
  getMyEventRole,
  listEventTools,
  listParticipants,
  listToolTypes,
} from "@/lib/events";
import { useIsMobile } from "@/lib/responsive";
import { useSession } from "@/lib/useSession";
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
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  const fmt = (iso: string) => new Date(iso).toLocaleString(locale, opts);
  if (start && end) return `${fmt(start)} — ${fmt(end)}`;
  return fmt((start ?? end) as string);
}

function ToolIcon({ uri, size = 32 }: { uri: string | null; size?: number }) {
  if (!uri) {
    return (
      <View
        style={{ width: size, height: size }}
        className="items-center justify-center"
      >
        <Text variant="h3">🧩</Text>
      </View>
    );
  }
  if (Platform.OS === "web") {
    return <img src={uri} width={size} height={size} alt="" />;
  }
  return <SvgUri width={size} height={size} uri={uri} />;
}

function ToolCard({
  tool,
  iconUri,
  onPress,
  onEdit,
}: {
  tool: EventTool;
  iconUri: string | null;
  onPress: () => void;
  onEdit: (() => void) | null;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const badgeSize = isMobile ? 30 : 34;
  const badgeIconSize = isMobile ? 16 : 18;
  const lockFontSize = isMobile ? 13 : 15;
  const typeLabel = t(`tools.${tool.event_tool_type_code}.name`, {
    defaultValue: tool.event_tool_type_code,
  });
  const isRestricted = tool.event_tool_visibility === "restricted";
  return (
    <Card className="mb-3 overflow-hidden p-0">
      <Pressable
        onPress={onPress}
        className="flex-row items-center p-1 active:opacity-90"
      >
        <View
          className="mr-2 items-center justify-center rounded-xl"
          style={{ width: 40, height: 40, backgroundColor: theme.primarySoft }}
        >
          <ToolIcon uri={iconUri} size={24} />
        </View>
        <View className="flex-1">
          <Text
            numberOfLines={2}
            style={{
              color: "#1A1A1A",
              fontSize: 15,
              fontWeight: "700",
            }}
          >
            {tool.event_tool_name}
          </Text>
          <View
            className="flex-row items-center mt-0.5"
            style={{ gap: 8 }}
          >
            <Text variant="caption" className="flex-1" numberOfLines={1}>
              {typeLabel}
            </Text>
            {isRestricted ? (
              <View
                className="items-center justify-center px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#FEF3C7", height: badgeSize }}
              >
                <Text
                  style={{
                    color: "#92400E",
                    fontWeight: "600",
                    fontSize: lockFontSize,
                  }}
                >
                  🔒
                </Text>
              </View>
            ) : null}
            {onEdit ? (
              <Pressable
                onPress={onEdit}
                hitSlop={10}
                accessibilityLabel={t("events.editTool.action")}
                className="items-center justify-center rounded-full active:opacity-70"
                style={{
                  width: badgeSize,
                  height: badgeSize,
                  backgroundColor: theme.primarySoft,
                }}
              >
                <Ionicons name="pencil" size={badgeIconSize} color={theme.primary} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Card>
  );
}

function NewToolModal({
  visible,
  eventId,
  toolTypes,
  onClose,
  onCreated,
}: {
  visible: boolean;
  eventId: string;
  toolTypes: ToolType[];
  onClose: () => void;
  onCreated: (t: EventTool) => void;
}) {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState<ToolType | null>(null);
  const [name, setName] = useState("");
  const [nameAutoFilled, setNameAutoFilled] = useState(true);
  const [visibility, setVisibility] = useState<"all" | "restricted">("all");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    type?: string;
    name?: string;
    form?: string;
  }>({});

  useEffect(() => {
    if (!visible) {
      setSelectedType(null);
      setName("");
      setNameAutoFilled(true);
      setVisibility("all");
      setErrors({});
      setSubmitting(false);
    }
  }, [visible]);

  const selectType = (tt: ToolType) => {
    setSelectedType(tt);
    setVisibility(tt.tool_type_default_visibility);
    if (nameAutoFilled || !name.trim()) {
      setName(
        t(`tools.${tt.tool_type_code}.name`, {
          defaultValue: tt.tool_type_code,
        }),
      );
      setNameAutoFilled(true);
    }
    setErrors((e) => ({ ...e, type: undefined }));
  };

  const handleNameChange = (next: string) => {
    setName(next);
    setNameAutoFilled(false);
  };

  const handleSubmit = async () => {
    const next: typeof errors = {};
    if (!selectedType) next.type = t("events.newTool.errorTypeRequired");
    if (!name.trim()) next.name = t("events.newTool.errorNameRequired");
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const created = await createEventTool({
        event_tool_event_id: eventId,
        event_tool_type_code: selectedType!.tool_type_code,
        event_tool_name: name.trim(),
        event_tool_visibility: visibility,
      });
      onCreated(created);
      onClose();
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: unknown }).code)
          : null;
      // eslint-disable-next-line no-console
      console.error("createEventTool failed:", err);
      if (code === "23505") {
        setErrors({ name: t("events.newTool.errorNameDuplicate") });
      } else {
        const msg =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : t("events.newTool.errorGeneric");
        setErrors({ form: msg });
      }
    } finally {
      setSubmitting(false);
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
          <Text variant="h2" className="mb-4">
            {t("events.newTool.title")}
          </Text>

          <Input
            label={t("events.newTool.nameLabel")}
            placeholder={t("events.newTool.namePlaceholder")}
            value={name}
            onChangeText={handleNameChange}
            error={errors.name}
            className="mb-4"
            required
          />

          <Text variant="label" className="mb-2">
            {t("events.newTool.typeLabel")}
          </Text>
          <View className="gap-2 mb-4">
            {toolTypes.map((tt) => {
              const selected =
                selectedType?.tool_type_code === tt.tool_type_code;
              return (
                <Pressable
                  key={tt.tool_type_code}
                  onPress={() => selectType(tt)}
                  className={`flex-row items-center p-3 rounded-lg border ${
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-surface"
                  }`}
                >
                  <View className="mr-3">
                    <ToolIcon uri={tt.tool_type_icon} size={28} />
                  </View>
                  <Text>
                    {t(`tools.${tt.tool_type_code}.name`, {
                      defaultValue: tt.tool_type_code,
                    })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {errors.type ? (
            <Text className="text-error text-sm mb-2">{errors.type}</Text>
          ) : null}

          <Text variant="label" className="mb-2">
            {t("events.newTool.visibilityLabel")}
          </Text>
          <View className="gap-2 mb-4">
            {(["all", "restricted"] as const).map((v) => {
              const selected = visibility === v;
              return (
                <Pressable
                  key={v}
                  onPress={() => setVisibility(v)}
                  className={`p-3 rounded-lg border ${
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-surface"
                  }`}
                >
                  <Text variant="label">
                    {t(
                      v === "all"
                        ? "events.newTool.visibilityAll"
                        : "events.newTool.visibilityRestricted",
                    )}
                  </Text>
                  <Text variant="caption" className="mt-1">
                    {t(
                      v === "all"
                        ? "events.newTool.visibilityAllHint"
                        : "events.newTool.visibilityRestrictedHint",
                    )}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {errors.form ? (
            <Text className="text-error text-sm mb-2">{errors.form}</Text>
          ) : null}

          <View className="gap-2">
            <Button
              variant="cta"
              size="lg"
              label={
                submitting
                  ? t("events.newTool.submitting")
                  : t("events.newTool.submit")
              }
              onPress={handleSubmit}
              disabled={submitting}
            />
            <Button
              variant="ghost"
              label={t("events.newTool.cancel")}
              onPress={onClose}
              disabled={submitting}
            />
          </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function EventDetailScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { session } = useSession();
  const currentUserId = session?.user?.id ?? "";
  const { event_id } = useLocalSearchParams<{ event_id: string }>();
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };
  const [event, setEvent] = useState<Event | null>(null);
  const [tools, setTools] = useState<EventTool[]>([]);
  const [toolTypes, setToolTypes] = useState<ToolType[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [participants, setParticipants] = useState<ParticipantEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newToolOpen, setNewToolOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<EventTool | null>(null);
  const [sharing, setSharing] = useState(false);

  const handleShare = useCallback(async () => {
    if (!event || sharing) return;
    setSharing(true);
    try {
      const token = await ensureEventShareToken(event.event_id);
      const base =
        typeof window !== "undefined" && window.location
          ? window.location.origin
          : (process.env.EXPO_PUBLIC_APP_URL ?? "https://planyzer.app");
      const url = `${base}/e/${token}`;
      const invitation = t("events.share.message", {
        title: event.event_title,
      });
      const fullMessage = `${invitation}\n${url}`;
      if (
        Platform.OS === "web" &&
        typeof navigator !== "undefined" &&
        typeof (navigator as Navigator & { share?: unknown }).share ===
          "function"
      ) {
        try {
          await (
            navigator as Navigator & {
              share: (d: { title: string; text: string; url: string }) => Promise<void>;
            }
          ).share({ title: event.event_title, text: invitation, url });
        } catch {
          // user dismissed
        }
      } else if (Platform.OS === "web") {
        try {
          await navigator.clipboard.writeText(fullMessage);
          // eslint-disable-next-line no-alert
          window.alert(t("events.share.copied"));
        } catch {
          // eslint-disable-next-line no-alert
          window.prompt(t("events.share.copyManual"), fullMessage);
        }
      } else {
        await Share.share({ message: fullMessage, title: event.event_title });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("share failed", err);
    } finally {
      setSharing(false);
    }
  }, [event, sharing, t]);

  const refreshParticipants = useCallback(async () => {
    if (!event_id) return;
    try {
      const list = await listParticipants(event_id);
      setParticipants(list);
    } catch {
      setParticipants([]);
    }
  }, [event_id]);

  const load = useCallback(async () => {
    if (!event_id) return;
    const [e, ts, tt, role, p] = await Promise.all([
      getEvent(event_id),
      listEventTools(event_id),
      listToolTypes(),
      getMyEventRole(event_id),
      listParticipants(event_id).catch(() => []),
    ]);
    setEvent(e);
    setTools(ts);
    setToolTypes(tt);
    setMyRole(role);
    setParticipants(p);
  }, [event_id]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      load()
        .catch(() => {
          if (active) {
            setEvent(null);
            setTools([]);
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

  const toolIconByCode = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const tt of toolTypes) map.set(tt.tool_type_code, tt.tool_type_icon);
    return map;
  }, [toolTypes]);

  const range = event
    ? formatDateRange(
        event.event_start_date,
        event.event_end_date,
        i18n.language,
      )
    : null;

  const isAdmin = myRole === "admin";
  const canAddTools = isAdmin || myRole === "member";

  return (
    <View className="flex-1 bg-background">
      {loading ? (
        <>
          <ScreenHeader title={t("events.detail.loading")} onBack={goBack} />
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        </>
      ) : !event ? (
        <>
          <ScreenHeader title={t("common.error")} onBack={goBack} />
          <View className="flex-1 items-center justify-center">
            <Text variant="caption">{t("common.error")}</Text>
          </View>
        </>
      ) : (
        <>
          <ScreenHeader
            title={event.event_title}
            subtitle={range ?? undefined}
            onBack={goBack}
            onAction={isAdmin ? () => setEditOpen(true) : undefined}
            actionIcon={isAdmin ? "pencil" : undefined}
            actionLabel={t("events.edit.action")}
          />
          <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingTop: 20 }}>
            {event.event_location ? (
              <View
                className="px-3 mb-3 flex-row items-center"
                style={{ gap: 6 }}
              >
                <Ionicons
                  name="location-outline"
                  size={16}
                  color={theme.sectionLabel}
                />
                <Text variant="body" className="flex-1">
                  {event.event_location}
                </Text>
              </View>
            ) : null}
            {event.event_description ? (
              <View className="px-3 mb-6">
                <Text variant="body">{event.event_description}</Text>
              </View>
            ) : null}

            <View className="px-3 mb-4 flex-row items-center">
              <Text
                className="flex-1 uppercase"
                style={{
                  color: theme.sectionLabel,
                  fontSize: 12,
                  fontWeight: "700",
                  letterSpacing: 1.5,
                }}
              >
                {t("invite.participantsSection")}
              </Text>
              <AvatarStack
                participants={participants.map((p) => ({
                  id: p.user_id,
                  full_name: p.full_name,
                  avatar_url: p.avatar_url,
                }))}
                onPress={() => setInviteOpen(true)}
                className="mr-3"
              />
              <Pressable
                onPress={() => setInviteOpen(true)}
                accessibilityLabel={t("invite.button")}
                className="items-center justify-center rounded-full active:opacity-70"
                style={{
                  width: 28,
                  height: 28,
                  backgroundColor: theme.primarySoft,
                }}
              >
                <Ionicons name="add" size={18} color={theme.primary} />
              </Pressable>
            </View>

            <View className="px-3 mb-3 flex-row items-center">
              <Text
                className="flex-1 uppercase"
                style={{
                  color: theme.sectionLabel,
                  fontSize: 12,
                  fontWeight: "700",
                  letterSpacing: 1.5,
                }}
              >
                {t("events.detail.toolsTitle")}
              </Text>
              <View
                className="px-2.5 py-0.5 rounded-full mr-3"
                style={{ backgroundColor: theme.primarySoft }}
              >
                <Text
                  variant="caption"
                  style={{ color: theme.primary, fontWeight: "700" }}
                >
                  {tools.length}
                </Text>
              </View>
              {canAddTools ? (
                <Pressable
                  onPress={() => setNewToolOpen(true)}
                  accessibilityLabel={t("events.detail.addTool")}
                  className="items-center justify-center rounded-full active:opacity-70"
                  style={{
                    width: 28,
                    height: 28,
                    backgroundColor: theme.primarySoft,
                  }}
                >
                  <Ionicons name="add" size={18} color={theme.primary} />
                </Pressable>
              ) : null}
            </View>

            <View className="px-3">
              {tools.length === 0 ? (
                canAddTools ? (
                  <Pressable
                    onPress={() => setNewToolOpen(true)}
                    accessibilityLabel={t("events.detail.addTool")}
                    className="active:opacity-90 mb-4 overflow-hidden rounded-2xl"
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
                            {t("events.detail.toolsBanner.title")}
                          </Text>
                          <Text
                            style={{
                              color: "rgba(255,255,255,0.85)",
                              fontSize: 13,
                              marginTop: 2,
                            }}
                          >
                            {t("events.detail.toolsBanner.subtitle")}
                          </Text>
                        </View>
                      </View>
                    </LinearGradient>
                  </Pressable>
                ) : (
                  <View className="py-4">
                    <Text variant="caption">{t("events.detail.noTools")}</Text>
                  </View>
                )
              ) : (
                tools.map((tl) => {
                  const canEditTool =
                    isAdmin || tl.event_tool_created_by === currentUserId;
                  return (
                    <ToolCard
                      key={tl.event_tool_id}
                      tool={tl}
                      iconUri={
                        toolIconByCode.get(tl.event_tool_type_code) ?? null
                      }
                      onPress={() =>
                        router.push(
                          `/events/${tl.event_tool_event_id}/tools/${tl.event_tool_id}`,
                        )
                      }
                      onEdit={canEditTool ? () => setEditingTool(tl) : null}
                    />
                  );
                })
              )}
            </View>
          </ScrollView>
        </>
      )}

      {event ? (
        <NewToolModal
          visible={newToolOpen}
          eventId={event.event_id}
          toolTypes={toolTypes}
          onClose={() => setNewToolOpen(false)}
          onCreated={(tl) => {
            setTools((prev) => [...prev, tl]);
            router.push(
              `/events/${tl.event_tool_event_id}/tools/${tl.event_tool_id}`,
            );
          }}
        />
      ) : null}

      {event ? (
        <InviteModal
          visible={inviteOpen}
          eventId={event.event_id}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          eventCreatorId={event.event_creator_id}
          onClose={() => setInviteOpen(false)}
          onShare={handleShare}
          sharing={sharing}
          onChanged={refreshParticipants}
        />
      ) : null}

      <EditEventModal
        visible={editOpen}
        event={event}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          load();
        }}
      />

      <EditToolModal
        visible={!!editingTool}
        tool={editingTool}
        onClose={() => setEditingTool(null)}
        onSaved={() => {
          setEditingTool(null);
          load();
        }}
        onDeleted={() => {
          setEditingTool(null);
          load();
        }}
      />
    </View>
  );
}
