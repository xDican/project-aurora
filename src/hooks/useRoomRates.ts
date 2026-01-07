import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type OccupancyType = "sencilla" | "doble" | "triple";

export interface RoomRate {
  id: string;
  room_id: string;
  occupancy: OccupancyType;
  price: number;
  is_active: boolean;
  created_at: string;
}

export interface UseRoomRatesResult {
  loading: boolean;
  error?: string;
  fetchRatesForRoom: (roomId: string, activeOnly?: boolean) => Promise<RoomRate[]>;
  createRate: (roomId: string, occupancy: OccupancyType, price: number) => Promise<void>;
  updateRatePrice: (rateId: string, price: number) => Promise<void>;
  toggleRateActive: (rateId: string, isActive: boolean) => Promise<void>;
}

export function useRoomRates(): UseRoomRatesResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const fetchRatesForRoom = useCallback(
    async (roomId: string, activeOnly = true): Promise<RoomRate[]> => {
      setLoading(true);
      setError(undefined);

      try {
        let query = supabase
          .from("room_rates")
          .select("id, room_id, occupancy, price, is_active, created_at")
          .eq("room_id", roomId)
          .order("occupancy", { ascending: true });

        if (activeOnly) {
          query = query.eq("is_active", true);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) {
          throw new Error(fetchError.message);
        }

        return (data ?? []) as RoomRate[];
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error inesperado";
        setError(message);
        return [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const createRate = useCallback(
    async (roomId: string, occupancy: OccupancyType, price: number): Promise<void> => {
      setLoading(true);
      setError(undefined);

      try {
        const { error: insertError } = await supabase
          .from("room_rates")
          .insert({
            room_id: roomId,
            occupancy,
            price,
            is_active: true,
          });

        if (insertError) {
          throw new Error(insertError.message);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error inesperado";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateRatePrice = useCallback(
    async (rateId: string, price: number): Promise<void> => {
      setLoading(true);
      setError(undefined);

      try {
        const { error: updateError } = await supabase
          .from("room_rates")
          .update({ price })
          .eq("id", rateId);

        if (updateError) {
          throw new Error(updateError.message);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error inesperado";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const toggleRateActive = useCallback(
    async (rateId: string, isActive: boolean): Promise<void> => {
      setLoading(true);
      setError(undefined);

      try {
        const { error: updateError } = await supabase
          .from("room_rates")
          .update({ is_active: isActive })
          .eq("id", rateId);

        if (updateError) {
          throw new Error(updateError.message);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error inesperado";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    error,
    fetchRatesForRoom,
    createRate,
    updateRatePrice,
    toggleRateActive,
  };
}
