import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type OccupancyType } from "@/hooks/useRoomRates";

export const RESERVATION_STATUSES = [
  "booked",
  "checked_in",
  "checked_out",
  "cancelled",
  "no_show",
] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export interface ReservationListItem {
  id: string;
  roomId: string;
  guestId: string;
  roomRateId: string | null;
  roomNumber: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  status: ReservationStatus;
  finalPrice: number;
  occupancy?: OccupancyType;
}

export interface NewReservationInput {
  roomId: string;
  guestId: string;
  checkInDate: string;
  checkOutDate: string;
  roomRateId: string;
  basePrice: number;
  finalPrice: number;
}

export interface UseReservationsResult {
  reservations: ReservationListItem[];
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
  createReservation: (input: NewReservationInput) => Promise<void>;
  updateReservation: (reservationId: string, input: NewReservationInput) => Promise<void>;
  cancelReservation: (reservationId: string) => Promise<void>;
}

function isValidReservationStatus(status: string): status is ReservationStatus {
  return RESERVATION_STATUSES.includes(status as ReservationStatus);
}

interface RawReservation {
  id: string;
  room_id: string;
  guest_id: string;
  room_rate_id: string | null;
  check_in_date: string;
  check_out_date: string;
  status: string;
  final_price: number;
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

function buildReservationListItem(
  reservation: RawReservation,
  roomMap: Map<string, RawRoom>,
  guestMap: Map<string, RawGuest>,
  rateMap: Map<string, RawRoomRate>
): ReservationListItem {
  const status = isValidReservationStatus(reservation.status)
    ? reservation.status
    : "booked";

  const room = roomMap.get(reservation.room_id);
  const guest = guestMap.get(reservation.guest_id);
  const rate = reservation.room_rate_id ? rateMap.get(reservation.room_rate_id) : null;

  return {
    id: reservation.id,
    roomId: reservation.room_id,
    guestId: reservation.guest_id,
    roomRateId: reservation.room_rate_id,
    roomNumber: room?.number ?? "",
    guestName: guest?.name ?? "",
    checkInDate: reservation.check_in_date,
    checkOutDate: reservation.check_out_date,
    status,
    finalPrice: reservation.final_price ?? 0,
    occupancy: rate?.occupancy,
  };
}

export function useReservations(): UseReservationsResult {
  const [reservations, setReservations] = useState<ReservationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      // 1. Cargar reservaciones
      const { data: reservationsData, error: reservationsError } = await supabase
        .from("reservations")
        .select("id, room_id, guest_id, room_rate_id, check_in_date, check_out_date, status, final_price")
        .order("check_in_date", { ascending: false });

      if (reservationsError) {
        setError(`Error al cargar reservas: ${reservationsError.message}`);
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

      // 6. Enriquecer reservations con room, guest y occupancy
      const parsedReservations = (reservationsData ?? []).map((r) =>
        buildReservationListItem(r as RawReservation, roomMap, guestMap, rateMap)
      );
      setReservations(parsedReservations);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(`Error al cargar reservas: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const createReservation = useCallback(
    async (input: NewReservationInput): Promise<void> => {
      // Validate dates on frontend
      if (input.checkOutDate <= input.checkInDate) {
        throw new Error(
          "La fecha de salida debe ser posterior a la fecha de ingreso"
        );
      }
      const today = new Date().toISOString().split("T")[0];
      if (input.checkInDate < today) {
        throw new Error("PAST_CHECKIN");
      }

      // Insert reservation with room_rate_id
      const insertData = {
        room_id: input.roomId,
        guest_id: input.guestId,
        check_in_date: input.checkInDate,
        check_out_date: input.checkOutDate,
        room_rate_id: input.roomRateId,
        base_price: input.basePrice,
        discount: 0,
        final_price: input.finalPrice,
        status: "booked" as ReservationStatus,
      };

      const { error: insertError } = await supabase
        .from("reservations")
        .insert(insertData);

      if (insertError) {
        const msg = insertError.message || "";
        // Detectar constraint de solapamiento
        if (
          msg.includes("reservations_no_overlap_per_room") ||
          msg.includes("no_overlap_per_room")
        ) {
          throw new Error("ROOM_OVERLAP");
        }
        if (msg.includes("PAST_CHECKIN")) {
          throw new Error("PAST_CHECKIN");
        }
        throw new Error(`Error al crear reserva: ${msg}`);
      }

      await refresh();
    },
    [refresh]
  );

  const updateReservation = useCallback(
    async (reservationId: string, input: NewReservationInput): Promise<void> => {
      // Editable reservations are limited to booked/checked_in (cancelled,
      // checked_out and no_show are historical and shouldn't be rewritten)
      const currentReservation = reservations.find((r) => r.id === reservationId);
      if (
        currentReservation &&
        !["booked", "checked_in"].includes(currentReservation.status)
      ) {
        throw new Error(
          `No se puede editar: la reserva tiene estado "${currentReservation.status}"`
        );
      }

      if (input.checkOutDate <= input.checkInDate) {
        throw new Error(
          "La fecha de salida debe ser posterior a la fecha de ingreso"
        );
      }

      // Intentionally no past-checkin guard here: an existing reservation's
      // check_in_date is routinely already in the past by the time it needs
      // editing (e.g. extending a stay 3 days in) - that's exactly why the
      // past-checkin rule was implemented as an INSERT-only trigger.
      const updateData = {
        room_id: input.roomId,
        guest_id: input.guestId,
        check_in_date: input.checkInDate,
        check_out_date: input.checkOutDate,
        room_rate_id: input.roomRateId,
        base_price: input.basePrice,
        discount: 0,
        final_price: input.finalPrice,
      };

      const { error: updateError } = await supabase
        .from("reservations")
        .update(updateData)
        .eq("id", reservationId);

      if (updateError) {
        const msg = updateError.message || "";
        if (
          msg.includes("reservations_no_overlap_per_room") ||
          msg.includes("no_overlap_per_room")
        ) {
          throw new Error("ROOM_OVERLAP");
        }
        throw new Error(`Error al actualizar reserva: ${msg}`);
      }

      await refresh();
    },
    [reservations, refresh]
  );

  const cancelReservation = useCallback(
    async (reservationId: string): Promise<void> => {
      // Validación opcional: verificar que la reserva esté en estado booked
      const currentReservation = reservations.find((r) => r.id === reservationId);
      if (currentReservation && currentReservation.status !== "booked") {
        throw new Error(
          `No se puede cancelar: la reserva tiene estado "${currentReservation.status}"`
        );
      }

      const { error: updateError } = await supabase
        .from("reservations")
        .update({ status: "cancelled" })
        .eq("id", reservationId);

      if (updateError) {
        throw new Error(`Error al cancelar reserva: ${updateError.message}`);
      }

      await refresh();
    },
    [reservations, refresh]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    reservations,
    loading,
    error,
    refresh,
    createReservation,
    updateReservation,
    cancelReservation,
  };
}
