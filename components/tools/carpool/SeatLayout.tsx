import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Avatar, Text } from "@/components/ui";
import { parseLayout, type VehicleSeat } from "@/lib/carpool";

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

type SeatState =
  | { kind: "empty"; index: number }
  | { kind: "driver"; index: number; seat: VehicleSeat }
  | { kind: "user"; index: number; seat: VehicleSeat }
  | { kind: "label"; index: number; seat: VehicleSeat };

function deriveSeats(
  layout: string,
  seatsByIndex: Map<number, VehicleSeat>,
): SeatState[] {
  const rows = parseLayout(layout);
  const total = rows.reduce((a, b) => a + b, 0);
  const result: SeatState[] = [];
  for (let i = 0; i < total; i++) {
    const s = seatsByIndex.get(i);
    if (!s) result.push({ kind: "empty", index: i });
    else if (i === 0) result.push({ kind: "driver", index: i, seat: s });
    else if (s.user_id) result.push({ kind: "user", index: i, seat: s });
    else result.push({ kind: "label", index: i, seat: s });
  }
  return result;
}

function Seat({
  state,
  size = 68,
  onPress,
  pressable,
  selected = false,
}: {
  state: SeatState;
  size?: number;
  onPress?: () => void;
  pressable?: boolean;
  selected?: boolean;
}) {
  const isEmpty = state.kind === "empty";
  const isDriver = state.kind === "driver";
  const bg = isEmpty ? "#FFFFFF" : isDriver ? "#FEF3C7" : "#EEECFC";
  const borderColor = isEmpty ? "#E8E3DB" : isDriver ? "#FDE68A" : "#DDD6FE";
  const labelColor = isDriver ? "#78350F" : "#4F3FD1";

  const renderContent = (active: boolean) => {
    if (isEmpty) {
      return (
        <Ionicons
          name="add"
          size={Math.round(size * 0.45)}
          color={active ? "#FFFFFF" : "#6050DC"}
        />
      );
    }
    if (state.kind === "driver" || state.kind === "user") {
      return (
        <Avatar
          src={state.seat.avatar_url ?? undefined}
          initials={initialsOf(state.seat.full_name)}
          size="sm"
        />
      );
    }
    return (
      <Ionicons
        name="paw-outline"
        size={Math.round(size * 0.4)}
        color={labelColor}
      />
    );
  };

  const captionText =
    state.kind === "empty"
      ? null
      : state.kind === "label"
        ? state.seat.label
        : state.seat.full_name;

  const renderSeat = (pressed: boolean) => {
    const active = pressed || selected;
    return (
      <View className="items-center" style={{ width: size }}>
        <View
          className="items-center justify-center"
          style={{
            width: size,
            height: size,
            borderRadius: size / 2.2,
            backgroundColor: active && isEmpty ? "#6050DC" : bg,
            borderWidth: active ? 2.5 : 1.5,
            borderColor: active ? "#6050DC" : borderColor,
            transform: [{ scale: pressed ? 0.92 : 1 }],
          }}
        >
          {renderContent(active)}
        </View>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 11,
            color: labelColor,
            fontWeight: "600",
            marginTop: 4,
            textAlign: "center",
            maxWidth: size,
          }}
        >
          {captionText ?? ""}
        </Text>
      </View>
    );
  };

  if (!pressable || !onPress) return renderSeat(false);
  return (
    <Pressable onPress={onPress} hitSlop={6}>
      {({ pressed }) => renderSeat(pressed)}
    </Pressable>
  );
}

export function SeatLayoutPreview({
  layout,
  seatSize = 32,
  gap = 8,
}: {
  layout: string;
  seatSize?: number;
  gap?: number;
}) {
  const rows = parseLayout(layout);
  return (
    <View style={{ gap }}>
      {rows.map((count, rowIdx) => (
        <View
          key={rowIdx}
          className="flex-row justify-center"
          style={{ gap }}
        >
          {Array.from({ length: count }).map((_, i) => (
            <View
              key={i}
              style={{
                width: seatSize,
                height: seatSize,
                borderRadius: seatSize / 2.2,
                backgroundColor:
                  rowIdx === 0 && i === 0 ? "#FEF3C7" : "#EEECFC",
                borderWidth: 1.5,
                borderColor:
                  rowIdx === 0 && i === 0 ? "#FDE68A" : "#DDD6FE",
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export function SeatLayoutInteractive({
  layout,
  seats,
  onSeatPress,
  activeIndex,
}: {
  layout: string;
  seats: VehicleSeat[];
  onSeatPress: (state: SeatState) => void;
  activeIndex?: number | null;
}) {
  const rows = parseLayout(layout);
  const seatsByIndex = new Map(seats.map((s) => [s.seat_index, s]));
  const flat = deriveSeats(layout, seatsByIndex);

  let cursor = 0;
  return (
    <View style={{ gap: 14 }}>
      {rows.map((count, rowIdx) => {
        const rowSeats = flat.slice(cursor, cursor + count);
        cursor += count;
        return (
          <View
            key={rowIdx}
            className="flex-row justify-center"
            style={{ gap: 14 }}
          >
            {rowSeats.map((state) => (
              <Seat
                key={state.index}
                state={state}
                pressable
                selected={activeIndex === state.index}
                onPress={() => onSeatPress(state)}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}

export type { SeatState };
