import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Guest {
  id: string;
  name: string;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
}

export type CreateGuestPayload = Omit<Guest, "id">;
export type UpdateGuestPayload = Partial<Omit<Guest, "id">>;

export interface UseGuestsResult {
  guests: Guest[];
  loading: boolean;
  error?: string;
  search: string;
  setSearch: (value: string) => void;
  refresh: () => Promise<void>;
  createGuest: (payload: CreateGuestPayload) => Promise<void>;
  updateGuest: (id: string, payload: UpdateGuestPayload) => Promise<void>;
}

function parseGuest(raw: Record<string, unknown>): Guest {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    document: raw.document as string | null | undefined,
    phone: raw.phone as string | null | undefined,
    email: raw.email as string | null | undefined,
  };
}

export function useGuests(): UseGuestsResult {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      let query = supabase
        .from("guests")
        .select("*")
        .order("created_at", { ascending: false });

      // Apply server-side search filter if search term exists
      const searchTerm = search.trim();
      if (searchTerm) {
        // Use ilike for case-insensitive search on name and document
        query = query.or(`name.ilike.%${searchTerm}%,document.ilike.%${searchTerm}%`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setError(`Error al cargar huéspedes: ${fetchError.message}`);
        return;
      }

      const parsedGuests = (data ?? []).map((row) => parseGuest(row as Record<string, unknown>));
      setGuests(parsedGuests);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(`Error al cargar huéspedes: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [search]);

  const createGuest = useCallback(async (payload: CreateGuestPayload): Promise<void> => {
    const insertData = {
      name: payload.name,
      document: payload.document ?? null,
      phone: payload.phone ?? null,
      email: payload.email ?? null,
    };

    const { error: insertError } = await supabase.from("guests").insert(insertData);

    if (insertError) {
      throw new Error(`Error al crear huésped: ${insertError.message}`);
    }

    await refresh();
  }, [refresh]);

  const updateGuest = useCallback(async (id: string, payload: UpdateGuestPayload): Promise<void> => {
    if (!id) {
      throw new Error("Se requiere el ID del huésped para actualizar");
    }

    const updateData: Record<string, unknown> = {};

    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.document !== undefined) updateData.document = payload.document;
    if (payload.phone !== undefined) updateData.phone = payload.phone;
    if (payload.email !== undefined) updateData.email = payload.email;

    if (Object.keys(updateData).length === 0) {
      return;
    }

    const { error: updateError } = await supabase
      .from("guests")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      throw new Error(`Error al actualizar huésped: ${updateError.message}`);
    }

    await refresh();
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    guests,
    loading,
    error,
    search,
    setSearch,
    refresh,
    createGuest,
    updateGuest,
  };
}
