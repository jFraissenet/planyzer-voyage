import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Avatar, Button, Input, Text, useToast } from "@/components/ui";
import {
  addSeatLabel,
  addSeatUser,
  deleteVehicle,
  listVehicleSeats,
  listVehicleStops,
  removeSeat,
  type Vehicle,
  type VehicleSeat,
  type VehicleStop,
} from "@/lib/carpool";
import type { EffectiveMember } from "@/lib/expenses";
import {
  buildMapsUrlFromText,
  buildTripMapsUrl,
  shortenAddress,
} from "@/lib/geocoding";
import { useIsMobile } from "@/lib/responsive";
import { SeatLayoutInteractive, type SeatState } from "./SeatLayout";
import { VehicleEditModal } from "./VehicleEditModal";

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

function formatDate(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type SeatPickerMode = "assignMe" | "assignMember" | "assignLabel" | null;

type Props = {
  visible: boolean;
  vehicle: Vehicle | null;
  members: EffectiveMember[];
  currentUserId: string;
  locale: string;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
};

export function VehicleDetailModal({
  visible,
  vehicle,
  members,
  currentUserId,
  locale,
  onClose,
  onChanged,
  onDeleted,
}: Props) {
  const { t } = useTranslation();
  const { show: showToast } = useToast();
  const isMobile = useIsMobile();
  const titlePencilSize = isMobile ? 14 : 18;
  const journeyIconSize = isMobile ? 11 : 14;
  const [seats, setSeats] = useState<VehicleSeat[]>([]);
  const [stops, setStops] = useState<VehicleStop[]>([]);
  const [activeSeatIndex, setActiveSeatIndex] = useState<number | null>(null);
  const [pickerMode, setPickerMode] = useState<SeatPickerMode>(null);
  const [customLabel, setCustomLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    if (!vehicle) return;
    try {
      const [s, st] = await Promise.all([
        listVehicleSeats(vehicle.vehicle_id),
        listVehicleStops(vehicle.vehicle_id),
      ]);
      setSeats(s);
      setStops(st);
    } catch {
      setSeats([]);
      setStops([]);
    }
  }, [vehicle]);

  useEffect(() => {
    if (visible) {
      setActiveSeatIndex(null);
      setPickerMode(null);
      setCustomLabel("");
      load();
    }
  }, [visible, load]);

  if (!vehicle) return null;

  const driverSeat = seats.find((s) => s.seat_index === 0);
  const isDriver = driverSeat?.user_id === currentUserId;
  const isCreator = vehicle.created_by === currentUserId;
  const canDeleteVehicle = isDriver || isCreator;
  const canEditVehicle = isDriver || isCreator;
  const canModifyAnySeat = isDriver || isCreator;

  const memberIds = new Set(seats.map((s) => s.user_id).filter(Boolean));
  const availableMembers = members.filter((m) => !memberIds.has(m.user_id));

  const handleSeatPress = (state: SeatState) => {
    if (state.kind === "empty") {
      setActiveSeatIndex(state.index);
      setPickerMode(null);
      setCustomLabel("");
      return;
    }
    // Filled: check permissions to remove
    const seat = state.seat;
    const canRemove =
      canModifyAnySeat ||
      seat.user_id === currentUserId ||
      seat.added_by === currentUserId;
    if (!canRemove) return;
    confirmRemoveSeat(seat.seat_index);
  };

  const confirmRemoveSeat = (seatIndex: number) => {
    const msg = t("carpool.removeSeatConfirm");
    const run = async () => {
      setBusy(true);
      try {
        await removeSeat(vehicle.vehicle_id, seatIndex);
        await load();
        onChanged();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("removeSeat failed:", err);
      } finally {
        setBusy(false);
      }
    };
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (window.confirm(msg)) void run();
      return;
    }
    Alert.alert(msg, undefined, [
      { text: t("carpool.cancel"), style: "cancel" },
      {
        text: t("carpool.removeSeat"),
        style: "destructive",
        onPress: () => void run(),
      },
    ]);
  };

  const handleSeatConflict = async () => {
    showToast(t("carpool.seatConflict"), { variant: "info", duration: 3000 });
    setActiveSeatIndex(null);
    setPickerMode(null);
    setCustomLabel("");
    await load();
    onChanged();
  };

  const assignMe = async () => {
    if (activeSeatIndex == null) return;
    setBusy(true);
    try {
      await addSeatUser(vehicle.vehicle_id, activeSeatIndex, currentUserId);
      setActiveSeatIndex(null);
      await load();
      onChanged();
    } catch {
      await handleSeatConflict();
    } finally {
      setBusy(false);
    }
  };

  const assignMember = async (userId: string) => {
    if (activeSeatIndex == null) return;
    setBusy(true);
    try {
      await addSeatUser(vehicle.vehicle_id, activeSeatIndex, userId);
      setActiveSeatIndex(null);
      setPickerMode(null);
      await load();
      onChanged();
    } catch {
      await handleSeatConflict();
    } finally {
      setBusy(false);
    }
  };

  const assignLabel = async () => {
    if (activeSeatIndex == null) return;
    const label = customLabel.trim();
    if (!label) return;
    setBusy(true);
    try {
      await addSeatLabel(vehicle.vehicle_id, activeSeatIndex, label);
      setActiveSeatIndex(null);
      setPickerMode(null);
      setCustomLabel("");
      await load();
      onChanged();
    } catch {
      await handleSeatConflict();
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteVehicle = () => {
    const msg = t("carpool.deleteConfirm");
    const run = async () => {
      setBusy(true);
      try {
        await deleteVehicle(vehicle.vehicle_id);
        onDeleted();
      } finally {
        setBusy(false);
      }
    };
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (window.confirm(msg)) void run();
      return;
    }
    Alert.alert(msg, undefined, [
      { text: t("carpool.cancel"), style: "cancel" },
      {
        text: t("carpool.delete"),
        style: "destructive",
        onPress: () => void run(),
      },
    ]);
  };

  const departureDate = formatDate(vehicle.departure_date, locale);

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
          style={{ maxHeight: "92%" }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View
              className="flex-row items-center self-start px-2 py-0.5 rounded-full mb-2"
              style={{ backgroundColor: "#FEF3C7", gap: 4 }}
            >
              <Text
                style={{
                  color: "#78350F",
                  fontWeight: "700",
                  fontSize: 11,
                }}
              >
                {vehicle.journey_type === "outbound"
                  ? `→ ${t("carpool.journeyOutbound")}`
                  : `← ${t("carpool.journeyReturn")}`}
              </Text>
              {vehicle.linked_vehicle_id ? (
                <Ionicons name="link" size={journeyIconSize} color="#78350F" />
              ) : null}
            </View>
            {canEditVehicle ? (
              <Pressable
                onPress={() => setEditOpen(true)}
                hitSlop={8}
                accessibilityLabel={t("carpool.editAction")}
                className="flex-row items-center mb-1 active:opacity-70"
                style={{ gap: 6 }}
              >
                <Text variant="h2" className="flex-1">
                  {vehicle.description ?? t("carpool.editTitle")}
                </Text>
                <Ionicons name="pencil" size={titlePencilSize} color="#78350F" />
              </Pressable>
            ) : (
              <Text variant="h2" className="mb-1">
                {vehicle.description ?? t("carpool.editTitle")}
              </Text>
            )}
            <Text variant="caption" className="mb-4">
              {t("carpool.drivenBy", {
                name: vehicle.driver_full_name ?? "?",
              })}
            </Text>

            {vehicle.departure_location ||
            vehicle.arrival_location ||
            departureDate ? (
              <View className="mb-4" style={{ gap: 4 }}>
                {vehicle.departure_location || vehicle.arrival_location ? (
                  <Pressable
                    onPress={() => {
                      const url =
                        buildTripMapsUrl(
                          vehicle.departure_location,
                          vehicle.arrival_location,
                        ) ||
                        vehicle.departure_location_url ||
                        vehicle.arrival_location_url ||
                        (vehicle.departure_location
                          ? buildMapsUrlFromText(vehicle.departure_location)
                          : null);
                      if (url) Linking.openURL(url).catch(() => undefined);
                    }}
                    hitSlop={4}
                    className="active:opacity-70"
                  >
                    <Text>
                      📍{" "}
                      <Text variant="label">
                        {vehicle.departure_location
                          ? shortenAddress(vehicle.departure_location)
                          : "?"}
                        {vehicle.arrival_location
                          ? ` → ${shortenAddress(vehicle.arrival_location)}`
                          : ""}
                      </Text>
                    </Text>
                  </Pressable>
                ) : null}
                {departureDate ? (
                  <Text>
                    🕐 <Text variant="label">{departureDate}</Text>
                  </Text>
                ) : null}
              </View>
            ) : null}

            {stops.length > 0 ? (
              <View className="mb-5">
                <Text variant="caption" className="mb-1">
                  {t("carpool.stops")} :
                </Text>
                <View style={{ gap: 2 }}>
                  {stops.map((s) => (
                    <Text key={s.stop_id} variant="label">
                      · {s.label}
                    </Text>
                  ))}
                </View>
              </View>
            ) : null}

            <View className="mb-4">
              <SeatLayoutInteractive
                layout={vehicle.seat_layout}
                seats={seats}
                onSeatPress={handleSeatPress}
                activeIndex={activeSeatIndex}
              />
            </View>

            {/* Seat action sheet */}
            {activeSeatIndex != null ? (
              <View
                className="rounded-2xl p-4 mb-4"
                style={{
                  backgroundColor: "#EEECFC",
                }}
              >
                <Text
                  variant="label"
                  className="mb-3"
                  style={{ color: "#4F3FD1", fontWeight: "700" }}
                >
                  {t("carpool.seat.title")}
                </Text>

                {pickerMode === null ? (
                  <View style={{ gap: 8 }}>
                    {!memberIds.has(currentUserId) ? (
                      <Button
                        label={t("carpool.seat.pickMe")}
                        onPress={assignMe}
                        disabled={busy}
                      />
                    ) : null}
                    <Button
                      variant="outline"
                      label={t("carpool.seat.pickMember")}
                      onPress={() => setPickerMode("assignMember")}
                      disabled={busy}
                    />
                    <Button
                      variant="outline"
                      label={t("carpool.seat.pickCustom")}
                      onPress={() => setPickerMode("assignLabel")}
                      disabled={busy}
                    />
                    <Button
                      variant="ghost"
                      label={t("carpool.cancel")}
                      onPress={() => setActiveSeatIndex(null)}
                      disabled={busy}
                    />
                  </View>
                ) : pickerMode === "assignMember" ? (
                  <View style={{ gap: 6 }}>
                    {availableMembers.length === 0 ? (
                      <Text variant="caption">—</Text>
                    ) : (
                      availableMembers.map((m) => (
                        <Pressable
                          key={m.user_id}
                          onPress={() => assignMember(m.user_id)}
                          disabled={busy}
                          className="flex-row items-center p-2 rounded-lg"
                          style={{
                            backgroundColor: "#FFFFFF",
                            opacity: busy ? 0.5 : 1,
                          }}
                        >
                          <Avatar
                            src={m.avatar_url ?? undefined}
                            initials={initialsOf(m.full_name)}
                            size="sm"
                            className="mr-2"
                          />
                          <Text className="flex-1">{m.full_name ?? "?"}</Text>
                        </Pressable>
                      ))
                    )}
                    <Button
                      variant="ghost"
                      label={t("carpool.cancel")}
                      onPress={() => setPickerMode(null)}
                      disabled={busy}
                    />
                  </View>
                ) : (
                  <View style={{ gap: 8 }}>
                    <Input
                      label={t("carpool.seat.customLabel")}
                      placeholder={t("carpool.seat.customPlaceholder")}
                      value={customLabel}
                      onChangeText={setCustomLabel}
                      autoFocus
                    />
                    <Button
                      label={t("carpool.save")}
                      onPress={assignLabel}
                      disabled={busy || !customLabel.trim()}
                    />
                    <Button
                      variant="ghost"
                      label={t("carpool.cancel")}
                      onPress={() => setPickerMode(null)}
                      disabled={busy}
                    />
                  </View>
                )}
              </View>
            ) : null}

            {canDeleteVehicle ? (
              <Pressable
                onPress={confirmDeleteVehicle}
                disabled={busy}
                className="py-3 items-center"
                style={{ opacity: busy ? 0.5 : 1 }}
              >
                <Text
                  variant="label"
                  style={{ color: "#EF4444", fontWeight: "600" }}
                >
                  {t("carpool.delete")}
                </Text>
              </Pressable>
            ) : null}

            <Button
              variant="ghost"
              label={t("carpool.cancel")}
              onPress={onClose}
              disabled={busy}
            />
          </ScrollView>
        </Pressable>
      </Pressable>

      <VehicleEditModal
        mode="edit"
        visible={editOpen}
        toolId={""}
        members={members}
        currentUserId={currentUserId}
        existing={vehicle}
        existingSeats={seats}
        existingStops={stops}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          load();
          onChanged();
        }}
      />
    </Modal>
  );
}
