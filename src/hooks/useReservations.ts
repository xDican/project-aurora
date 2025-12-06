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
}

function isValidReservationStatus(status: string): status is ReservationStatus {
  return RESERVATION_STATUSES.includes(status as ReservationStatus);
}

function parseReservation(raw: Record<string, unknown>): ReservationListItem {
  const status =
    typeof raw.status === "string" && isValidReservationStatus(raw.status)
      ? raw.status
      : "booked";

  const rooms = raw.rooms as Record<string, unknown> | null;
  const guests = raw.guests as Record<string, unknown> | null;

  return {
    id: String(raw.id ?? ""),
    roomNumber: (rooms?.number as string) ?? "",
    guestName: (guests?.name as string) ?? "",
    checkInDate: String(raw.check_in_date ?? ""),
    checkOutDate: String(raw.check_out_date ?? ""),
    status,
    finalPrice: typeof raw.final_price === "number" ? raw.final_price : 0,
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
      const { data, error: fetchError } = await supabase
        .from("reservations")
        .select(
          `
          id,
          check_in_date,
          check_out_date,
          status,
          final_price,
          rooms:room_id(number),
          guests:guest_id(name)
        `
        )
        .order("check_in_date", { ascending: false });

      if (fetchError) {
        setError(`Error al cargar reservas: ${fetchError.message}`);
        return;
      }

      const parsedReservations = (data ?? []).map((row) =>
        parseReservation(row as Record<string, unknown>)
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

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    reservations,
    loading,
    error,
    refresh,
    createReservation,
  };
}
