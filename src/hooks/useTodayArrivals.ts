import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface TodayArrival {
  id: string;
  roomNumber: string;
  roomId: string;
  guestName: string;
  checkInDate: string;
  status: string;
}

export interface UseTodayArrivalsResult {
  arrivals: TodayArrival[];
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
  checkIn: (reservationId: string, roomId: string) => Promise<void>;
}

function parseArrival(raw: Record<string, unknown>): TodayArrival {
  const rooms = raw.rooms as Record<string, unknown> | null;
  const guests = raw.guests as Record<string, unknown> | null;

  return {
    id: String(raw.id ?? ""),
    roomNumber: (rooms?.number as string) ?? "",
    roomId: String(raw.room_id ?? ""),
    guestName: (guests?.name as string) ?? "",
    checkInDate: String(raw.check_in_date ?? ""),
    status: String(raw.status ?? "booked"),
  };
}

export function useTodayArrivals(): UseTodayArrivalsResult {
  const [arrivals, setArrivals] = useState<TodayArrival[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      const today = format(new Date(), "yyyy-MM-dd");

      const { data, error: fetchError } = await supabase
        .from("reservations")
        .select(
          `
          id,
          room_id,
          check_in_date,
          status,
          rooms:room_id(number),
          guests:guest_id(name)
        `
        )
        .eq("check_in_date", today)
        .order("check_in_date", { ascending: true });

      if (fetchError) {
        setError(`Error al cargar llegadas: ${fetchError.message}`);
        return;
      }

      const parsed = (data ?? []).map((row) =>
        parseArrival(row as Record<string, unknown>)
      );
      setArrivals(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(`Error al cargar llegadas: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkIn = useCallback(
    async (reservationId: string, roomId: string): Promise<void> => {
      // Update reservation status to checked_in
      const { error: reservationError } = await supabase
        .from("reservations")
        .update({ status: "checked_in" })
        .eq("id", reservationId);

      if (reservationError) {
        throw new Error(
          `Error al actualizar reserva: ${reservationError.message}`
        );
      }

      // Update room status to occupied
      const { error: roomError } = await supabase
        .from("rooms")
        .update({ status: "occupied" })
        .eq("id", roomId);

      if (roomError) {
        throw new Error(
          `Error al actualizar habitación: ${roomError.message}`
        );
      }

      await refresh();
    },
    [refresh]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    arrivals,
    loading,
    error,
    refresh,
    checkIn,
  };
}
