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

interface RawReservation {
  id: string;
  room_id: string;
  guest_id: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
}

interface RawRoom {
  id: string;
  number: string;
}

interface RawGuest {
  id: string;
  name: string;
}

function buildArrival(
  reservation: RawReservation,
  roomMap: Map<string, RawRoom>,
  guestMap: Map<string, RawGuest>
): TodayArrival {
  const status = isValidReservationStatus(reservation.status)
    ? reservation.status
    : "booked";

  const room = roomMap.get(reservation.room_id);
  const guest = guestMap.get(reservation.guest_id);

  return {
    reservationId: reservation.id,
    roomId: reservation.room_id,
    roomNumber: room?.number ?? "",
    guestName: guest?.name ?? "",
    checkInDate: reservation.check_in_date,
    status,
  };
}

function buildDeparture(
  reservation: RawReservation,
  roomMap: Map<string, RawRoom>,
  guestMap: Map<string, RawGuest>
): TodayDeparture {
  const status = isValidReservationStatus(reservation.status)
    ? reservation.status
    : "booked";

  const room = roomMap.get(reservation.room_id);
  const guest = guestMap.get(reservation.guest_id);

  return {
    reservationId: reservation.id,
    roomId: reservation.room_id,
    roomNumber: room?.number ?? "",
    guestName: guest?.name ?? "",
    checkOutDate: reservation.check_out_date,
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

      // 1. Cargar llegadas (arrivals) sin embeds
      const { data: arrivalsData, error: arrivalsError } = await supabase
        .from("reservations")
        .select("id, room_id, guest_id, check_in_date, check_out_date, status")
        .eq("check_in_date", today)
        .order("check_in_date", { ascending: true });

      if (arrivalsError) {
        setError(`Error al cargar llegadas: ${arrivalsError.message}`);
        return;
      }

      // 2. Cargar salidas (departures) sin embeds
      const { data: departuresData, error: departuresError } = await supabase
        .from("reservations")
        .select("id, room_id, guest_id, check_in_date, check_out_date, status")
        .eq("check_out_date", today)
        .order("check_out_date", { ascending: true });

      if (departuresError) {
        setError(`Error al cargar salidas: ${departuresError.message}`);
        return;
      }

      // 3. Cargar rooms activos
      const { data: roomsData, error: roomsError } = await supabase
        .from("rooms")
        .select("id, number")
        .eq("is_active", true);

      if (roomsError) {
        setError(`Error al cargar habitaciones: ${roomsError.message}`);
        return;
      }

      // 4. Cargar guests activos
      const { data: guestsData, error: guestsError } = await supabase
        .from("guests")
        .select("id, name")
        .eq("is_active", true);

      if (guestsError) {
        setError(`Error al cargar huéspedes: ${guestsError.message}`);
        return;
      }

      // 5. Construir mapas para lookup rápido
      const roomMap = new Map<string, RawRoom>(
        (roomsData ?? []).map((r) => [r.id, r as RawRoom])
      );
      const guestMap = new Map<string, RawGuest>(
        (guestsData ?? []).map((g) => [g.id, g as RawGuest])
      );

      // 6. Enriquecer arrivals y departures
      setArrivals(
        (arrivalsData ?? []).map((r) =>
          buildArrival(r as RawReservation, roomMap, guestMap)
        )
      );
      setDepartures(
        (departuresData ?? []).map((r) =>
          buildDeparture(r as RawReservation, roomMap, guestMap)
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
