import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SalonConfig {
  id: string;
  coffee_price_per_person: number;
  coffee_min_attendees: number;
  cookies_price: number;
  updated_at: string;
}

export type SalonConfigInput = Omit<SalonConfig, "id" | "updated_at">;

export interface UseSalonConfigResult {
  config: SalonConfig | null;
  loading: boolean;
  error?: string;
  saveConfig: (input: SalonConfigInput) => Promise<void>;
}

export function useSalonConfig(): UseSalonConfigResult {
  const [config, setConfig] = useState<SalonConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const { data, error: fetchError } = await supabase
        .from("salon_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (fetchError) { setError(`Error al cargar configuración: ${fetchError.message}`); return; }
      setConfig(data as SalonConfig | null);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveConfig = useCallback(async (input: SalonConfigInput): Promise<void> => {
    const payload = { ...input, updated_at: new Date().toISOString() };
    if (config?.id) {
      const { error: updateError } = await supabase.from("salon_config").update(payload).eq("id", config.id);
      if (updateError) throw new Error(`Error al guardar: ${updateError.message}`);
    } else {
      const { error: insertError } = await supabase.from("salon_config").insert(payload);
      if (insertError) throw new Error(`Error al guardar: ${insertError.message}`);
    }
    await refresh();
  }, [config, refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  return { config, loading, error, saveConfig };
}
