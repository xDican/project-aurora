import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export const RESERVATION_STATUSES = [
  "booked",
  "checked_in",
  "checked_out",
  "cancelled",
  "no_show",
] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export interface DepartureItem {
  reservationId: string;
  roomId: string;
  roomNumber: string;
  guestName: string;
  checkOutDate: string; // "YYYY-MM-DD"
  status: ReservationStatus;
}

export interface UseDeparturesResult {
  departures: DepartureItem[];
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
  checkOut: (reservationId: string, roomId: string) => Promise<void>;
}

function isValidReservationStatus(status: string): status is ReservationStatus {
  return RESERVATION_STATUSES.includes(status as ReservationStatus);
}

function parseDeparture(raw: Record<string, unknown>): DepartureItem {
  const rooms = raw.rooms as Record<string, unknown> | null;
  const guests = raw.guests as Record<string, unknown> | null;

  const status =
    typeof raw.status === "string" && isValidReservationStatus(raw.status)
      ? raw.status
      : "booked";

  return {
    reservationId: String(raw.id ?? ""),
    roomId: String(raw.room_id ?? ""),
    roomNumber: (rooms?.number as string) ?? "",
    guestName: (guests?.name as string) ?? "",
    checkOutDate: String(raw.check_out_date ?? ""),
    status,
  };
}

export function useDepartures(): UseDeparturesResult {
  const [departures, setDepartures] = useState<DepartureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      const today = format(new Date(), "yyyy-MM-dd");

      const { data, error: queryError } = await supabase
        .from("reservations")
        .select(
          `
          id,
          room_id,
          check_out_date,
          status,
          rooms:rooms!reservations_room_fk(number),
          guests:guests!reservations_guest_fk(name)
        `
        )
        .eq("check_out_date", today)
        .order("check_out_date", { ascending: true });

      if (queryError) {
        setError(`Error al cargar salidas: ${queryError.message}`);
        return;
      }

      setDepartures(
        (data ?? []).map((row) =>
          parseDeparture(row as Record<string, unknown>)
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(`Error al cargar salidas: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkOut = useCallback(
    async (reservationId: string, roomId: string): Promise<void> => {
      // Validación opcional: verificar que la reserva esté en estado checked_in
      const currentDeparture = departures.find(
        (d) => d.reservationId === reservationId
      );
      if (currentDeparture && currentDeparture.status !== "checked_in") {
        throw new Error(
          `No se puede hacer check-out: la reserva tiene estado "${currentDeparture.status}"`
        );
      }

      // Actualizar reserva a checked_out
      const { error: reservationError } = await supabase
        .from("reservations")
        .update({ status: "checked_out" })
        .eq("id", reservationId);

      if (reservationError) {
        throw new Error(
          `Error al actualizar reserva: ${reservationError.message}`
        );
      }

      // Actualizar habitación a cleaning
      const { error: roomError } = await supabase
        .from("rooms")
        .update({ status: "cleaning" })
        .eq("id", roomId);

      if (roomError) {
        throw new Error(
          `Error al actualizar habitación: ${roomError.message}`
        );
      }

      await refresh();
    },
    [departures, refresh]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    departures,
    loading,
    error,
    refresh,
    checkOut,
  };
}
