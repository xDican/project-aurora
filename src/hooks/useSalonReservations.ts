import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { differenceInDays, parseISO } from "date-fns";

export const SALON_RESERVATION_STATUSES = ["booked", "done", "cancelled"] as const;
export type SalonReservationStatus = (typeof SALON_RESERVATION_STATUSES)[number];

export interface SalonReservationResource {
  resourceId: string;
  resourceName: string;
  quantityRequested: number;
  unitPrice: number;
}

export interface SalonReservationListItem {
  id: string;
  guestId: string;
  guestName: string;
  spaceId: string;
  spaceName: string;
  slotId: string;
  slotName: string;
  startDate: string;
  endDate: string;
  numDays: number;
  status: SalonReservationStatus;
  attendees: number | null;
  resources: SalonReservationResource[];
  menuId: string | null;
  menuName: string | null;
  coffeeStation: boolean;
  coffeeCookies: boolean;
  basePrice: number;
  addonsPrice: number;
  discount: number;
  finalPrice: number;
  notes: string | null;
}

export interface NewSalonReservationResourceInput {
  resourceId: string;
  quantityRequested: number;
}

export interface NewSalonReservationInput {
  guestId: string;
  spaceId: string;
  slotId: string;
  startDate: string;
  endDate: string;
  attendees: number | null;
  resources: NewSalonReservationResourceInput[];
  menuId: string | null;
  coffeeStation: boolean;
  coffeeCookies: boolean;
  basePrice: number;
  addonsPrice: number;
  finalPrice: number;
  notes: string | null;
}

export interface UseSalonReservationsResult {
  reservations: SalonReservationListItem[];
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
  createReservation: (input: NewSalonReservationInput) => Promise<void>;
  updateReservation: (id: string, input: NewSalonReservationInput) => Promise<void>;
  cancelReservation: (id: string) => Promise<void>;
  markDone: (id: string) => Promise<void>;
  applyDiscount: (id: string, discount: number) => Promise<void>;
}

function isValidStatus(s: string): s is SalonReservationStatus {
  return SALON_RESERVATION_STATUSES.includes(s as SalonReservationStatus);
}

