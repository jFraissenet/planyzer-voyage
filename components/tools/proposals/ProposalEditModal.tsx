import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { AddressInput, Button, DateTimeInput, Input, Text } from "@/components/ui";
import {
  createEventToolProposal,
  deleteEventToolProposal,
  updateEventToolProposal,
  type EventToolProposal,
  type ProposalInput,
} from "@/lib/proposals";
import { isoToLocalInput, localInputToIso } from "./dateHelpers";

type Mode = "create" | "edit";

type Props = {
  mode: Mode;
  visible: boolean;
  toolId: string;
  existing?: EventToolProposal;
  onClose: () => void;
  onSaved: () => void;
};

type LinkDraft = { label: string; url: string };

function Section({
  title,
  badge,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  badge?: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View
      className="rounded-xl overflow-hidden"
      style={{
        borderWidth: 1,
        borderColor: "#E8E3DB",
        backgroundColor: "#FFFFFF",
      }}
    >
      <Pressable
        onPress={onToggle}
        className="flex-row items-center justify-between px-4 py-3 active:opacity-70"
      >
        <View className="flex-row items-center flex-1" style={{ gap: 8 }}>
          <Text
            style={{ fontSize: 14, fontWeight: "700", color: "#1A1A1A" }}
          >
            {title}
          </Text>
          {badge ? (
            <View
              className="px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "#EEECFC" }}
            >
              <Text
                style={{
                  color: "#6050DC",
                  fontSize: 11,
                  fontWeight: "700",
                }}
              >
                {badge}
              </Text>
            </View>
          ) : null}
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color="#6B6B6B"
        />
      </Pressable>
      {expanded ? (
        <View
          className="px-4 pb-4"
          style={{
            borderTopWidth: 1,
            borderTopColor: "#F2EDE4",
            gap: 12,
            paddingTop: 12,
          }}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}

function looksLikeUrl(s: string): boolean {
  const t = s.trim();
  return /^https?:\/\//i.test(t) || /^data:image/i.test(t);
}

export function ProposalEditModal({
  mode,
  visible,
  toolId,
  existing,
  onClose,
  onSaved,
}: Props) {
  const { t } = useTranslation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [location, setLocation] = useState("");
  const [locationUrl, setLocationUrl] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [capacityMin, setCapacityMin] = useState("");
  const [capacityMax, setCapacityMax] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [links, setLinks] = useState<LinkDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [essentialOpen, setEssentialOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setBusy(false);
    setError(null);
    if (mode === "edit" && existing) {
      setTitle(existing.title);
      setDescription(existing.description ?? "");
      setPriceMin(existing.price_min != null ? String(existing.price_min) : "");
      setPriceMax(existing.price_max != null ? String(existing.price_max) : "");
      setLocation(existing.location ?? "");
      setLocationUrl(existing.location_url ?? "");
      setDateStart(isoToLocalInput(existing.date_start));
      setDateEnd(isoToLocalInput(existing.date_end));
      setCapacityMin(
        existing.capacity_min != null ? String(existing.capacity_min) : "",
      );
      setCapacityMax(
        existing.capacity_max != null ? String(existing.capacity_max) : "",
      );
      setImages(existing.images.map((img) => img.url));
      setLinks(
        existing.links.map((l) => ({ label: l.label ?? "", url: l.url })),
      );
      setEssentialOpen(true);
      const hasDetails =
        existing.price_min != null ||
        existing.price_max != null ||
        !!existing.location ||
        !!existing.location_url ||
        !!existing.date_start ||
        !!existing.date_end ||
        existing.capacity_min != null ||
        existing.capacity_max != null;
      const hasMedia = existing.images.length > 0 || existing.links.length > 0;
      setDetailsOpen(hasDetails);
      setMediaOpen(hasMedia);
    } else {
      setTitle("");
      setDescription("");
      setPriceMin("");
      setPriceMax("");
      setLocation("");
      setLocationUrl("");
      setDateStart("");
      setDateEnd("");
      setCapacityMin("");
      setCapacityMax("");
      setImages([]);
      setLinks([]);
      setEssentialOpen(true);
      setDetailsOpen(false);
      setMediaOpen(false);
    }
  }, [visible, mode, existing]);

  const updateImage = (idx: number, url: string) => {
    setImages((prev) => prev.map((v, i) => (i === idx ? url : v)));
  };
  const addImage = () => setImages((prev) => [...prev, ""]);
  const removeImage = (idx: number) =>
    setImages((prev) => prev.filter((_, i) => i !== idx));

  const updateLink = (idx: number, patch: Partial<LinkDraft>) => {
    setLinks((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    );
  };
  const addLink = () =>
    setLinks((prev) => [...prev, { label: "", url: "" }]);
  const removeLink = (idx: number) =>
    setLinks((prev) => prev.filter((_, i) => i !== idx));

  const detailsBadge = useMemo(() => {
    const items: string[] = [];
    if (priceMin.trim() || priceMax.trim()) items.push("€");
    if (location.trim()) items.push("📍");
    if (dateStart || dateEnd) items.push("📅");
    if (capacityMin.trim() || capacityMax.trim()) items.push("👥");
    return items.length > 0 ? items.join(" ") : undefined;
  }, [priceMin, priceMax, location, dateStart, dateEnd, capacityMin, capacityMax]);

  const mediaBadge = useMemo(() => {
    const i = images.filter((u) => u.trim()).length;
    const l = links.filter((x) => x.url.trim()).length;
    if (i === 0 && l === 0) return undefined;
    const parts: string[] = [];
    if (i > 0) parts.push(`${i} 🖼`);
    if (l > 0) parts.push(`${l} 🔗`);
    return parts.join(" ");
  }, [images, links]);

  const build = (): ProposalInput | null => {
    const titleTrim = title.trim();
    if (!titleTrim) {
      setError(t("proposals.errorTitleRequired"));
      setEssentialOpen(true);
      return null;
    }
    const isoStart = localInputToIso(dateStart);
    const isoEnd = localInputToIso(dateEnd);
    if ((dateStart && !isoStart) || (dateEnd && !isoEnd)) {
      setError(t("proposals.errorInvalidDate"));
      setDetailsOpen(true);
      return null;
    }
    if (
      isoStart &&
      isoEnd &&
      new Date(isoStart).getTime() > new Date(isoEnd).getTime()
    ) {
      setError(t("proposals.errorEndBeforeStart"));
      setDetailsOpen(true);
      return null;
    }
    const parseNumber = (s: string) =>
      s.trim() ? Number(s.replace(",", ".")) : null;
    const parseInt = (s: string) =>
      s.trim() ? Number.parseInt(s, 10) : null;

    const parsedPriceMin = parseNumber(priceMin);
    const parsedPriceMax = parseNumber(priceMax);
    if (
      (parsedPriceMin != null && Number.isNaN(parsedPriceMin)) ||
      (parsedPriceMax != null && Number.isNaN(parsedPriceMax))
    ) {
      setError(t("proposals.errorInvalidPrice"));
      setDetailsOpen(true);
      return null;
    }
    if (
      parsedPriceMin != null &&
      parsedPriceMax != null &&
      parsedPriceMin > parsedPriceMax
    ) {
      setError(t("proposals.errorInvalidPriceRange"));
      setDetailsOpen(true);
      return null;
    }

    const parsedCapacityMin = parseInt(capacityMin);
    const parsedCapacityMax = parseInt(capacityMax);
    if (
      (parsedCapacityMin != null && Number.isNaN(parsedCapacityMin)) ||
      (parsedCapacityMax != null && Number.isNaN(parsedCapacityMax))
    ) {
      setError(t("proposals.errorInvalidCapacity"));
      setDetailsOpen(true);
      return null;
    }
    if (
      parsedCapacityMin != null &&
      parsedCapacityMax != null &&
      parsedCapacityMin > parsedCapacityMax
    ) {
      setError(t("proposals.errorInvalidCapacityRange"));
      setDetailsOpen(true);
      return null;
    }
    const cleanImages = images
      .map((u) => u.trim())
      .filter((u) => u.length > 0)
      .map((url) => ({ url }));
    const cleanLinks = links
      .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
      .filter((l) => l.url.length > 0)
      .map((l) => ({ label: l.label || null, url: l.url }));

    return {
      title: titleTrim,
      description: description.trim() || null,
      price_min: parsedPriceMin,
      price_max: parsedPriceMax,
      location: location.trim() || null,
      location_url: locationUrl.trim() || null,
      date_start: isoStart,
      date_end: isoEnd,
      capacity_min: parsedCapacityMin,
      capacity_max: parsedCapacityMax,
      images: cleanImages,
      links: cleanLinks,
    };
  };

  const save = async () => {
    const input = build();
    if (!input) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "create") {
        await createEventToolProposal(toolId, input);
      } else if (existing) {
        await updateEventToolProposal(existing.proposal_id, input);
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message || t("proposals.errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (!existing || mode !== "edit") return;
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
    if (!existing) return;
    setBusy(true);
    setError(null);
    try {
      await deleteEventToolProposal(existing.proposal_id);
      onSaved();
    } catch (e) {
      setError((e as Error).message || t("proposals.errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  const titleLabel =
    mode === "create" ? t("proposals.createTitle") : t("proposals.editTitle");

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
          className="w-full max-w-md bg-background rounded-2xl"
          style={{ maxHeight: "92%" }}
        >
          <View className="px-5 pt-5 pb-3">
            <Text variant="h2">{titleLabel}</Text>
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: 16,
              gap: 10,
            }}
          >
            <Section
              title={t("proposals.sectionEssential")}
              expanded={essentialOpen}
              onToggle={() => setEssentialOpen((v) => !v)}
            >
              <Input
                label={t("proposals.titleLabel")}
                placeholder={t("proposals.titlePlaceholder")}
                value={title}
                onChangeText={setTitle}
                autoFocus
              />
              <Input
                label={t("proposals.descriptionLabel")}
                placeholder={t("proposals.descriptionPlaceholder")}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                style={{ minHeight: 80, textAlignVertical: "top" }}
              />
            </Section>

            <Section
              title={t("proposals.sectionDetails")}
              badge={detailsBadge}
              expanded={detailsOpen}
              onToggle={() => setDetailsOpen((v) => !v)}
            >
              <View className="flex-row" style={{ gap: 8 }}>
                <View className="flex-1">
                  <Input
                    label={t("proposals.priceMinLabel")}
                    placeholder="0,00"
                    value={priceMin}
                    onChangeText={setPriceMin}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View className="flex-1">
                  <Input
                    label={t("proposals.priceMaxLabel")}
                    placeholder="0,00"
                    value={priceMax}
                    onChangeText={setPriceMax}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <View className="flex-row" style={{ gap: 8 }}>
                <View className="flex-1">
                  <Input
                    label={t("proposals.capacityMinLabel")}
                    placeholder="0"
                    value={capacityMin}
                    onChangeText={setCapacityMin}
                    keyboardType="number-pad"
                  />
                </View>
                <View className="flex-1">
                  <Input
                    label={t("proposals.capacityMaxLabel")}
                    placeholder="0"
                    value={capacityMax}
                    onChangeText={setCapacityMax}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
              <AddressInput
                label={t("proposals.locationLabel")}
                placeholder={t("proposals.locationPlaceholder")}
                value={location}
                onChangeText={(text) => {
                  setLocation(text);
                  // Free-typed text invalidates any previously picked URL.
                  if (locationUrl) setLocationUrl("");
                }}
                onPickSuggestion={(s) => {
                  setLocation(s.short);
                  setLocationUrl(s.mapsUrl);
                }}
              />
              <View className="flex-row" style={{ gap: 8 }}>
                <View className="flex-1">
                  <DateTimeInput
                    label={t("proposals.dateStartLabel")}
                    placeholder={t("proposals.datePlaceholder")}
                    value={dateStart}
                    onChange={setDateStart}
                  />
                </View>
                <View className="flex-1">
                  <DateTimeInput
                    label={t("proposals.dateEndLabel")}
                    placeholder={t("proposals.datePlaceholder")}
                    value={dateEnd}
                    onChange={setDateEnd}
                  />
                </View>
              </View>
            </Section>

            <Section
              title={t("proposals.sectionMedia")}
              badge={mediaBadge}
              expanded={mediaOpen}
              onToggle={() => setMediaOpen((v) => !v)}
            >
              <View>
                <View className="flex-row items-center justify-between mb-1.5">
                  <Text variant="label">{t("proposals.imagesLabel")}</Text>
                  <Pressable
                    onPress={addImage}
                    hitSlop={8}
                    className="flex-row items-center"
                    style={{ gap: 4 }}
                  >
                    <Ionicons name="add" size={16} color="#6050DC" />
                    <Text
                      style={{
                        color: "#6050DC",
                        fontWeight: "600",
                        fontSize: 13,
                      }}
                    >
                      {t("proposals.addImage")}
                    </Text>
                  </Pressable>
                </View>
                {images.length === 0 ? (
                  <Text variant="caption" style={{ fontSize: 12 }}>
                    {t("proposals.imagesEmpty")}
                  </Text>
                ) : (
                  images.map((url, idx) => (
                    <View key={idx} className="mb-3" style={{ gap: 6 }}>
                      <View
                        className="flex-row items-center"
                        style={{ gap: 8 }}
                      >
                        <View className="flex-1">
                          <TextInput
                            value={url}
                            onChangeText={(v) => updateImage(idx, v)}
                            placeholder={t("proposals.imageUrlPlaceholder")}
                            placeholderTextColor="#9ca3af"
                            autoCapitalize="none"
                            keyboardType="url"
                            className="w-full px-4 py-3 rounded-lg border bg-surface text-base text-foreground border-border"
                          />
                        </View>
                        <Pressable
                          onPress={() => removeImage(idx)}
                          hitSlop={8}
                          className="items-center justify-center rounded-full"
                          style={{
                            width: 30,
                            height: 30,
                            backgroundColor: "#FEE2E2",
                          }}
                        >
                          <Ionicons name="close" size={16} color="#991B1B" />
                        </Pressable>
                      </View>
                      {looksLikeUrl(url) ? (
                        <Image
                          source={{ uri: url.trim() }}
                          style={{
                            width: "100%",
                            height: 120,
                            borderRadius: 10,
                            backgroundColor: "#EEECFC",
                          }}
                          resizeMode="cover"
                        />
                      ) : null}
                    </View>
                  ))
                )}
              </View>

              <View>
                <View className="flex-row items-center justify-between mb-1.5">
                  <Text variant="label">{t("proposals.linksLabel")}</Text>
                  <Pressable
                    onPress={addLink}
                    hitSlop={8}
                    className="flex-row items-center"
                    style={{ gap: 4 }}
                  >
                    <Ionicons name="add" size={16} color="#6050DC" />
                    <Text
                      style={{
                        color: "#6050DC",
                        fontWeight: "600",
                        fontSize: 13,
                      }}
                    >
                      {t("proposals.addLink")}
                    </Text>
                  </Pressable>
                </View>
                {links.length === 0 ? (
                  <Text variant="caption" style={{ fontSize: 12 }}>
                    {t("proposals.linksEmpty")}
                  </Text>
                ) : (
                  links.map((l, idx) => (
                    <View key={idx} className="mb-2" style={{ gap: 6 }}>
                      <View
                        className="flex-row items-center"
                        style={{ gap: 8 }}
                      >
                        <View className="flex-1">
                          <TextInput
                            value={l.label}
                            onChangeText={(v) =>
                              updateLink(idx, { label: v })
                            }
                            placeholder={t(
                              "proposals.linkLabelPlaceholder",
                            )}
                            placeholderTextColor="#9ca3af"
                            className="w-full px-4 py-2.5 rounded-lg border bg-surface text-base text-foreground border-border"
                          />
                        </View>
                        <Pressable
                          onPress={() => removeLink(idx)}
                          hitSlop={8}
                          className="items-center justify-center rounded-full"
                          style={{
                            width: 30,
                            height: 30,
                            backgroundColor: "#FEE2E2",
                          }}
                        >
                          <Ionicons name="close" size={16} color="#991B1B" />
                        </Pressable>
                      </View>
                      <TextInput
                        value={l.url}
                        onChangeText={(v) => updateLink(idx, { url: v })}
                        placeholder={t("proposals.linkUrlPlaceholder")}
                        placeholderTextColor="#9ca3af"
                        autoCapitalize="none"
                        keyboardType="url"
                        className="w-full px-4 py-2.5 rounded-lg border bg-surface text-base text-foreground border-border"
                      />
                    </View>
                  ))
                )}
              </View>
            </Section>

            {error ? (
              <Text className="text-error text-sm">{error}</Text>
            ) : null}
          </ScrollView>

          <View className="px-5 pb-5 pt-2" style={{ gap: 8 }}>
            <Button
              variant="cta"
              size="lg"
              label={busy ? t("proposals.saving") : t("proposals.save")}
              onPress={save}
              disabled={busy || !title.trim()}
            />
            {mode === "edit" ? (
              <Pressable
                onPress={confirmDelete}
                disabled={busy}
                className="py-3 items-center"
                style={{ opacity: busy ? 0.5 : 1 }}
              >
                <Text
                  variant="label"
                  style={{ color: "#EF4444", fontWeight: "600" }}
                >
                  {t("proposals.delete")}
                </Text>
              </Pressable>
            ) : null}
            <Button
              variant="ghost"
              label={t("proposals.cancel")}
              onPress={onClose}
              disabled={busy}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
