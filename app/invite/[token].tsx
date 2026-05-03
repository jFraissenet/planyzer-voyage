import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Avatar,
  Button,
  Card,
  ScreenHeader,
  Text,
} from "@/components/ui";
import {
  EventPreview,
  getEventByShareToken,
  joinEventViaToken,
} from "@/lib/events";
import { setPendingInvite } from "@/lib/pendingInvite";
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

export default function InviteScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSession();
  const { token } = useLocalSearchParams<{ token: string }>();

  const [preview, setPreview] = useState<EventPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    getEventByShareToken(token)
      .then((p) => {
        if (!active) return;
        if (!p) setError(t("invitePage.invalidToken"));
        else setPreview(p);
      })
      .catch(() => {
        if (active) setError(t("invitePage.invalidToken"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, t]);

  const handleConnect = useCallback(async () => {
    if (!token) return;
    await setPendingInvite(token);
    router.replace("/(auth)/login");
  }, [router, token]);

  const handleJoin = useCallback(async () => {
    if (!token || joining) return;
    setJoining(true);
    setError(null);
    try {
      const eventId = await joinEventViaToken(token);
      router.replace(`/events/${eventId}`);
    } catch {
      setError(t("invitePage.joinError"));
      setJoining(false);
    }
  }, [joining, router, t, token]);

  const range = preview
    ? formatDateRange(
        preview.event_start_date,
        preview.event_end_date,
        i18n.language,
      )
    : null;

  if (loading || sessionLoading) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title={t("invitePage.title")} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </View>
    );
  }

  if (error || !preview) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title={t("invitePage.title")} />
        <View className="flex-1 items-center justify-center px-6">
          <Text variant="caption">
            {error ?? t("invitePage.invalidToken")}
          </Text>
          <View className="mt-6">
            <Button
              variant="ghost"
              label={t("invitePage.backHome")}
              onPress={() => router.replace("/")}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t("invitePage.title")} />
      <View className="flex-1 px-6 pt-6">
        <Card className="p-5">
          <Text variant="h2" className="mb-2">
            {preview.event_title}
          </Text>
          <Text variant="caption" className="mb-4">
            {range ?? t("events.card.noDates")}
          </Text>

          <View className="flex-row items-center mb-4">
            <Avatar
              src={preview.organizer_avatar_url ?? undefined}
              initials={initialsOf(preview.organizer_name)}
              size="sm"
              className="mr-2"
            />
            <Text variant="caption">
              {t("invitePage.organizedBy", {
                name: preview.organizer_name ?? "?",
              })}
            </Text>
          </View>

          {preview.event_description ? (
            <Text variant="body" className="mb-4">
              {preview.event_description}
            </Text>
          ) : null}

          <View
            className="self-start px-2.5 py-0.5 rounded-full mb-5"
            style={{ backgroundColor: theme.primarySoft }}
          >
            <Text
              variant="caption"
              style={{ color: theme.primary, fontWeight: "700" }}
            >
              {t("invitePage.participantCount", {
                count: preview.participant_count,
              })}
            </Text>
          </View>

          {session ? (
            <Button
              variant="cta"
              size="lg"
              label={
                joining ? t("invitePage.joining") : t("invitePage.join")
              }
              onPress={handleJoin}
              disabled={joining}
            />
          ) : (
            <Button
              variant="cta"
              size="lg"
              label={t("invitePage.connectToJoin")}
              onPress={handleConnect}
            />
          )}
        </Card>
      </View>
    </View>
  );
}
