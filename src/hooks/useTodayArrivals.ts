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

export interface TodayArrival {
  reservationId: string;
  roomId: string;
  roomNumber: string;
  guestName: string;
  checkInDate: string;
  status: ReservationStatus;
}

export interface TodayDeparture {
  reservationId: string;
  roomId: string;
  roomNumber: string;
  guestName: string;
  checkOutDate: string;
  status: ReservationStatus;
}

export interface UseTodayArrivalsResult {
  arrivals: TodayArrival[];
  departures: TodayDeparture[];
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
  checkIn: (reservationId: string, roomId: string) => Promise<void>;
  checkOut: (reservationId: string, roomId: string) => Promise<void>;
  markNoShow: (reservationId: string) => Promise<void>;
}

function isValidReservationStatus(status: string): status is ReservationStatus {
  return RESERVATION_STATUSES.includes(status as ReservationStatus);
}

function parseArrival(raw: Record<string, unknown>): TodayArrival {
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
    checkInDate: String(raw.check_in_date ?? ""),
    status,
  };
}

function parseDeparture(raw: Record<string, unknown>): TodayDeparture {
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

export function useTodayArrivals(): UseTodayArrivalsResult {
  const [arrivals, setArrivals] = useState<TodayArrival[]>([]);
  const [departures, setDepartures] = useState<TodayDeparture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      const today = format(new Date(), "yyyy-MM-dd");

      // Fetch arrivals
      const { data: arrivalsData, error: arrivalsError } = await supabase
        .from("reservations")
        .select(
          `
          id,
          room_id,
          check_in_date,
          status,
          rooms:rooms!reservations_room_fk(number),
          guests:guests!reservations_guest_fk(name)
        `
        )
        .eq("check_in_date", today)
        .order("check_in_date", { ascending: true });

      if (arrivalsError) {
        setError(`Error al cargar llegadas: ${arrivalsError.message}`);
        return;
      }

      // Fetch departures
      const { data: departuresData, error: departuresError } = await supabase
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

      if (departuresError) {
        setError(`Error al cargar salidas: ${departuresError.message}`);
        return;
      }

      setArrivals(
        (arrivalsData ?? []).map((row) =>
          parseArrival(row as Record<string, unknown>)
        )
      );
      setDepartures(
        (departuresData ?? []).map((row) =>
          parseDeparture(row as Record<string, unknown>)
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(`Error al cargar datos: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkIn = useCallback(
    async (reservationId: string, roomId: string): Promise<void> => {
      const { error: reservationError } = await supabase
        .from("reservations")
        .update({ status: "checked_in" })
        .eq("id", reservationId);

      if (reservationError) {
        throw new Error(
          `Error al actualizar reserva: ${reservationError.message}`
        );
      }

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

  const checkOut = useCallback(
    async (reservationId: string, roomId: string): Promise<void> => {
      const { error: reservationError } = await supabase
        .from("reservations")
        .update({ status: "checked_out" })
        .eq("id", reservationId);

      if (reservationError) {
        throw new Error(
          `Error al actualizar reserva: ${reservationError.message}`
        );
      }

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
    [refresh]
  );

  const markNoShow = useCallback(
    async (reservationId: string): Promise<void> => {
      const { error: updateError } = await supabase
        .from("reservations")
        .update({ status: "no_show" })
        .eq("id", reservationId);

      if (updateError) {
        throw new Error(
          `Error al marcar como no-show: ${updateError.message}`
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
    departures,
    loading,
    error,
    refresh,
    checkIn,
    checkOut,
    markNoShow,
  };
}
