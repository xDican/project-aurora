import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SalonSpace {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface UseSalonSpacesResult {
  spaces: SalonSpace[];
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
  createSpace: (name: string) => Promise<string>;
  updateSpace: (id: string, updates: { name?: string; is_active?: boolean }) => Promise<void>;
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

  const createSpace = useCallback(async (name: string): Promise<string> => {
    const { data, error: insertError } = await supabase.from("salon_spaces").insert({ name }).select("id").single();
    if (insertError) throw new Error(`Error al crear espacio: ${insertError.message}`);
    await refresh();
    return data.id;
  }, [refresh]);

  const updateSpace = useCallback(async (id: string, updates: { name?: string; is_active?: boolean }): Promise<void> => {
    const { error: updateError } = await supabase.from("salon_spaces").update(updates).eq("id", id);
    if (updateError) throw new Error(`Error al actualizar espacio: ${updateError.message}`);
    await refresh();
  }, [refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  return { spaces, loading, error, refresh, createSpace, updateSpace };
}
