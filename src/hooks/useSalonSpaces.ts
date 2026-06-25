import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SalonSpace {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface SalonSpaceRate {
  id: string;
  space_id: string;
  slot_id: string;
  price_per_day: number;
  is_active: boolean;
}

export interface UseSalonSpacesResult {
  spaces: SalonSpace[];
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
  createSpace: (name: string) => Promise<void>;
  updateSpace: (id: string, updates: { name?: string; is_active?: boolean }) => Promise<void>;
}

export interface UseSalonSpaceRatesResult {
  rates: SalonSpaceRate[];
  loading: boolean;
  upsertRate: (spaceId: string, slotId: string, pricePerDay: number) => Promise<void>;
}

export function useSalonSpaces(onlyActive = false): UseSalonSpacesResult {
  const [spaces, setSpaces] = useState<SalonSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      let query = supabase.from("salon_spaces").select("*").order("name");
      if (onlyActive) query = query.eq("is_active", true);
      const { data, error: fetchError } = await query;
      if (fetchError) { setError(`Error al cargar espacios: ${fetchError.message}`); return; }
      setSpaces((data ?? []) as SalonSpace[]);
    } finally {
      setLoading(false);
    }
  }, [onlyActive]);

  const createSpace = useCallback(async (name: string): Promise<void> => {
    const { error: insertError } = await supabase.from("salon_spaces").insert({ name });
    if (insertError) throw new Error(`Error al crear espacio: ${insertError.message}`);
    await refresh();
  }, [refresh]);

  const updateSpace = useCallback(async (id: string, updates: { name?: string; is_active?: boolean }): Promise<void> => {
    const { error: updateError } = await supabase.from("salon_spaces").update(updates).eq("id", id);
    if (updateError) throw new Error(`Error al actualizar espacio: ${updateError.message}`);
    await refresh();
  }, [refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  return { spaces, loading, error, refresh, createSpace, updateSpace };
}

export function useSalonSpaceRates(spaceId?: string): UseSalonSpaceRatesResult {
  const [rates, setRates] = useState<SalonSpaceRate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRates = useCallback(async () => {
    if (!spaceId) { setRates([]); return; }
    setLoading(true);
    try {
      const { data } = await supabase
        .from("salon_space_rates")
        .select("*")
        .eq("space_id", spaceId);
      setRates((data ?? []) as SalonSpaceRate[]);
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  const upsertRate = useCallback(async (spaceId: string, slotId: string, pricePerDay: number): Promise<void> => {
    const { error } = await supabase
      .from("salon_space_rates")
      .upsert({ space_id: spaceId, slot_id: slotId, price_per_day: pricePerDay }, { onConflict: "space_id,slot_id" });
    if (error) throw new Error(`Error al guardar tarifa: ${error.message}`);
    await fetchRates();
  }, [fetchRates]);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  return { rates, loading, upsertRate };
}
