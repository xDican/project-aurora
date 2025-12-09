import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  roomNumber: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  status: ReservationStatus;
  finalPrice: number;
}

export interface NewReservationInput {
  roomId: string;
  guestId: string;
  checkInDate: string;
  checkOutDate: string;
}

export interface UseReservationsResult {
  reservations: ReservationListItem[];
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
  createReservation: (input: NewReservationInput) => Promise<void>;
  cancelReservation: (reservationId: string) => Promise<void>;
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

function buildReservationListItem(
  reservation: RawReservation,
  roomMap: Map<string, RawRoom>,
  guestMap: Map<string, RawGuest>
): ReservationListItem {
  const status = isValidReservationStatus(reservation.status)
    ? reservation.status
    : "booked";

  const room = roomMap.get(reservation.room_id);
  const guest = guestMap.get(reservation.guest_id);

  return {
    id: reservation.id,
    roomNumber: room?.number ?? "",
    guestName: guest?.name ?? "",
    checkInDate: reservation.check_in_date,
    checkOutDate: reservation.check_out_date,
    status,
    finalPrice: reservation.final_price ?? 0,
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
      // 1. Cargar reservaciones sin embeds
      const { data: reservationsData, error: reservationsError } = await supabase
        .from("reservations")
        .select("id, room_id, guest_id, check_in_date, check_out_date, status, final_price")
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

      // 4. Construir mapas para lookup rápido
      const roomMap = new Map<string, RawRoom>(
        (roomsData ?? []).map((r) => [r.id, r as RawRoom])
      );
      const guestMap = new Map<string, RawGuest>(
        (guestsData ?? []).map((g) => [g.id, g as RawGuest])
      );

      // 5. Enriquecer reservations con room y guest
      const parsedReservations = (reservationsData ?? []).map((r) =>
        buildReservationListItem(r as RawReservation, roomMap, guestMap)
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

      // Fetch room to get base_price
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .select("base_price")
        .eq("id", input.roomId)
        .single();

      if (roomError) {
        throw new Error(`Error al obtener habitación: ${roomError.message}`);
      }

      if (!roomData) {
        throw new Error("Habitación no encontrada");
      }

      const basePrice = roomData.base_price;

      // Insert reservation
      const insertData = {
        room_id: input.roomId,
        guest_id: input.guestId,
        check_in_date: input.checkInDate,
        check_out_date: input.checkOutDate,
        status: "booked" as ReservationStatus,
        base_price: basePrice,
        discount: 0,
        final_price: basePrice,
      };

      const { error: insertError } = await supabase
        .from("reservations")
        .insert(insertData);

      if (insertError) {
        throw new Error(`Error al crear reserva: ${insertError.message}`);
      }

      await refresh();
    },
    [refresh]
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
    cancelReservation,
  };
}
