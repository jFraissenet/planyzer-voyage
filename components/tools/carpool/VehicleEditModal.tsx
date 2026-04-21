import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Avatar, Button, DateTimeInput, Input, Text } from "@/components/ui";
import {
  createRoundTripVehicles,
  createVehicle,
  LAYOUT_OPTIONS,
  layoutTotal,
  parseLayout,
  updateVehicle,
  type Vehicle,
  type VehicleSeat,
  type VehicleStop,
} from "@/lib/carpool";
import type { EffectiveMember } from "@/lib/expenses";
import { SeatLayoutPreview } from "./SeatLayout";

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

function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function parseDateInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes("T")
    ? trimmed
    : trimmed.replace(" ", "T");
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

type CommonProps = {
  visible: boolean;
  toolId: string;
  members: EffectiveMember[];
  currentUserId: string;
  onClose: () => void;
  onSaved: () => void;
};

type Props = CommonProps &
  (
    | { mode: "create"; existing?: undefined; existingSeats?: undefined; existingStops?: undefined }
    | {
        mode: "edit";
        existing: Vehicle;
        existingSeats: VehicleSeat[];
        existingStops: VehicleStop[];
      }
  );

export function VehicleEditModal(props: Props) {
  const { t } = useTranslation();
  const { visible, toolId, members, currentUserId, onClose, onSaved } = props;
  const isEdit = props.mode === "edit";

  const [driverId, setDriverId] = useState(currentUserId);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [arrivalLocation, setArrivalLocation] = useState("");
  const [tripMode, setTripMode] = useState<
    "outbound" | "return" | "round_trip"
  >("outbound");
  const [returnDate, setReturnDate] = useState("");
  const [stops, setStops] = useState<string[]>([]);
  const [seatCount, setSeatCount] = useState(5);
  const [layout, setLayout] = useState(LAYOUT_OPTIONS[5][0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (props.mode === "edit") {
      const v = props.existing;
      const existingCount = v.seat_count;
      const existingLayout = v.seat_layout;
      setDriverId(props.existingSeats.find((s) => s.seat_index === 0)?.user_id ?? currentUserId);
      setDescription(v.description ?? "");
      setLocation(v.departure_location ?? "");
      setDate(isoToLocalInput(v.departure_date));
      setArrivalLocation(v.arrival_location ?? "");
      setTripMode(v.journey_type === "return" ? "return" : "outbound");
      setReturnDate("");
      setStops(props.existingStops.map((s) => s.label));
      setSeatCount(existingCount);
      setLayout(existingLayout);
    } else {
      setDriverId(currentUserId);
      setDescription("");
      setLocation("");
      setDate("");
      setArrivalLocation("");
      setTripMode("outbound");
      setReturnDate("");
      setStops([]);
      setSeatCount(5);
      setLayout(LAYOUT_OPTIONS[5][0]);
    }
    setError(null);
    setBusy(false);
  }, [visible, props, currentUserId]);

  const updateSeatCount = (n: number) => {
    setSeatCount(n);
    setLayout(LAYOUT_OPTIONS[n][0]);
  };

  const addStop = () => setStops((prev) => [...prev, ""]);
  const updateStop = (idx: number, value: string) =>
    setStops((prev) => prev.map((s, i) => (i === idx ? value : s)));
  const removeStop = (idx: number) =>
    setStops((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!isEdit && !driverId) {
      setError(t("carpool.errorDriverRequired"));
      return;
    }

    if (isEdit) {
      const newTotal = layoutTotal(layout);
      const maxOccupied = props.existingSeats.reduce(
        (max, s) => Math.max(max, s.seat_index),
        -1,
      );
      if (maxOccupied >= newTotal) {
        setError(
          t("carpool.errorReduceOccupied", {
            count: newTotal,
            index: maxOccupied + 1,
          }),
        );
        return;
      }
    }

    setError(null);
    setBusy(true);
    try {
      const dateIso = parseDateInput(date);
      const arrival = arrivalLocation.trim() || null;
      const departure = location.trim() || null;
      const cleanedStops = stops.filter((s) => s.trim().length > 0);
      if (isEdit) {
        await updateVehicle(props.existing.vehicle_id, {
          description: description.trim() || null,
          departure_location: departure,
          departure_date: dateIso,
          arrival_location: arrival,
          seat_count: seatCount,
          seat_layout: layout,
          stops: cleanedStops,
        });
      } else if (tripMode === "round_trip") {
        const returnIso = parseDateInput(returnDate);
        await createRoundTripVehicles({
          tool_id: toolId,
          driver_user_id: driverId,
          description: description.trim() || null,
          outbound_location: departure,
          outbound_date: dateIso,
          arrival_location: arrival,
          return_date: returnIso,
          seat_count: seatCount,
          seat_layout: layout,
          stops: cleanedStops,
        });
      } else {
        await createVehicle({
          tool_id: toolId,
          driver_user_id: driverId,
          description: description.trim() || null,
          departure_location: departure,
          departure_date: dateIso,
          arrival_location: arrival,
          seat_count: seatCount,
          seat_layout: layout,
          stops: cleanedStops,
          journey_type: tripMode,
        });
      }
      onSaved();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("vehicle save failed:", err);
      setError(t("carpool.errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  const currentDriver = members.find((m) => m.user_id === driverId);

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
            <Text variant="h2" className="mb-4">
              {isEdit ? t("carpool.editVehicle") : t("carpool.newVehicle")}
            </Text>

            <SectionLabel>{t("carpool.driverField")}</SectionLabel>
            {isEdit ? (
              <View
                className="flex-row items-center p-3 rounded-xl mb-5"
                style={{ backgroundColor: "#EEECFC" }}
              >
                <Avatar
                  src={currentDriver?.avatar_url ?? undefined}
                  initials={initialsOf(currentDriver?.full_name ?? null)}
                  size="sm"
                  className="mr-3"
                />
                <Text
                  className="flex-1"
                  style={{ color: "#4F3FD1", fontWeight: "700" }}
                >
                  {currentDriver?.full_name ?? "?"}
                </Text>
              </View>
            ) : (
              <View className="gap-2 mb-5">
                {members.map((m) => {
                  const selected = driverId === m.user_id;
                  return (
                    <Pressable
                      key={m.user_id}
                      onPress={() => setDriverId(m.user_id)}
                      className={`flex-row items-center p-3 rounded-xl border ${
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-surface"
                      }`}
                    >
                      <Avatar
                        src={m.avatar_url ?? undefined}
                        initials={initialsOf(m.full_name)}
                        size="sm"
                        className="mr-3"
                      />
                      <Text className="flex-1">{m.full_name ?? "?"}</Text>
                      {selected ? (
                        <Text style={{ color: "#6050DC", fontWeight: "700" }}>
                          ✓
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            )}

            <View className="gap-3 mb-5">
              <Input
                label={t("carpool.description")}
                placeholder={t("carpool.descriptionPlaceholder")}
                value={description}
                onChangeText={setDescription}
              />
              <Input
                label={t("carpool.departureLocation")}
                placeholder={t("carpool.departureLocationPlaceholder")}
                value={location}
                onChangeText={setLocation}
              />
              <DateTimeInput
                label={t("carpool.departureDate")}
                placeholder="AAAA-MM-JJ HH:MM"
                value={date}
                onChange={setDate}
              />
              <Input
                label={t("carpool.arrivalLocation")}
                placeholder={t("carpool.arrivalLocationPlaceholder")}
                value={arrivalLocation}
                onChangeText={setArrivalLocation}
              />
            </View>

            {!isEdit ? (
              <>
                <SectionLabel>{t("carpool.tripType")}</SectionLabel>
                <View className="flex-row mb-5" style={{ gap: 8 }}>
                  {(
                    [
                      { value: "outbound", label: t("carpool.tripOutbound") },
                      { value: "return", label: t("carpool.tripReturn") },
                      {
                        value: "round_trip",
                        label: t("carpool.tripRoundTrip"),
                      },
                    ] as const
                  ).map((opt) => {
                    const active = tripMode === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => setTripMode(opt.value)}
                        className="flex-1 rounded-xl items-center py-3 px-1"
                        style={{
                          backgroundColor: active ? "#6050DC" : "#EEECFC",
                        }}
                      >
                        <Text
                          variant="label"
                          numberOfLines={1}
                          style={{
                            color: active ? "#FFFFFF" : "#6050DC",
                            fontWeight: "700",
                            fontSize: 13,
                          }}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {tripMode === "round_trip" ? (
                  <View className="mb-5">
                    <DateTimeInput
                      label={t("carpool.returnDate")}
                      placeholder="AAAA-MM-JJ HH:MM"
                      value={returnDate}
                      onChange={setReturnDate}
                    />
                  </View>
                ) : null}
              </>
            ) : null}

            <SectionLabel>{t("carpool.stops")}</SectionLabel>
            <View className="gap-2 mb-5">
              {stops.map((s, idx) => (
                <View
                  key={idx}
                  className="flex-row items-center"
                  style={{ gap: 8 }}
                >
                  <View className="flex-1">
                    <Input
                      placeholder={t("carpool.stopPlaceholder")}
                      value={s}
                      onChangeText={(v) => updateStop(idx, v)}
                    />
                  </View>
                  <Pressable
                    onPress={() => removeStop(idx)}
                    hitSlop={6}
                    className="items-center justify-center"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: "#F2EDE4",
                    }}
                  >
                    <Ionicons name="close" size={18} color="#A3A3A3" />
                  </Pressable>
                </View>
              ))}
              <Pressable
                onPress={addStop}
                className="self-start px-3 py-1.5 rounded-full"
                style={{ backgroundColor: "#EEECFC" }}
              >
                <Text
                  variant="label"
                  style={{ color: "#6050DC", fontWeight: "700" }}
                >
                  + {t("carpool.addStop")}
                </Text>
              </Pressable>
            </View>

            <SectionLabel>{t("carpool.seatCount")}</SectionLabel>
            <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
              {Array.from({ length: 9 }).map((_, i) => {
                const n = i + 2;
                const active = seatCount === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => updateSeatCount(n)}
                    className="rounded-full items-center justify-center"
                    style={{
                      width: 44,
                      height: 44,
                      backgroundColor: active ? "#6050DC" : "#EEECFC",
                    }}
                  >
                    <Text
                      variant="label"
                      style={{
                        color: active ? "#FFFFFF" : "#6050DC",
                        fontWeight: "700",
                      }}
                    >
                      {n}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <SectionLabel>{t("carpool.seatLayout")}</SectionLabel>
            <View className="flex-row flex-wrap mb-5" style={{ gap: 12 }}>
              {LAYOUT_OPTIONS[seatCount].map((opt) => {
                const active = layout === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => setLayout(opt)}
                    className="rounded-2xl p-4 items-center"
                    style={{
                      borderWidth: 1.5,
                      borderColor: active ? "#6050DC" : "#E8E3DB",
                      backgroundColor: active ? "#EEECFC" : "#FFFFFF",
                      minWidth: 96,
                    }}
                  >
                    <SeatLayoutPreview layout={opt} seatSize={16} gap={6} />
                    <Text
                      variant="caption"
                      className="mt-2"
                      style={{
                        color: active ? "#6050DC" : "#525252",
                        fontWeight: "700",
                      }}
                    >
                      {parseLayout(opt).join("-")}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {error ? (
              <View
                className="rounded-2xl p-3 mb-3"
                style={{
                  backgroundColor: "#FEE2E2",
                  borderWidth: 1,
                  borderColor: "#FECACA",
                }}
              >
                <Text
                  variant="label"
                  style={{ color: "#B91C1C", fontSize: 13, lineHeight: 18 }}
                >
                  {error}
                </Text>
              </View>
            ) : null}

            <View className="gap-2">
              <Button
                variant="cta"
                size="lg"
                label={
                  busy
                    ? isEdit
                      ? t("carpool.saving")
                      : t("carpool.creating")
                    : isEdit
                      ? t("carpool.save")
                      : t("carpool.create")
                }
                onPress={handleSubmit}
                disabled={busy}
              />
              <Button
                variant="ghost"
                label={t("carpool.cancel")}
                onPress={onClose}
                disabled={busy}
              />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
