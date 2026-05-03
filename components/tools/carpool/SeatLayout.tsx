import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Avatar, Text } from "@/components/ui";
import { parseLayout, type VehicleSeat } from "@/lib/carpool";
import { theme } from "@/lib/theme";

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
  const bg = isEmpty ? "#FFFFFF" : isDriver ? "#FEF3C7" : theme.primarySoft;
  const borderColor = isEmpty ? "#E8E3DB" : isDriver ? "#FDE68A" : "#DDD6FE";
  const labelColor = isDriver ? "#78350F" : theme.primaryDeep;

  const renderContent = (active: boolean) => {
    if (isEmpty) {
      return (
        <Ionicons
          name="add"
          size={Math.round(size * 0.45)}
          color={active ? "#FFFFFF" : theme.primary}
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
            backgroundColor: active && isEmpty ? theme.primary : bg,
            borderWidth: active ? 2.5 : 1.5,
            borderColor: active ? theme.primary : borderColor,
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
  seats,
  currentUserId,
  seatSize = 32,
  gap = 8,
}: {
  layout: string;
  seats?: VehicleSeat[];
  currentUserId?: string;
  seatSize?: number;
  gap?: number;
}) {
  const rows = parseLayout(layout);
  const seatsByIndex = new Map((seats ?? []).map((s) => [s.seat_index, s]));
  let cursor = 0;
  return (
    <View style={{ gap }}>
      {rows.map((count, rowIdx) => {
        const startCursor = cursor;
        cursor += count;
        return (
          <View
            key={rowIdx}
            className="flex-row justify-center"
            style={{ gap }}
          >
            {Array.from({ length: count }).map((_, i) => {
              const flatIndex = startCursor + i;
              const seat = seatsByIndex.get(flatIndex);
              const isTaken = !!seat;
              const isMe =
                !!seat && !!currentUserId && seat.user_id === currentUserId;
              let bg: string;
              let borderColor: string;
              if (isMe) {
                bg = "#FEF3C7";
                borderColor = "#FDE68A";
              } else if (isTaken) {
                bg = theme.primary;
                borderColor = theme.primaryDeep;
              } else {
                bg = "#FFFFFF";
                borderColor = "#E8E3DB";
              }
              return (
                <View
                  key={i}
                  style={{
                    width: seatSize,
                    height: seatSize,
                    borderRadius: seatSize / 2.2,
                    backgroundColor: bg,
                    borderWidth: 1.5,
                    borderColor,
                  }}
                />
              );
            })}
          </View>
        );
      })}
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
