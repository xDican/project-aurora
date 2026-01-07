import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type OccupancyType } from "@/hooks/useRoomRates";

// Strict types for room status
export const ROOM_STATUSES = ["available", "occupied", "cleaning", "maintenance"] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

// Keep for backwards compatibility but not used in UI
export const ROOM_TYPES = ["single", "double", "suite", "deluxe"] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export interface Room {
  id: string;
  number: string;
  type: string;
  base_price: number;
  status: RoomStatus;
  notes?: string | null;
  created_at?: string;
}

export interface RateConfig {
  occupancy: OccupancyType;
  enabled: boolean;
  price: number;
}

export interface CreateRoomPayload {
  number: string;
  status?: RoomStatus;
  notes?: string | null;
  rates: RateConfig[];
}

export interface UpdateRoomPayload {
  number?: string;
  status?: RoomStatus;
  notes?: string | null;
  rates?: RateConfig[];
}

export interface UseRoomsResult {
  rooms: Room[];
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
  createRoom: (payload: CreateRoomPayload) => Promise<void>;
  updateRoom: (id: string, payload: UpdateRoomPayload) => Promise<void>;
  setRoomStatus: (id: string, status: string, notes?: string | null) => Promise<void>;
  archiveRoom: (id: string) => Promise<void>;
}

function isValidRoomStatus(status: string): status is RoomStatus {
  return ROOM_STATUSES.includes(status as RoomStatus);
}

function parseRoom(raw: Record<string, unknown>): Room {
  const status = typeof raw.status === "string" && isValidRoomStatus(raw.status)
    ? raw.status
    : "available";

  return {
    id: String(raw.id ?? ""),
    number: String(raw.number ?? ""),
    type: String(raw.type ?? ""),
    base_price: typeof raw.base_price === "number" ? raw.base_price : 0,
    status,
    notes: raw.notes as string | null | undefined,
    created_at: raw.created_at as string | undefined,
  };
}

export function useRooms(): UseRoomsResult {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      const { data, error: fetchError } = await supabase
        .from("rooms")
        .select("*")
        .eq("is_active", true)
        .order("number", { ascending: true });

      if (fetchError) {
        setError(`Failed to load rooms: ${fetchError.message}`);
        return;
      }

      const parsedRooms = (data ?? []).map((row) => parseRoom(row as Record<string, unknown>));
      setRooms(parsedRooms);
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(`Failed to load rooms: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const createRoom = useCallback(async (payload: CreateRoomPayload): Promise<void> => {
    // 1. Insert room with default type/base_price (legacy fields)
    const { data: newRoom, error: insertError } = await supabase
      .from("rooms")
      .insert({
        number: payload.number,
        type: "standard", // Default value (legacy)
        base_price: 0,    // Default value (legacy)
        status: payload.status ?? "available",
        notes: payload.notes ?? null,
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(`Failed to create room: ${insertError.message}`);
    }

    // 2. Create room_rates for each enabled configuration
    const ratesToInsert = payload.rates
      .filter((r) => r.enabled && r.price > 0)
      .map((r) => ({
        room_id: newRoom.id,
        occupancy: r.occupancy,
        price: r.price,
        is_active: true,
      }));

    if (ratesToInsert.length > 0) {
      const { error: ratesError } = await supabase
        .from("room_rates")
        .insert(ratesToInsert);

      if (ratesError) {
        throw new Error(`Failed to create room rates: ${ratesError.message}`);
      }
    }

    await refresh();
  }, [refresh]);

  // Update room - for admins only (direct update)
  const updateRoom = useCallback(async (id: string, payload: UpdateRoomPayload): Promise<void> => {
    if (!id) {
      throw new Error("Room ID is required for update");
    }

    const updateData: Record<string, unknown> = {};

    if (payload.number !== undefined) updateData.number = payload.number;
    if (payload.notes !== undefined) updateData.notes = payload.notes;

    // If there are fields to update, do direct update (admin only)
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from("rooms")
        .update(updateData)
        .eq("id", id);

      if (updateError) {
        throw new Error(`Error al actualizar habitación: ${updateError.message}`);
      }
    }

    // If status is being updated, use RPC (works for both admin and receptionist)
    if (payload.status !== undefined) {
      const { error: rpcError } = await supabase.rpc("set_room_status", {
        p_room_id: id,
        p_status: payload.status,
        p_notes: payload.notes ?? null,
      });

      if (rpcError) {
        throw new Error(`Error al cambiar estado: ${rpcError.message}`);
      }
    }

    // Handle rates sync if provided
    if (payload.rates) {
      // Fetch existing rates
      const { data: existingRates } = await supabase
        .from("room_rates")
        .select("id, occupancy, is_active")
        .eq("room_id", id);

      const existingMap = new Map(existingRates?.map((r) => [r.occupancy, r]) ?? []);

      for (const rate of payload.rates) {
        const existing = existingMap.get(rate.occupancy);

        if (rate.enabled && rate.price > 0) {
          if (existing) {
            // Update existing rate
            await supabase
              .from("room_rates")
              .update({ price: rate.price, is_active: true })
              .eq("id", existing.id);
          } else {
            // Create new rate
            await supabase.from("room_rates").insert({
              room_id: id,
              occupancy: rate.occupancy,
              price: rate.price,
              is_active: true,
            });
          }
        } else if (existing) {
          // Deactivate existing rate
          await supabase
            .from("room_rates")
            .update({ is_active: false })
            .eq("id", existing.id);
        }
      }
    }

    await refresh();
  }, [refresh]);

  // Set room status via RPC (works for admin and receptionist)
  const setRoomStatus = useCallback(async (id: string, status: string, notes?: string | null): Promise<void> => {
    if (!id) {
      throw new Error("Room ID is required");
    }

    const { error: rpcError } = await supabase.rpc("set_room_status", {
      p_room_id: id,
      p_status: status,
      p_notes: notes ?? null,
    });

    if (rpcError) {
      throw new Error(`Error al cambiar estado: ${rpcError.message}`);
    }

    // Debug: verify change
    const { data: roomAfter } = await supabase
      .from("rooms")
      .select("id, is_active, status")
      .eq("id", id)
      .single();
    console.log("room after setRoomStatus RPC:", roomAfter);

    await refresh();
  }, [refresh]);

  // Archive room via RPC (works for admin and receptionist)
  const archiveRoom = useCallback(async (id: string): Promise<void> => {
    if (!id) {
      throw new Error("Room ID is required for archive");
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split("T")[0];

    // Check for active future reservations
    const { data: activeReservations, error: checkError } = await supabase
      .from("reservations")
      .select("id")
      .eq("room_id", id)
      .gte("check_out_date", today)
      .in("status", ["booked", "checked_in"]);

    if (checkError) {
      throw new Error(`Error al verificar reservas: ${checkError.message}`);
    }

    if (activeReservations && activeReservations.length > 0) {
      throw new Error("HAS_ACTIVE_RESERVATIONS");
    }

    // Archive the room via RPC
    const { error: rpcError } = await supabase.rpc("archive_room", {
      p_room_id: id,
    });

    if (rpcError) {
      throw new Error(`Error al archivar habitación: ${rpcError.message}`);
    }

    // Debug: verify archive
    const { data: roomAfter } = await supabase
      .from("rooms")
      .select("id, is_active, archived_at, status")
      .eq("id", id)
      .single();
    console.log("room after archive RPC:", roomAfter);

    await refresh();
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    rooms,
    loading,
    error,
    refresh,
    createRoom,
    updateRoom,
    setRoomStatus,
    archiveRoom,
  };
}
