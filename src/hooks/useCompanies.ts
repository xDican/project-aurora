import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Company {
  id: string;
  name: string;
  rtn: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  created_at: string;
}

export type CreateCompanyPayload = Omit<Company, "id" | "created_at">;
export type UpdateCompanyPayload = Partial<CreateCompanyPayload>;

export interface UseCompaniesResult {
  companies: Company[];
  loading: boolean;
  error?: string;
  search: string;
  setSearch: (value: string) => void;
  refresh: () => Promise<void>;
  createCompany: (payload: CreateCompanyPayload) => Promise<Company>;
  updateCompany: (id: string, payload: UpdateCompanyPayload) => Promise<void>;
  archiveCompany: (id: string) => Promise<void>;
}

function parseCompany(raw: Record<string, unknown>): Company {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    rtn: String(raw.rtn ?? ""),
    phone: raw.phone as string | null | undefined,
    email: raw.email as string | null | undefined,
    address: raw.address as string | null | undefined,
    created_at: String(raw.created_at ?? ""),
  };
}

// Maps a Supabase error on the companies table to a semantic code the UI translates.
function mapCompanyError(message: string): string | null {
  if (message.includes("companies_rtn_active_unique") || message.includes("duplicate key")) {
    return "RTN_TAKEN";
  }
  if (message.includes("companies_rtn_digits") || message.includes("violates check constraint")) {
    return "RTN_INVALID";
  }
  return null;
}

export function useCompanies(): UseCompaniesResult {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      let query = supabase
        .from("companies")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      const searchTerm = search.trim();
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,rtn.ilike.%${searchTerm}%`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setError(`Error al cargar empresas: ${fetchError.message}`);
        return;
      }

      const parsed = (data ?? []).map((row) => parseCompany(row as Record<string, unknown>));
      setCompanies(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(`Error al cargar empresas: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [search]);

  const createCompany = useCallback(async (payload: CreateCompanyPayload): Promise<Company> => {
    const { data, error: insertError } = await supabase
      .from("companies")
      .insert({
        name: payload.name,
        rtn: payload.rtn,
        phone: payload.phone ?? null,
        email: payload.email ?? null,
        address: payload.address ?? null,
      })
      .select()
      .single();

    if (insertError) {
      const code = mapCompanyError(insertError.message);
      throw new Error(code ?? `Error al crear empresa: ${insertError.message}`);
    }

    await refresh();
    return parseCompany(data as Record<string, unknown>);
  }, [refresh]);

  const updateCompany = useCallback(async (id: string, payload: UpdateCompanyPayload): Promise<void> => {
    if (!id) {
      throw new Error("Se requiere el ID de la empresa para actualizar");
    }

    const { error: updateError } = await supabase
      .from("companies")
      .update({
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.rtn !== undefined ? { rtn: payload.rtn } : {}),
        ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
        ...(payload.email !== undefined ? { email: payload.email } : {}),
        ...(payload.address !== undefined ? { address: payload.address } : {}),
      })
      .eq("id", id);

    if (updateError) {
      const code = mapCompanyError(updateError.message);
      throw new Error(code ?? `Error al actualizar empresa: ${updateError.message}`);
    }

    await refresh();
  }, [refresh]);

  const archiveCompany = useCallback(async (id: string): Promise<void> => {
    if (!id) {
      throw new Error("Se requiere el ID de la empresa para archivar");
    }

    const { error: rpcError } = await supabase.rpc("archive_company", {
      p_company_id: id,
    });

    if (rpcError) {
      if (rpcError.message.includes("not allowed")) {
        throw new Error("NOT_ALLOWED");
      }
      throw new Error(`Error al archivar empresa: ${rpcError.message}`);
    }

    await refresh();
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    companies,
    loading,
    error,
    search,
    setSearch,
    refresh,
    createCompany,
    updateCompany,
    archiveCompany,
  };
}
