import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { es } from "@/lib/i18n/es";

export interface KPIsData {
  total_reservas_activas: number;
  total_canceladas: number;
  total_no_show: number;
  ingresos_estimados: number;
}

export interface ReservationReport {
  id: string;
  room_number: string;
  guest_name: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
  final_price: number;
  occupancy: string | null;
}

export interface OccupancyDaily {
  day: string;
  occupied_rooms: number;
  total_rooms: number;
  occupancy_pct: number;
}

export interface RevenueDaily {
  day: string;
  revenue: number;
}

export interface ReportsFilters {
  startDate: string;
  endDate: string;
  status?: string | null;
  roomId?: string | null;
  guestId?: string | null;
}

export function useReports() {
  const [kpis, setKpis] = useState<KPIsData | null>(null);
  const [reservations, setReservations] = useState<ReservationReport[]>([]);
  const [occupancy, setOccupancy] = useState<OccupancyDaily[]>([]);
  const [revenue, setRevenue] = useState<RevenueDaily[]>([]);

  const [loadingKpis, setLoadingKpis] = useState(false);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [loadingOccupancy, setLoadingOccupancy] = useState(false);
  const [loadingRevenue, setLoadingRevenue] = useState(false);

  const [errorKpis, setErrorKpis] = useState<string | null>(null);
  const [errorReservations, setErrorReservations] = useState<string | null>(null);
  const [errorOccupancy, setErrorOccupancy] = useState<string | null>(null);
  const [errorRevenue, setErrorRevenue] = useState<string | null>(null);

  const fetchKpis = useCallback(async (startDate: string, endDate: string) => {
    setLoadingKpis(true);
    setErrorKpis(null);
    try {
      const { data, error } = await supabase.rpc("report_kpis", {
        p_start: startDate,
        p_end: endDate,
      });
      if (error) throw error;
      setKpis(data?.[0] || null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setErrorKpis(message);
      toast.error(es.reportsPage.errors.loadKpis);
    } finally {
      setLoadingKpis(false);
    }
  }, []);

  const fetchReservations = useCallback(async (filters: ReportsFilters) => {
    setLoadingReservations(true);
    setErrorReservations(null);
    try {
      const { data, error } = await supabase.rpc("report_reservations", {
        p_start: filters.startDate,
        p_end: filters.endDate,
        p_status: filters.status || null,
        p_room_id: filters.roomId || null,
        p_guest_id: filters.guestId || null,
      });
      if (error) throw error;
      setReservations((data as ReservationReport[]) || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setErrorReservations(message);
      toast.error(es.reportsPage.errors.loadReservations);
    } finally {
      setLoadingReservations(false);
    }
  }, []);

  const fetchOccupancy = useCallback(async (startDate: string, endDate: string) => {
    setLoadingOccupancy(true);
    setErrorOccupancy(null);
    try {
      const { data, error } = await supabase.rpc("report_occupancy_daily", {
        p_start: startDate,
        p_end: endDate,
      });
      if (error) throw error;
      setOccupancy((data as OccupancyDaily[]) || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setErrorOccupancy(message);
      toast.error(es.reportsPage.errors.loadOccupancy);
    } finally {
      setLoadingOccupancy(false);
    }
  }, []);

  const fetchRevenue = useCallback(async (startDate: string, endDate: string) => {
    setLoadingRevenue(true);
    setErrorRevenue(null);
    try {
      const { data, error } = await supabase.rpc("report_revenue_daily", {
        p_start: startDate,
        p_end: endDate,
      });
      if (error) throw error;
      setRevenue((data as RevenueDaily[]) || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setErrorRevenue(message);
      toast.error(es.reportsPage.errors.loadRevenue);
    } finally {
      setLoadingRevenue(false);
    }
  }, []);

  return {
    kpis,
    reservations,
    occupancy,
    revenue,
    loadingKpis,
    loadingReservations,
    loadingOccupancy,
    loadingRevenue,
    errorKpis,
    errorReservations,
    errorOccupancy,
    errorRevenue,
    fetchKpis,
    fetchReservations,
    fetchOccupancy,
    fetchRevenue,
  };
}
