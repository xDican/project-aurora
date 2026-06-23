import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { type OccupancyType } from "@/hooks/useRoomRates";

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
  occupancy?: OccupancyType;
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
  room_rate_id: string | null;
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

interface RawRoomRate {
  id: string;
  occupancy: OccupancyType;
}

function buildDepartureItem(
  reservation: RawReservation,
  roomMap: Map<string, RawRoom>,
  guestMap: Map<string, RawGuest>,
  rateMap: Map<string, RawRoomRate>
): DepartureItem {
  const status = isValidReservationStatus(reservation.status)
    ? reservation.status
    : "booked";

  const room = roomMap.get(reservation.room_id);
  const guest = guestMap.get(reservation.guest_id);
  const rate = reservation.room_rate_id ? rateMap.get(reservation.room_rate_id) : null;

  return {
    reservationId: reservation.id,
    roomId: reservation.room_id,
    roomNumber: room?.number ?? "",
    guestName: guest?.name ?? "",
    checkOutDate: reservation.check_out_date,
    status,
    occupancy: rate?.occupancy,
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
        .select("id, room_id, guest_id, room_rate_id, check_out_date, status")
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

      // 4. Cargar room_rates para obtener ocupación
      const { data: ratesData, error: ratesError } = await supabase
        .from("room_rates")
        .select("id, occupancy");

      if (ratesError) {
        setError(`Error al cargar configuraciones: ${ratesError.message}`);
        return;
      }

      // 5. Construir mapas para lookup rápido
      const roomMap = new Map<string, RawRoom>(
        (roomsData ?? []).map((r) => [r.id, r as RawRoom])
      );
      const guestMap = new Map<string, RawGuest>(
        (guestsData ?? []).map((g) => [g.id, g as RawGuest])
      );
      const rateMap = new Map<string, RawRoomRate>(
        (ratesData ?? []).map((r) => [r.id, r as RawRoomRate])
      );

      // 6. Enriquecer departures con room, guest y ocupación
      setDepartures(
        (reservationsData ?? []).map((r) =>
          buildDepartureItem(r as RawReservation, roomMap, guestMap, rateMap)
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
      const { error: roomError } = await supabase.rpc("set_room_status", {
        p_room_id: roomId,
        p_status: "cleaning",
      });

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
