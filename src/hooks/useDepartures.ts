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

interface RawReservation {
  id: string;
  room_id: string;
  guest_id: string;
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

function buildDepartureItem(
  reservation: RawReservation,
  roomMap: Map<string, RawRoom>,
  guestMap: Map<string, RawGuest>
): DepartureItem {
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

export function useDepartures(): UseDeparturesResult {
  const [departures, setDepartures] = useState<DepartureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      const today = format(new Date(), "yyyy-MM-dd");

      // 1. Cargar reservaciones sin embeds
      const { data: reservationsData, error: reservationsError } = await supabase
        .from("reservations")
        .select("id, room_id, guest_id, check_out_date, status")
        .eq("check_out_date", today)
        .order("check_out_date", { ascending: true });

      if (reservationsError) {
        setError(`Error al cargar salidas: ${reservationsError.message}`);
        return;
      }

      // 2. Cargar rooms activos
      const { data: roomsData, error: roomsError } = await supabase
        .from("rooms")
        .select("id, number")
        .eq("is_active", true);

      if (roomsError) {
        setError(`Error al cargar habitaciones: ${roomsError.message}`);
        return;
      }

      // 3. Cargar guests activos
      const { data: guestsData, error: guestsError } = await supabase
        .from("guests")
        .select("id, name")
        .eq("is_active", true);

      if (guestsError) {
        setError(`Error al cargar huéspedes: ${guestsError.message}`);
        return;
      }

      // 4. Construir mapas para lookup rápido
      const roomMap = new Map<string, RawRoom>(
        (roomsData ?? []).map((r) => [r.id, r as RawRoom])
      );
      const guestMap = new Map<string, RawGuest>(
        (guestsData ?? []).map((g) => [g.id, g as RawGuest])
      );

      // 5. Enriquecer departures con room y guest
      setDepartures(
        (reservationsData ?? []).map((r) =>
          buildDepartureItem(r as RawReservation, roomMap, guestMap)
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
