import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RoomCard {
  id: string;
  number: string;
  type: string;
  status: string;
  basePrice: number;
  notes?: string | null;
}

export interface RoomReservation {
  id: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: string;
}

export interface UseRoomMapResult {
  rooms: RoomCard[];
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
  getRoomReservations: (roomId: string) => Promise<RoomReservation[]>;
  markAsClean: (roomId: string) => Promise<void>;
}

function parseRoom(raw: Record<string, unknown>): RoomCard {
  return {
    id: String(raw.id ?? ""),
    number: String(raw.number ?? ""),
    type: String(raw.type ?? ""),
    status: String(raw.status ?? "available"),
    basePrice: typeof raw.base_price === "number" ? raw.base_price : 0,
    notes: raw.notes as string | null | undefined,
  };
}

export function useRoomMap(): UseRoomMapResult {
  const [rooms, setRooms] = useState<RoomCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      const { data, error: fetchError } = await supabase
        .from("rooms")
        .select("id, number, type, status, base_price, notes")
        .eq("is_active", true)
        .order("number", { ascending: true });

      if (fetchError) {
        setError(`Error al cargar habitaciones: ${fetchError.message}`);
        return;
      }

      const parsed = (data ?? []).map((row) =>
        parseRoom(row as Record<string, unknown>)
      );
      setRooms(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(`Error al cargar habitaciones: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const getRoomReservations = useCallback(
    async (roomId: string): Promise<RoomReservation[]> => {
      if (!roomId) {
        throw new Error("Se requiere el ID de la habitación");
      }

      // Get today's date in YYYY-MM-DD format (browser timezone)
      const today = new Date().toISOString().split("T")[0];

      // Step 1: Fetch reservations for this room (upcoming only)
      const { data: reservationsData, error: reservationsError } = await supabase
        .from("reservations")
        .select("id, guest_id, check_in_date, check_out_date, status")
        .eq("room_id", roomId)
        .gte("check_out_date", today)
        .order("check_in_date", { ascending: true });

      if (reservationsError) {
        throw new Error(
          `Error al cargar reservas: ${reservationsError.message}`
        );
      }

      if (!reservationsData || reservationsData.length === 0) {
        return [];
      }

      // Step 2: Get unique guest IDs
      const guestIds = [
        ...new Set(reservationsData.map((r) => r.guest_id).filter(Boolean)),
      ];

      // Step 3: Fetch guests by IDs
      const { data: guestsData, error: guestsError } = await supabase
        .from("guests")
        .select("id, name")
        .in("id", guestIds);

      if (guestsError) {
        throw new Error(
          `Error al cargar huéspedes: ${guestsError.message}`
        );
      }

      // Step 4: Create a map of guest ID to name
      const guestMap = new Map<string, string>();
      (guestsData ?? []).forEach((guest) => {
        guestMap.set(String(guest.id), String(guest.name ?? ""));
      });

      // Step 5: Build the result
      const result: RoomReservation[] = reservationsData.map((r) => ({
        id: String(r.id),
        guestName: guestMap.get(String(r.guest_id)) ?? "",
        checkIn: String(r.check_in_date ?? ""),
        checkOut: String(r.check_out_date ?? ""),
        status: String(r.status ?? ""),
      }));

      return result;
    },
    []
  );

  const markAsClean = useCallback(
    async (roomId: string): Promise<void> => {
      const { error: updateError } = await supabase
        .from("rooms")
        .update({ status: "available" })
        .eq("id", roomId);

      if (updateError) {
        throw new Error(`Error al marcar habitación como limpia: ${updateError.message}`);
      }

      await refresh();
    },
    [refresh]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    rooms,
    loading,
    error,
    refresh,
    getRoomReservations,
    markAsClean,
  };
}
