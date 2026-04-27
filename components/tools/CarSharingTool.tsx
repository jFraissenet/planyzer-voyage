import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Avatar, Card, FAB, Text } from "@/components/ui";
import {
  layoutTotal,
  listVehicles,
  listVehicleSeats,
  listVehicleStops,
  type Vehicle,
  type VehicleSeat,
  type VehicleStop,
} from "@/lib/carpool";
import { getEffectiveMembers, type EffectiveMember } from "@/lib/expenses";
import {
  buildMapsUrlFromText,
  buildTripMapsUrl,
  shortenAddress,
} from "@/lib/geocoding";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { SeatLayoutPreview } from "./carpool/SeatLayout";
import { VehicleDetailModal } from "./carpool/VehicleDetailModal";
import { VehicleEditModal } from "./carpool/VehicleEditModal";
import { ToolShell, type ToolProps } from "./ToolShell";

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

function VehicleCard({
  vehicle,
  locale,
  youAreIn,
  onPress,
  onEdit,
}: {
  vehicle: Vehicle;
  locale: string;
  youAreIn: boolean;
  onPress: () => void;
  onEdit: (() => void) | null;
}) {
  const { t } = useTranslation();
  const total = layoutTotal(vehicle.seat_layout);
  const free = Math.max(0, total - vehicle.occupied_count);
  const departureDate = formatDate(vehicle.departure_date, locale);
  const isFull = free === 0;

  const departureShort = vehicle.departure_location
    ? shortenAddress(vehicle.departure_location)
    : null;
  const arrivalShort = vehicle.arrival_location
    ? shortenAddress(vehicle.arrival_location)
    : null;
  const hasRoute = !!departureShort || !!arrivalShort;

  const openMaps = () => {
    // Prefer the precise URLs we captured when picking suggestions.
    const both =
      vehicle.departure_location_url && vehicle.arrival_location_url
        ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
            vehicle.departure_location ?? "",
          )}&destination=${encodeURIComponent(
            vehicle.arrival_location ?? "",
          )}`
        : null;
    const url =
      both ??
      buildTripMapsUrl(
        vehicle.departure_location,
        vehicle.arrival_location,
      ) ??
      (vehicle.departure_location_url ||
        vehicle.arrival_location_url ||
        (vehicle.departure_location
          ? buildMapsUrlFromText(vehicle.departure_location)
          : null));
    if (!url) return;
    Linking.openURL(url).catch(() => undefined);
  };

  const journeyLabel =
    vehicle.journey_type === "outbound"
      ? `→ ${t("carpool.journeyOutbound")}`
      : `← ${t("carpool.journeyReturn")}`;

  return (
    <View className="relative mb-3">
      {youAreIn ? (
        <View
          accessibilityLabel={t("carpool.youAreInBadge")}
          style={{
            position: "absolute",
            top: -6,
            left: 10,
            zIndex: 10,
            paddingHorizontal: 5,
            paddingVertical: 0.5,
            borderRadius: 7,
            backgroundColor: "#6050DC",
            borderWidth: 1.5,
            borderColor: "#FFFFFF",
            shadowColor: "#6050DC",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.35,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 8,
              fontWeight: "700",
              letterSpacing: 0.3,
            }}
          >
            {t("carpool.yourVehicle").toUpperCase()}
          </Text>
        </View>
      ) : null}
      <Card className="overflow-hidden p-0">
        <Pressable onPress={onPress} className="active:opacity-90">
        {/* Top: avatar + title + badges */}
        <View
          className="flex-row items-start"
          style={{
            paddingLeft: 14,
            paddingRight: 14,
            paddingTop: 14,
            paddingBottom: 10,
          }}
        >
          <Avatar
            src={vehicle.driver_avatar_url ?? undefined}
            initials={initialsOf(vehicle.driver_full_name)}
            size="md"
            className="mr-3"
          />
          <View className="flex-1 pt-0.5">
            <View
              className="flex-row items-center"
              style={{ gap: 6, marginBottom: 2 }}
            >
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontSize: 16,
                  fontWeight: "700",
                  color: "#1A1A1A",
                }}
              >
                {vehicle.description ?? vehicle.driver_full_name ?? "—"}
              </Text>
              <View
                className="flex-row items-center px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#FEF3C7", gap: 3 }}
              >
                <Text
                  style={{
                    color: "#78350F",
                    fontWeight: "700",
                    fontSize: 11,
                  }}
                >
                  {journeyLabel}
                </Text>
                {vehicle.linked_vehicle_id ? (
                  <Ionicons name="link" size={11} color="#78350F" />
                ) : null}
              </View>
              {onEdit ? (
                <Pressable
                  onPress={onEdit}
                  hitSlop={8}
                  accessibilityLabel={t("carpool.editAction")}
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
            <Text variant="caption" numberOfLines={1}>
              {t("carpool.drivenBy", {
                name: vehicle.driver_full_name ?? "?",
              })}
            </Text>
          </View>
        </View>

        {/* Middle: route + date */}
        {hasRoute || departureDate ? (
          <View
            style={{
              paddingHorizontal: 14,
              paddingBottom: 10,
              borderTopWidth: 1,
              borderTopColor: "#F2EDE4",
              paddingTop: 10,
              gap: 6,
            }}
          >
            {hasRoute ? (
              <Pressable
                onPress={openMaps}
                hitSlop={4}
                className="flex-row items-center active:opacity-70"
                style={{ gap: 8 }}
              >
                <Ionicons name="location" size={14} color="#6050DC" />
                <Text
                  className="flex-1"
                  numberOfLines={1}
                  style={{
                    fontSize: 13,
                    color: "#1A1A1A",
                    fontWeight: "600",
                  }}
                >
                  {departureShort ?? "?"}
                  {arrivalShort ? `  →  ${arrivalShort}` : ""}
                </Text>
                <Ionicons name="open-outline" size={12} color="#A3A3A3" />
              </Pressable>
            ) : null}
            {departureDate ? (
              <View
                className="flex-row items-center"
                style={{ gap: 8 }}
              >
                <Ionicons name="calendar" size={14} color="#6050DC" />
                <Text variant="caption" style={{ fontSize: 12 }}>
                  {departureDate}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Bottom: seats */}
        <View
          className="flex-row items-center"
          style={{
            paddingHorizontal: 14,
            paddingTop: 10,
            paddingBottom: 12,
            borderTopWidth: 1,
            borderTopColor: "#F2EDE4",
            gap: 10,
          }}
        >
          <SeatLayoutPreview
            layout={vehicle.seat_layout}
            seatSize={11}
            gap={3}
          />
          <Text
            style={{
              color: isFull ? "#A3A3A3" : "#6050DC",
              fontWeight: "700",
              fontSize: 12,
            }}
          >
            {isFull
              ? t("carpool.fullVehicle")
              : t("carpool.seatSummary", { free, total })}
          </Text>
        </View>
      </Pressable>
      </Card>
    </View>
  );
}

export function CarSharingTool(props: ToolProps) {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const currentUserId = session?.user?.id ?? "";
  const [members, setMembers] = useState<EffectiveMember[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [mySeatVehicleIds, setMySeatVehicleIds] = useState<Set<string>>(
    new Set(),
  );
  const [creating, setCreating] = useState(false);
  const [openVehicle, setOpenVehicle] = useState<Vehicle | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<{
    vehicle: Vehicle;
    seats: VehicleSeat[];
    stops: VehicleStop[];
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, v] = await Promise.all([
        getEffectiveMembers(props.tool.event_tool_id),
        listVehicles(props.tool.event_tool_id),
      ]);
      setMembers(m);
      setVehicles(v);

      if (v.length > 0 && currentUserId) {
        const { data: mine } = await supabase
          .from("event_tool_vehicle_seats")
          .select("event_tool_vehicle_seat_vehicle_id")
          .in(
            "event_tool_vehicle_seat_vehicle_id",
            v.map((vh) => vh.vehicle_id),
          )
          .eq("event_tool_vehicle_seat_user_id", currentUserId);
        setMySeatVehicleIds(
          new Set(
            (mine ?? []).map(
              (r) => r.event_tool_vehicle_seat_vehicle_id as string,
            ),
          ),
        );
      } else {
        setMySeatVehicleIds(new Set());
      }
    } catch {
      setMembers([]);
      setVehicles([]);
      setMySeatVehicleIds(new Set());
    }
  }, [props.tool.event_tool_id, currentUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const canEditVehicle = (v: Vehicle): boolean => {
    if (!currentUserId) return false;
    return v.driver_id === currentUserId || v.created_by === currentUserId;
  };

  const openEditVehicle = async (v: Vehicle) => {
    try {
      const [seats, stops] = await Promise.all([
        listVehicleSeats(v.vehicle_id),
        listVehicleStops(v.vehicle_id),
      ]);
      setEditingVehicle({ vehicle: v, seats, stops });
    } catch {
      // ignore
    }
  };

  return (
    <>
      <ToolShell {...props}>
        {vehicles.length === 0 ? (
          <View className="py-10 items-center">
            <Text variant="caption">{t("carpool.empty")}</Text>
          </View>
        ) : (
          vehicles.map((v) => (
            <VehicleCard
              key={v.vehicle_id}
              vehicle={v}
              locale={i18n.language}
              youAreIn={mySeatVehicleIds.has(v.vehicle_id)}
              onPress={() => setOpenVehicle(v)}
              onEdit={canEditVehicle(v) ? () => openEditVehicle(v) : null}
            />
          ))
        )}
      </ToolShell>

      <FAB
        icon="add"
        onPress={() => setCreating(true)}
        accessibilityLabel={t("carpool.addVehicle")}
      />

      <VehicleEditModal
        mode="create"
        visible={creating}
        toolId={props.tool.event_tool_id}
        members={members}
        currentUserId={currentUserId}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          load();
        }}
      />

      <VehicleDetailModal
        visible={!!openVehicle}
        vehicle={openVehicle}
        members={members}
        currentUserId={currentUserId}
        locale={i18n.language}
        onClose={() => setOpenVehicle(null)}
        onChanged={load}
        onDeleted={() => {
          setOpenVehicle(null);
          load();
        }}
      />

      {editingVehicle ? (
        <VehicleEditModal
          mode="edit"
          visible
          toolId={props.tool.event_tool_id}
          members={members}
          currentUserId={currentUserId}
          existing={editingVehicle.vehicle}
          existingSeats={editingVehicle.seats}
          existingStops={editingVehicle.stops}
          onClose={() => setEditingVehicle(null)}
          onSaved={() => {
            setEditingVehicle(null);
            load();
          }}
        />
      ) : null}
    </>
  );
}
