import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SalonMenu {
  id: string;
  name: string;
  price_per_person: number;
  is_active: boolean;
  created_at: string;
}

export interface NewSalonMenuInput {
  name: string;
  price_per_person: number;
}

export interface UseSalonMenusResult {
  menus: SalonMenu[];
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
  createMenu: (input: NewSalonMenuInput) => Promise<void>;
  updateMenu: (id: string, input: Partial<NewSalonMenuInput> & { is_active?: boolean }) => Promise<void>;
}

export function useSalonMenus(onlyActive = false): UseSalonMenusResult {
  const [menus, setMenus] = useState<SalonMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      let query = supabase.from("salon_menus").select("*").order("name");
      if (onlyActive) query = query.eq("is_active", true);

      const { data, error: fetchError } = await query;
      if (fetchError) {
        setError(`Error al cargar menús: ${fetchError.message}`);
        return;
      }
      setMenus((data ?? []) as SalonMenu[]);
    } finally {
      setLoading(false);
    }
  }, [onlyActive]);

  const createMenu = useCallback(async (input: NewSalonMenuInput): Promise<void> => {
    const { error: insertError } = await supabase.from("salon_menus").insert(input);
    if (insertError) throw new Error(`Error al crear menú: ${insertError.message}`);
    await refresh();
  }, [refresh]);

  const updateMenu = useCallback(async (
    id: string,
    input: Partial<NewSalonMenuInput> & { is_active?: boolean }
  ): Promise<void> => {
    const { error: updateError } = await supabase
      .from("salon_menus")
      .update(input)
      .eq("id", id);
    if (updateError) throw new Error(`Error al actualizar menú: ${updateError.message}`);
    await refresh();
  }, [refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  return { menus, loading, error, refresh, createMenu, updateMenu };
}
