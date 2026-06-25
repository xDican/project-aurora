import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, parseISO } from "date-fns";

export const SALON_RESERVATION_STATUSES = ["booked", "done", "cancelled"] as const;
export type SalonReservationStatus = (typeof SALON_RESERVATION_STATUSES)[number];
export type AudioPackage = "none" | "basic" | "complete";

export interface SalonReservationListItem {
  id: string;
  guestId: string;
  guestName: string;
  slotId: string;
  slotName: string;
  startDate: string;
  endDate: string;
  numDays: number;
  status: SalonReservationStatus;
  attendees: number | null;
  includesProjector: boolean;
  includesScreen: boolean;
  audioPackage: AudioPackage;
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

export interface NewSalonReservationInput {
  guestId: string;
  slotId: string;
  startDate: string;
  endDate: string;
  attendees: number | null;
  includesProjector: boolean;
  includesScreen: boolean;
  audioPackage: AudioPackage;
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

function isValidAudio(s: string): s is AudioPackage {
  return ["none", "basic", "complete"].includes(s);
}

export function useSalonReservations(): UseSalonReservationsResult {
  const [reservations, setReservations] = useState<SalonReservationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [resResult, slotsResult, guestsResult, menusResult] = await Promise.all([
        supabase
          .from("salon_reservations")
          .select("*")
          .order("start_date", { ascending: false }),
        supabase.from("salon_slots").select("id, name"),
        supabase.from("guests").select("id, name").eq("is_active", true),
        supabase.from("salon_menus").select("id, name"),
      ]);

      if (resResult.error)    { setError(`Error al cargar reservas: ${resResult.error.message}`); return; }
      if (slotsResult.error)  { setError(`Error al cargar slots: ${slotsResult.error.message}`); return; }
      if (guestsResult.error) { setError(`Error al cargar huéspedes: ${guestsResult.error.message}`); return; }
      if (menusResult.error)  { setError(`Error al cargar menús: ${menusResult.error.message}`); return; }

      const slotMap  = new Map((slotsResult.data  ?? []).map((s) => [s.id, s.name]));
      const guestMap = new Map((guestsResult.data ?? []).map((g) => [g.id, g.name]));
      const menuMap  = new Map((menusResult.data  ?? []).map((m) => [m.id, m.name]));

      const items: SalonReservationListItem[] = (resResult.data ?? []).map((r) => ({
        id:                r.id,
        guestId:           r.guest_id,
        guestName:         guestMap.get(r.guest_id) ?? "",
        slotId:            r.slot_id,
        slotName:          slotMap.get(r.slot_id) ?? "",
        startDate:         r.start_date,
        endDate:           r.end_date,
        numDays:           differenceInDays(parseISO(r.end_date), parseISO(r.start_date)) + 1,
        status:            isValidStatus(r.status) ? r.status : "booked",
        attendees:         r.attendees,
        includesProjector: r.includes_projector,
        includesScreen:    r.includes_screen,
        audioPackage:      isValidAudio(r.audio_package) ? r.audio_package : "none",
        menuId:            r.menu_id,
        menuName:          r.menu_id ? (menuMap.get(r.menu_id) ?? null) : null,
        coffeeStation:     r.coffee_station,
        coffeeCookies:     r.coffee_cookies,
        basePrice:         r.base_price,
        addonsPrice:       r.addons_price,
        discount:          r.discount,
        finalPrice:        r.final_price,
        notes:             r.notes,
      }));

      setReservations(items);
    } finally {
      setLoading(false);
    }
  }, []);

  const createReservation = useCallback(async (input: NewSalonReservationInput): Promise<void> => {
    if (input.endDate < input.startDate) throw new Error("INVALID_DATES");
    const today = new Date().toISOString().split("T")[0];
    if (input.startDate < today) throw new Error("PAST_START_DATE");

    const { error: insertError } = await supabase.from("salon_reservations").insert({
      guest_id:           input.guestId,
      slot_id:            input.slotId,
      start_date:         input.startDate,
      end_date:           input.endDate,
      attendees:          input.attendees,
      includes_projector: input.includesProjector,
      includes_screen:    input.includesScreen,
      audio_package:      input.audioPackage,
      menu_id:            input.menuId,
      coffee_station:     input.coffeeStation,
      coffee_cookies:     input.coffeeCookies,
      base_price:         input.basePrice,
      addons_price:       input.addonsPrice,
      final_price:        input.finalPrice,
      notes:              input.notes,
    });

    if (insertError) {
      if (insertError.message.includes("SALON_OVERLAP")) throw new Error("SALON_OVERLAP");
      throw new Error(`Error al crear reserva: ${insertError.message}`);
    }
    await refresh();
  }, [refresh]);

  const updateReservation = useCallback(async (id: string, input: NewSalonReservationInput): Promise<void> => {
    const current = reservations.find((r) => r.id === id);
    if (current && current.status !== "booked") {
      throw new Error(`No se puede editar: estado "${current.status}"`);
    }
    if (input.endDate < input.startDate) throw new Error("INVALID_DATES");

    const { error: updateError } = await supabase
      .from("salon_reservations")
      .update({
        guest_id:           input.guestId,
        slot_id:            input.slotId,
        start_date:         input.startDate,
        end_date:           input.endDate,
        attendees:          input.attendees,
        includes_projector: input.includesProjector,
        includes_screen:    input.includesScreen,
        audio_package:      input.audioPackage,
        menu_id:            input.menuId,
        coffee_station:     input.coffeeStation,
        coffee_cookies:     input.coffeeCookies,
        base_price:         input.basePrice,
        addons_price:       input.addonsPrice,
        final_price:        input.finalPrice,
        notes:              input.notes,
      })
      .eq("id", id);

    if (updateError) {
      if (updateError.message.includes("SALON_OVERLAP")) throw new Error("SALON_OVERLAP");
      throw new Error(`Error al actualizar reserva: ${updateError.message}`);
    }
    await refresh();
  }, [reservations, refresh]);

  const cancelReservation = useCallback(async (id: string): Promise<void> => {
    const current = reservations.find((r) => r.id === id);
    if (current && !["booked"].includes(current.status)) {
      throw new Error(`No se puede cancelar: estado "${current.status}"`);
    }
    const { error: updateError } = await supabase
      .from("salon_reservations")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (updateError) throw new Error(`Error al cancelar: ${updateError.message}`);
    await refresh();
  }, [reservations, refresh]);

  const markDone = useCallback(async (id: string): Promise<void> => {
    const { error: updateError } = await supabase
      .from("salon_reservations")
      .update({ status: "done" })
      .eq("id", id);
    if (updateError) throw new Error(`Error al marcar como completada: ${updateError.message}`);
    await refresh();
  }, [refresh]);

  const applyDiscount = useCallback(async (id: string, discount: number): Promise<void> => {
    const { error: rpcError } = await supabase.rpc("apply_salon_discount", {
      p_reservation_id: id,
      p_discount: discount,
    });
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
