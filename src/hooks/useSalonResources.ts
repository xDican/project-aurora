import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SalonResource {
  id: string;
  name: string;
  description: string | null;
  price: number;
  quantity: number;
  is_active: boolean;
  created_at: string;
}

export interface NewSalonResourceInput {
  name: string;
  description?: string | null;
  price: number;
  quantity: number;
}

export interface UseSalonResourcesResult {
  resources: SalonResource[];
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
  createResource: (input: NewSalonResourceInput) => Promise<void>;
  updateResource: (id: string, input: Partial<NewSalonResourceInput> & { is_active?: boolean }) => Promise<void>;
}

export function useSalonResources(onlyActive = false): UseSalonResourcesResult {
  const [resources, setResources] = useState<SalonResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      let query = supabase.from("salon_resources").select("*").order("name");
      if (onlyActive) query = query.eq("is_active", true);
      const { data, error: fetchError } = await query;
      if (fetchError) { setError(`Error al cargar recursos: ${fetchError.message}`); return; }
      setResources((data ?? []) as SalonResource[]);
    } finally {
      setLoading(false);
    }
  }, [onlyActive]);

  const createResource = useCallback(async (input: NewSalonResourceInput): Promise<void> => {
    const { error: insertError } = await supabase.from("salon_resources").insert({
      name: input.name,
      description: input.description ?? null,
      price: input.price,
      quantity: input.quantity,
    });
    if (insertError) throw new Error(`Error al crear recurso: ${insertError.message}`);
    await refresh();
  }, [refresh]);

  const updateResource = useCallback(async (
    id: string,
    input: Partial<NewSalonResourceInput> & { is_active?: boolean }
  ): Promise<void> => {
    const { error: updateError } = await supabase
      .from("salon_resources")
      .update(input)
      .eq("id", id);
    if (updateError) throw new Error(`Error al actualizar recurso: ${updateError.message}`);
    await refresh();
  }, [refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  return { resources, loading, error, refresh, createResource, updateResource };
}
