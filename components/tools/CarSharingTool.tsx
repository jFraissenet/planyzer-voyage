import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
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
  onPress,
  onEdit,
}: {
  vehicle: Vehicle;
  locale: string;
  onPress: () => void;
  onEdit: (() => void) | null;
}) {
  const { t } = useTranslation();
  const total = layoutTotal(vehicle.seat_layout);
  const free = Math.max(0, total - vehicle.occupied_count);
  const departureDate = formatDate(vehicle.departure_date, locale);
  const isFull = free === 0;

  return (
    <Card className="mb-3 overflow-hidden p-0">
      <View className="flex-row items-stretch">
        <Pressable
          onPress={onPress}
          className="flex-1 flex-row items-center p-4 active:opacity-90"
        >
          <Avatar
            src={vehicle.driver_avatar_url ?? undefined}
            initials={initialsOf(vehicle.driver_full_name)}
            size="md"
            className="mr-3"
          />
          <View className="flex-1 pr-2">
            <Text
              numberOfLines={1}
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: "#1A1A1A",
              }}
            >
              {vehicle.description ?? vehicle.driver_full_name ?? "—"}
            </Text>
            <Text variant="caption" numberOfLines={1}>
              {t("carpool.drivenBy", {
                name: vehicle.driver_full_name ?? "?",
              })}
            </Text>
            {vehicle.departure_location || vehicle.arrival_location ? (
              <Text variant="caption" numberOfLines={1} className="mt-0.5">
                {vehicle.departure_location ?? "?"}
                {vehicle.arrival_location
                  ? ` → ${vehicle.arrival_location}`
                  : ""}
              </Text>
            ) : null}
            {departureDate ? (
              <Text variant="caption" numberOfLines={1}>
                {departureDate}
              </Text>
            ) : null}
          </View>
          <View className="items-end ml-2" style={{ gap: 6 }}>
            <SeatLayoutPreview
              layout={vehicle.seat_layout}
              seatSize={10}
              gap={3}
            />
            <Text
              variant="caption"
              style={{
                color: isFull ? "#A3A3A3" : "#6050DC",
                fontWeight: "700",
                fontSize: 11,
              }}
            >
              {isFull
                ? t("carpool.fullVehicle")
                : t("carpool.seatSummary", { free, total })}
            </Text>
            <View
              className="flex-row items-center justify-center self-center px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "#FEF3C7", gap: 3 }}
            >
              <Text
                style={{
                  color: "#78350F",
                  fontWeight: "700",
                  fontSize: 10,
                  textAlign: "center",
                }}
              >
                {vehicle.journey_type === "outbound"
                  ? `→ ${t("carpool.journeyOutbound")}`
                  : `← ${t("carpool.journeyReturn")}`}
              </Text>
              {vehicle.linked_vehicle_id ? (
                <Ionicons name="link" size={10} color="#78350F" />
              ) : null}
            </View>
          </View>
        </Pressable>
        {onEdit ? (
          <Pressable
            onPress={onEdit}
            hitSlop={6}
            accessibilityLabel={t("carpool.editAction")}
            className="items-center justify-center active:opacity-70"
            style={{
              width: 52,
              borderLeftWidth: 1,
              borderLeftColor: "#E8E3DB",
            }}
          >
            <View
              className="items-center justify-center rounded-full"
              style={{
                width: 32,
                height: 32,
                backgroundColor: "#EEECFC",
              }}
            >
              <Ionicons name="pencil" size={14} color="#6050DC" />
            </View>
          </Pressable>
        ) : null}
      </View>
    </Card>
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

  const myVehicles = useMemo(
    () => vehicles.filter((v) => mySeatVehicleIds.has(v.vehicle_id)),
    [vehicles, mySeatVehicleIds],
  );

  const statusLabel = useMemo(() => {
    if (myVehicles.length > 0) {
      const names = myVehicles
        .map((v) => v.description ?? v.driver_full_name ?? "—")
        .join(", ");
      return t("carpool.youAreIn", { vehicle: names });
    }
    return t("carpool.youAreNotIn");
  }, [myVehicles, t]);

  return (
    <>
      <ToolShell {...props}>
        <View
          className="rounded-2xl p-3 mb-5"
          style={{
            backgroundColor: myVehicles.length > 0 ? "#EEECFC" : "#FEF3C7",
          }}
        >
          <Text
            variant="label"
            style={{
              color: myVehicles.length > 0 ? "#4F3FD1" : "#78350F",
              fontWeight: "700",
            }}
          >
            {myVehicles.length > 0 ? "🚗 " : "👀 "}
            {statusLabel}
          </Text>
        </View>

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
