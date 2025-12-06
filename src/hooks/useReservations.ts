import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const RESERVATION_STATUSES = ["booked", "checked_in", "checked_out", "cancelled", "no_show"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export interface Reservation {
  id: string;
  room_id: string;
  guest_id: string;
  check_in_date: string;
  check_out_date: string;
  status: ReservationStatus;
  base_price: number;
  discount: number;
  final_price: number;
  notes?: string | null;
  created_at?: string;
  // Joined data
  room_number?: string;
  guest_name?: string;
}

export interface CreateReservationPayload {
  room_id: string;
  guest_id: string;
  check_in_date: string;
  check_out_date: string;
  base_price: number;
  discount?: number;
  final_price: number;
  notes?: string | null;
}

export interface UseReservationsResult {
  reservations: Reservation[];
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
  createReservation: (payload: CreateReservationPayload) => Promise<void>;
}

function isValidReservationStatus(status: string): status is ReservationStatus {
  return RESERVATION_STATUSES.includes(status as ReservationStatus);
}

function parseReservation(raw: Record<string, unknown>): Reservation {
  const status = typeof raw.status === "string" && isValidReservationStatus(raw.status)
    ? raw.status
    : "booked";

  // Handle joined data from rooms and guests
  const rooms = raw.rooms as Record<string, unknown> | null;
  const guests = raw.guests as Record<string, unknown> | null;

  return {
    id: String(raw.id ?? ""),
    room_id: String(raw.room_id ?? ""),
    guest_id: String(raw.guest_id ?? ""),
    check_in_date: String(raw.check_in_date ?? ""),
    check_out_date: String(raw.check_out_date ?? ""),
    status,
    base_price: typeof raw.base_price === "number" ? raw.base_price : 0,
    discount: typeof raw.discount === "number" ? raw.discount : 0,
    final_price: typeof raw.final_price === "number" ? raw.final_price : 0,
    notes: raw.notes as string | null | undefined,
    created_at: raw.created_at as string | undefined,
    room_number: rooms?.number as string | undefined,
    guest_name: guests?.name as string | undefined,
  };
}

export function useReservations(): UseReservationsResult {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      const { data, error: fetchError } = await supabase
        .from("reservations")
        .select(`
          *,
          rooms:room_id(number),
          guests:guest_id(name)
        `)
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

  const createReservation = useCallback(async (payload: CreateReservationPayload): Promise<void> => {
    const insertData = {
      room_id: payload.room_id,
      guest_id: payload.guest_id,
      check_in_date: payload.check_in_date,
      check_out_date: payload.check_out_date,
      status: "booked" as ReservationStatus,
      base_price: payload.base_price,
      discount: payload.discount ?? 0,
      final_price: payload.final_price,
      notes: payload.notes ?? null,
    };

    const { error: insertError } = await supabase.from("reservations").insert(insertData);

    if (insertError) {
      throw new Error(`Error al crear reserva: ${insertError.message}`);
    }

    await refresh();
  }, [refresh]);

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