export function useSalonReservations(): UseSalonReservationsResult {
  const [reservations, setReservations] = useState<SalonReservationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [resResult, spacesResult, slotsResult, guestsResult, menusResult, resResourcesResult, resourcesResult] = await Promise.all([
        supabase.from("salon_reservations").select("*").order("start_date", { ascending: false }),
        supabase.from("salon_spaces").select("id, name"),
        supabase.from("salon_slots").select("id, name"),
        supabase.from("guests").select("id, name").eq("is_active", true),
        supabase.from("salon_menus").select("id, name"),
        supabase.from("salon_reservation_resources").select("reservation_id, resource_id, quantity_requested"),
        supabase.from("salon_resources").select("id, name, price"),
      ]);

      if (resResult.error)          { setError(`Error al cargar reservas: ${resResult.error.message}`); return; }
      if (spacesResult.error)       { setError(`Error al cargar espacios: ${spacesResult.error.message}`); return; }
      if (slotsResult.error)        { setError(`Error al cargar slots: ${slotsResult.error.message}`); return; }
      if (guestsResult.error)       { setError(`Error al cargar huéspedes: ${guestsResult.error.message}`); return; }
      if (menusResult.error)        { setError(`Error al cargar menús: ${menusResult.error.message}`); return; }
      if (resResourcesResult.error) { setError(`Error al cargar recursos: ${resResourcesResult.error.message}`); return; }

      const spaceMap    = new Map((spacesResult.data ?? []).map((s) => [s.id, s.name]));
      const slotMap     = new Map((slotsResult.data  ?? []).map((s) => [s.id, s.name]));
      const guestMap    = new Map((guestsResult.data ?? []).map((g) => [g.id, g.name]));
      const menuMap     = new Map((menusResult.data  ?? []).map((m) => [m.id, m.name]));
      const resourceMap = new Map((resourcesResult.data ?? []).map((r) => [r.id, { name: r.name, price: r.price }]));

      // Group reservation_resources by reservation_id
      const resResourceMap = new Map<string, SalonReservationResource[]>();
      for (const rr of (resResourcesResult.data ?? [])) {
        const res = resourceMap.get(rr.resource_id);
        if (!resResourceMap.has(rr.reservation_id)) resResourceMap.set(rr.reservation_id, []);
        resResourceMap.get(rr.reservation_id)!.push({
          resourceId: rr.resource_id,
          resourceName: res?.name ?? "",
          quantityRequested: rr.quantity_requested,
          unitPrice: res?.price ?? 0,
        });
      }

      const items: SalonReservationListItem[] = (resResult.data ?? []).map((r) => ({
        id:           r.id,
        guestId:      r.guest_id,
        guestName:    guestMap.get(r.guest_id) ?? "",
        spaceId:      r.space_id ?? "",
        spaceName:    r.space_id ? (spaceMap.get(r.space_id) ?? "") : "",
        slotId:       r.slot_id,
        slotName:     slotMap.get(r.slot_id) ?? "",
        startDate:    r.start_date,
        endDate:      r.end_date,
        numDays:      differenceInDays(parseISO(r.end_date), parseISO(r.start_date)) + 1,
        status:       isValidStatus(r.status) ? r.status : "booked",
        attendees:    r.attendees,
        resources:    resResourceMap.get(r.id) ?? [],
        menuId:       r.menu_id,
        menuName:     r.menu_id ? (menuMap.get(r.menu_id) ?? null) : null,
        coffeeStation: r.coffee_station,
        coffeeCookies: r.coffee_cookies,
        basePrice:    r.base_price,
        addonsPrice:  r.addons_price,
        discount:     r.discount,
        finalPrice:   r.final_price,
        notes:        r.notes,
      }));

      setReservations(items);
    } finally {
      setLoading(false);
    }
  }, []);

  // Mapea el mensaje crudo de Postgres a un error semántico para la UI.
  const mapSalonError = (msg: string): Error => {
    const unavailable = msg.match(/RESOURCE_UNAVAILABLE:([0-9a-f-]+)/i);
    if (unavailable) return new Error(`RESOURCE_UNAVAILABLE:${unavailable[1]}`);
    if (msg.includes("SALON_OVERLAP")) return new Error("SALON_OVERLAP");
    if (msg.includes("NOT_EDITABLE")) return new Error("NOT_EDITABLE");
    return new Error(msg);
  };

  const createReservation = useCallback(async (input: NewSalonReservationInput): Promise<void> => {
    if (input.endDate < input.startDate) throw new Error("INVALID_DATES");
    const today = new Date().toISOString().split("T")[0];
    if (input.startDate < today) throw new Error("PAST_START_DATE");

    // Atómico en Postgres: reserva + recursos en una transacción. Si un recurso no
    // está disponible, el trigger revierte todo y no queda reserva huérfana.
    const { error } = await supabase.rpc("create_salon_reservation", {
      p_guest_id:      input.guestId,
      p_space_id:      input.spaceId,
      p_slot_id:       input.slotId,
      p_start_date:    input.startDate,
      p_end_date:      input.endDate,
      p_attendees:     input.attendees,
      p_menu_id:       input.menuId,
      p_coffee_station: input.coffeeStation,
      p_coffee_cookies: input.coffeeCookies,
      p_base_price:    input.basePrice,
      p_addons_price:  input.addonsPrice,
      p_final_price:   input.finalPrice,
      p_notes:         input.notes,
      p_resources:     input.resources as unknown as Json,
    });

    if (error) throw mapSalonError(error.message);
    await refresh();
  }, [refresh]);

  const updateReservation = useCallback(async (id: string, input: NewSalonReservationInput): Promise<void> => {
    const current = reservations.find((r) => r.id === id);
    if (current && current.status !== "booked") throw new Error("NOT_EDITABLE");
    if (input.endDate < input.startDate) throw new Error("INVALID_DATES");

    // Atómico: actualiza la reserva y reemplaza sus recursos en una transacción.
    const { error } = await supabase.rpc("update_salon_reservation", {
      p_id:            id,
      p_guest_id:      input.guestId,
      p_space_id:      input.spaceId,
      p_slot_id:       input.slotId,
      p_start_date:    input.startDate,
      p_end_date:      input.endDate,
      p_attendees:     input.attendees,
      p_menu_id:       input.menuId,
      p_coffee_station: input.coffeeStation,
      p_coffee_cookies: input.coffeeCookies,
      p_base_price:    input.basePrice,
      p_addons_price:  input.addonsPrice,
      p_final_price:   input.finalPrice,
      p_notes:         input.notes,
      p_resources:     input.resources as unknown as Json,
    });

    if (error) throw mapSalonError(error.message);
    await refresh();
  }, [reservations, refresh]);

  const cancelReservation = useCallback(async (id: string): Promise<void> => {
    const current = reservations.find((r) => r.id === id);
    if (current && current.status !== "booked") throw new Error(`No se puede cancelar: estado "${current.status}"`);
    const { error } = await supabase.from("salon_reservations").update({ status: "cancelled" }).eq("id", id);
    if (error) throw new Error(`Error al cancelar: ${error.message}`);
    await refresh();
  }, [reservations, refresh]);

  const markDone = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from("salon_reservations").update({ status: "done" }).eq("id", id);
    if (error) throw new Error(`Error al completar: ${error.message}`);
    await refresh();
  }, [refresh]);

  const applyDiscount = useCallback(async (id: string, discount: number): Promise<void> => {
    const { error: rpcError } = await supabase.rpc("apply_salon_discount", { p_reservation_id: id, p_discount: discount });
    if (rpcError) {
      if (rpcError.message.includes("not allowed")) throw new Error("NOT_ALLOWED");
      if (rpcError.message.includes("INVALID_DISCOUNT")) throw new Error("INVALID_DISCOUNT");
      throw new Error(`Error al aplicar descuento: ${rpcError.message}`);
    }
    await refresh();
  }, [refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  return { reservations, loading, error, refresh, createReservation, updateReservation, cancelReservation, markDone, applyDiscount };
}
