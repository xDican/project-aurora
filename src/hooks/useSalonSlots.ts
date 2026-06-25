import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SalonSlot {
  id: string;
  space_id: string;
  name: string;
  start_time: string;
  end_time: string;
  price_per_day: number;
  is_active: boolean;
  created_at: string;
}

export interface NewSalonSlotInput {
  space_id: string;
  name: string;
  start_time: string;
  end_time: string;
  price_per_day: number;
}

export interface UseSalonSlotsResult {
  slots: SalonSlot[];
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
  createSlot: (input: NewSalonSlotInput) => Promise<void>;
  updateSlot: (id: string, input: Partial<NewSalonSlotInput> & { is_active?: boolean }) => Promise<void>;
}

export function useSalonSlots(spaceId?: string, onlyActive = false): UseSalonSlotsResult {
  const [slots, setSlots] = useState<SalonSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      let query = supabase.from("salon_slots").select("*").order("start_time");
      if (spaceId) query = query.eq("space_id", spaceId);
      if (onlyActive) query = query.eq("is_active", true);

      const { data, error: fetchError } = await query;
      if (fetchError) {
        setError(`Error al cargar slots: ${fetchError.message}`);
        return;
      }
      setSlots((data ?? []) as SalonSlot[]);
    } finally {
      setLoading(false);
    }
  }, [spaceId, onlyActive]);

  const createSlot = useCallback(async (input: NewSalonSlotInput): Promise<void> => {
    const { error: insertError } = await supabase.from("salon_slots").insert(input);
    if (insertError) throw new Error(`Error al crear slot: ${insertError.message}`);
    await refresh();
  }, [refresh]);

  const updateSlot = useCallback(async (
    id: string,
    input: Partial<NewSalonSlotInput> & { is_active?: boolean }
  ): Promise<void> => {
    const { error: updateError } = await supabase
      .from("salon_slots")
      .update(input)
      .eq("id", id);
    if (updateError) throw new Error(`Error al actualizar slot: ${updateError.message}`);
    await refresh();
  }, [refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  return { slots, loading, error, refresh, createSlot, updateSlot };
}
