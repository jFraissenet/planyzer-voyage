import { supabase } from "./supabase";

export type JourneyType = "outbound" | "return";

export type Vehicle = {
  vehicle_id: string;
  description: string | null;
  departure_location: string | null;
  departure_date: string | null;
  arrival_location: string | null;
  journey_type: JourneyType;
  linked_vehicle_id: string | null;
  seat_count: number;
  seat_layout: string;
  created_by: string | null;
  created_at: string;
  driver_id: string | null;
  driver_full_name: string | null;
  driver_avatar_url: string | null;
  occupied_count: number;
};

export type VehicleSeat = {
  seat_index: number;
  user_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
  label: string | null;
  added_by: string | null;
  added_at: string;
};

export type VehicleStop = {
  stop_id: string;
  label: string;
  stop_order: number;
};

async function requireUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

export async function listVehicles(toolId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase.rpc("get_event_tool_vehicles", {
    p_tool_id: toolId,
  });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    vehicle_id: r.vehicle_id as string,
    description: (r.description as string | null) ?? null,
    departure_location: (r.departure_location as string | null) ?? null,
    departure_date: (r.departure_date as string | null) ?? null,
    arrival_location: (r.arrival_location as string | null) ?? null,
    journey_type: (r.journey_type as JourneyType) ?? "outbound",
    linked_vehicle_id: (r.linked_vehicle_id as string | null) ?? null,
    seat_count: r.seat_count as number,
    seat_layout: r.seat_layout as string,
    created_by: (r.created_by as string | null) ?? null,
    created_at: r.created_at as string,
    driver_id: (r.driver_id as string | null) ?? null,
    driver_full_name: (r.driver_full_name as string | null) ?? null,
    driver_avatar_url: (r.driver_avatar_url as string | null) ?? null,
    occupied_count: (r.occupied_count as number) ?? 0,
  }));
}

export async function listVehicleSeats(
  vehicleId: string,
): Promise<VehicleSeat[]> {
  const { data, error } = await supabase.rpc(
    "get_event_tool_vehicle_seats",
    { p_vehicle_id: vehicleId },
  );
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    seat_index: r.seat_index as number,
    user_id: (r.user_id as string | null) ?? null,
    full_name: (r.full_name as string | null) ?? null,
    avatar_url: (r.avatar_url as string | null) ?? null,
    label: (r.label as string | null) ?? null,
    added_by: (r.added_by as string | null) ?? null,
    added_at: r.added_at as string,
  }));
}

export async function listVehicleStops(
  vehicleId: string,
): Promise<VehicleStop[]> {
  const { data, error } = await supabase.rpc(
    "get_event_tool_vehicle_stops",
    { p_vehicle_id: vehicleId },
  );
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    stop_id: r.stop_id as string,
    label: r.label as string,
    stop_order: r.stop_order as number,
  }));
}

export async function createVehicle(input: {
  tool_id: string;
  driver_user_id: string;
  description?: string | null;
  departure_location?: string | null;
  departure_date?: string | null;
  arrival_location?: string | null;
  journey_type?: JourneyType;
  linked_vehicle_id?: string | null;
  seat_count: number;
  seat_layout: string;
  stops: string[];
}): Promise<string> {
  const userId = await requireUserId();
  const { data: inserted, error: insertErr } = await supabase
    .from("event_tool_vehicles")
    .insert({
      event_tool_vehicle_event_tool_id: input.tool_id,
      event_tool_vehicle_description: input.description ?? null,
      event_tool_vehicle_departure_location:
        input.departure_location ?? null,
      event_tool_vehicle_departure_date: input.departure_date ?? null,
      event_tool_vehicle_arrival_location: input.arrival_location ?? null,
      event_tool_vehicle_journey_type: input.journey_type ?? "outbound",
      event_tool_vehicle_linked_vehicle_id: input.linked_vehicle_id ?? null,
      event_tool_vehicle_seat_count: input.seat_count,
      event_tool_vehicle_seat_layout: input.seat_layout,
      event_tool_vehicle_created_by: userId,
    })
    .select("event_tool_vehicle_id")
    .single();
  if (insertErr) throw insertErr;

  const vehicleId = inserted!.event_tool_vehicle_id as string;

  // Insert driver at seat 0
  const { error: seatErr } = await supabase
    .from("event_tool_vehicle_seats")
    .insert({
      event_tool_vehicle_seat_vehicle_id: vehicleId,
      event_tool_vehicle_seat_index: 0,
      event_tool_vehicle_seat_user_id: input.driver_user_id,
      event_tool_vehicle_seat_added_by: userId,
    });
  if (seatErr) throw seatErr;

  // Insert stops
  if (input.stops.length > 0) {
    const rows = input.stops
      .map((label, idx) => ({
        event_tool_vehicle_stop_vehicle_id: vehicleId,
        event_tool_vehicle_stop_label: label.trim(),
        event_tool_vehicle_stop_order: idx,
      }))
      .filter((r) => r.event_tool_vehicle_stop_label.length > 0);
    if (rows.length > 0) {
      const { error: stopErr } = await supabase
        .from("event_tool_vehicle_stops")
        .insert(rows);
      if (stopErr) throw stopErr;
    }
  }

  return vehicleId;
}

