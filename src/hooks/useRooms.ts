import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Strict types for room status
export const ROOM_STATUSES = ["available", "occupied", "cleaning", "maintenance"] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

// Strict types for room type
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

export type CreateRoomPayload = Omit<Room, "id" | "status" | "created_at"> & {
  status?: RoomStatus;
};

export type UpdateRoomPayload = Partial<Omit<Room, "id" | "created_at">>;

export interface UseRoomsResult {
  rooms: Room[];
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
  createRoom: (payload: CreateRoomPayload) => Promise<void>;
  updateRoom: (id: string, payload: UpdateRoomPayload) => Promise<void>;
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
    const insertData = {
      number: payload.number,
      type: payload.type,
      base_price: payload.base_price,
      status: payload.status ?? "available",
      notes: payload.notes ?? null,
    };

    const { error: insertError } = await supabase.from("rooms").insert(insertData);

    if (insertError) {
      throw new Error(`Failed to create room: ${insertError.message}`);
    }

    await refresh();
  }, [refresh]);

  const updateRoom = useCallback(async (id: string, payload: UpdateRoomPayload): Promise<void> => {
    if (!id) {
      throw new Error("Room ID is required for update");
    }

    const updateData: Record<string, unknown> = {};

    if (payload.number !== undefined) updateData.number = payload.number;
    if (payload.type !== undefined) updateData.type = payload.type;
    if (payload.base_price !== undefined) updateData.base_price = payload.base_price;
    if (payload.status !== undefined) updateData.status = payload.status;
    if (payload.notes !== undefined) updateData.notes = payload.notes;

    if (Object.keys(updateData).length === 0) {
      return; // Nothing to update
    }

    const { error: updateError } = await supabase
      .from("rooms")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      throw new Error(`Failed to update room: ${updateError.message}`);
    }

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
  };
}