export async function updateVehicle(
  vehicleId: string,
  input: {
    description?: string | null;
    departure_location?: string | null;
    departure_date?: string | null;
    arrival_location?: string | null;
    linked_vehicle_id?: string | null;
    seat_count?: number;
    seat_layout?: string;
    stops?: string[];
  },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.description !== undefined)
    patch.event_tool_vehicle_description = input.description;
  if (input.departure_location !== undefined)
    patch.event_tool_vehicle_departure_location = input.departure_location;
  if (input.departure_date !== undefined)
    patch.event_tool_vehicle_departure_date = input.departure_date;
  if (input.arrival_location !== undefined)
    patch.event_tool_vehicle_arrival_location = input.arrival_location;
  if (input.linked_vehicle_id !== undefined)
    patch.event_tool_vehicle_linked_vehicle_id = input.linked_vehicle_id;
  if (input.seat_count !== undefined)
    patch.event_tool_vehicle_seat_count = input.seat_count;
  if (input.seat_layout !== undefined)
    patch.event_tool_vehicle_seat_layout = input.seat_layout;

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase
      .from("event_tool_vehicles")
      .update(patch)
      .eq("event_tool_vehicle_id", vehicleId);
    if (error) throw error;
  }

  if (input.stops !== undefined) {
    const { error: dErr } = await supabase
      .from("event_tool_vehicle_stops")
      .delete()
      .eq("event_tool_vehicle_stop_vehicle_id", vehicleId);
    if (dErr) throw dErr;
    const rows = input.stops
      .map((label, idx) => ({
        event_tool_vehicle_stop_vehicle_id: vehicleId,
        event_tool_vehicle_stop_label: label.trim(),
        event_tool_vehicle_stop_order: idx,
      }))
      .filter((r) => r.event_tool_vehicle_stop_label.length > 0);
    if (rows.length > 0) {
      const { error: iErr } = await supabase
        .from("event_tool_vehicle_stops")
        .insert(rows);
      if (iErr) throw iErr;
    }
  }
}

export async function createRoundTripVehicles(input: {
  tool_id: string;
  driver_user_id: string;
  description?: string | null;
  outbound_location: string | null;
  outbound_date: string | null;
  arrival_location: string | null;
  return_date: string | null;
  seat_count: number;
  seat_layout: string;
  stops: string[];
}): Promise<{ outbound_id: string; return_id: string }> {
  const outboundId = await createVehicle({
    tool_id: input.tool_id,
    driver_user_id: input.driver_user_id,
    description: input.description,
    departure_location: input.outbound_location,
    departure_date: input.outbound_date,
    arrival_location: input.arrival_location,
    seat_count: input.seat_count,
    seat_layout: input.seat_layout,
    stops: input.stops,
    journey_type: "outbound",
  });
  const returnId = await createVehicle({
    tool_id: input.tool_id,
    driver_user_id: input.driver_user_id,
    description: input.description,
    departure_location: input.arrival_location,
    departure_date: input.return_date,
    arrival_location: input.outbound_location,
    seat_count: input.seat_count,
    seat_layout: input.seat_layout,
    stops: [],
    journey_type: "return",
    linked_vehicle_id: outboundId,
  });
  await updateVehicle(outboundId, { linked_vehicle_id: returnId });
  return { outbound_id: outboundId, return_id: returnId };
}

export async function deleteVehicle(vehicleId: string): Promise<void> {
  const { error } = await supabase
    .from("event_tool_vehicles")
    .delete()
    .eq("event_tool_vehicle_id", vehicleId);
  if (error) throw error;
}

export async function addSeatUser(
  vehicleId: string,
  seatIndex: number,
  userId: string,
): Promise<void> {
  const me = await requireUserId();
  const { error } = await supabase.from("event_tool_vehicle_seats").insert({
    event_tool_vehicle_seat_vehicle_id: vehicleId,
    event_tool_vehicle_seat_index: seatIndex,
    event_tool_vehicle_seat_user_id: userId,
    event_tool_vehicle_seat_added_by: me,
  });
  if (error) throw error;
}

export async function addSeatLabel(
  vehicleId: string,
  seatIndex: number,
  label: string,
): Promise<void> {
  const me = await requireUserId();
  const { error } = await supabase.from("event_tool_vehicle_seats").insert({
    event_tool_vehicle_seat_vehicle_id: vehicleId,
    event_tool_vehicle_seat_index: seatIndex,
    event_tool_vehicle_seat_label: label.trim(),
    event_tool_vehicle_seat_added_by: me,
  });
  if (error) throw error;
}

export async function removeSeat(
  vehicleId: string,
  seatIndex: number,
): Promise<void> {
  const { error } = await supabase
    .from("event_tool_vehicle_seats")
    .delete()
    .eq("event_tool_vehicle_seat_vehicle_id", vehicleId)
    .eq("event_tool_vehicle_seat_index", seatIndex);
  if (error) throw error;
}

// === Seat layout options ===

export const LAYOUT_OPTIONS: Record<number, string[]> = {
  2: ["2", "1,1"],
  3: ["2,1", "1,2", "3"],
  4: ["2,2", "1,3"],
  5: ["2,3"],
  6: ["3,3", "2,2,2"],
  7: ["3,4", "2,2,3", "2,3,2"],
  8: ["4,4", "2,3,3", "2,2,4"],
  9: ["3,3,3", "2,3,4"],
  10: ["3,4,3", "2,4,4"],
};

export function parseLayout(layout: string): number[] {
  return layout
    .split(",")
    .map((n) => Number(n.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function layoutTotal(layout: string): number {
  return parseLayout(layout).reduce((a, b) => a + b, 0);
}
