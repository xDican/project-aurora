import { useState, useEffect, useCallback } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { es as dateEs } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { es } from "@/lib/i18n/es";
import { useReports } from "@/hooks/useReports";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const tabsListClass = "border-b border-outline-variant bg-transparent p-0 h-auto justify-start rounded-none w-full";
const tabsTriggerClass =
  "rounded-none border-b-2 border-transparent px-6 py-3 text-body-md text-on-surface-variant data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:font-bold";

interface Room {
  id: string;
  number: string;
}

interface Guest {
  id: string;
  name: string;
}

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "booked", label: "Reservada" },
  { value: "checked_in", label: "Check-in" },
  { value: "checked_out", label: "Check-out" },
  { value: "cancelled", label: "Cancelada" },
  { value: "no_show", label: "No-show" },
];

export default function Reportes() {
  // Date range (default: current month)
  const [startDate, setStartDate] = useState(() =>
    format(startOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState(() =>
    format(endOfMonth(new Date()), "yyyy-MM-dd")
  );

  // Filters for reservations tab
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roomFilter, setRoomFilter] = useState<string>("all");
  const [guestFilter, setGuestFilter] = useState<string>("all");

  // Dropdowns data
  const [rooms, setRooms] = useState<Room[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);

  // Active tab
  const [activeTab, setActiveTab] = useState("resumen");

  const {
    kpis,
    reservations,
    occupancy,
    revenue,
    loadingKpis,
    loadingReservations,
    loadingOccupancy,
    loadingRevenue,
    fetchKpis,
    fetchReservations,
    fetchOccupancy,
    fetchRevenue,
  } = useReports();

  // Validate date range
  const isValidRange = new Date(endDate) >= new Date(startDate);

  // Fetch rooms and guests for filters
  useEffect(() => {
    const fetchFiltersData = async () => {
      const [roomsRes, guestsRes] = await Promise.all([
        supabase.from("rooms").select("id, number").eq("is_active", true).order("number"),
        supabase.from("guests").select("id, name").eq("is_active", true).order("name"),
      ]);
      if (roomsRes.data) setRooms(roomsRes.data);
      if (guestsRes.data) setGuests(guestsRes.data);
    };
    fetchFiltersData();
  }, []);

  // Load data for active tab
  const loadActiveTabData = useCallback(async () => {
    if (!isValidRange) return;

    switch (activeTab) {
      case "resumen":
        await fetchKpis(startDate, endDate);
        break;
      case "reservas":
        await fetchReservations({
          startDate,
          endDate,
          status: statusFilter === "all" ? null : statusFilter,
          roomId: roomFilter === "all" ? null : roomFilter,
          guestId: guestFilter === "all" ? null : guestFilter,
        });
        break;
      case "ocupacion":
        await fetchOccupancy(startDate, endDate);
        break;
      case "ingresos":
        await fetchRevenue(startDate, endDate);
        break;
    }
  }, [
    activeTab,
    startDate,
    endDate,
    statusFilter,
    roomFilter,
    guestFilter,
    isValidRange,
    fetchKpis,
    fetchReservations,
    fetchOccupancy,
    fetchRevenue,
  ]);

  // Load on tab change
  useEffect(() => {
    loadActiveTabData();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Export CSV
  const exportCSV = () => {
    const t = es.reportsPage.reservationsTab;
    const headers = [
      t.columns.room,
      t.columns.guest,
      t.columns.checkIn,
      t.columns.checkOut,
      t.columns.status,
      t.columns.price,
      t.columns.occupancy,
    ];
    const rows = reservations.map((r) => [
      r.room_number,
      r.guest_name,
      r.check_in_date,
      r.check_out_date,
      r.status,
      r.final_price,
      r.occupancy || "",
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `reservas_${startDate}_${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateStr: string) =>
    format(new Date(dateStr + "T00:00:00"), "dd/MM/yyyy", { locale: dateEs });

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  return (
    <div className="space-y-stack_gap_md">
      {/* Date range selector */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col md:flex-row items-end md:items-center justify-between gap-4">
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <div className="flex flex-col gap-1.5 w-full md:w-48">
            <Label htmlFor="startDate" className="text-label-md text-on-surface-variant">{es.reportsPage.startDate}</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5 w-full md:w-48">
            <Label htmlFor="endDate" className="text-label-md text-on-surface-variant">{es.reportsPage.endDate}</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        <Button onClick={loadActiveTabData} disabled={!isValidRange} className="gap-2 whitespace-nowrap">
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          {es.reportsPage.updateButton}
        </Button>
        {!isValidRange && (
          <span className="text-body-sm text-destructive">
            {es.reportsPage.invalidRange}
          </span>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={tabsListClass}>
          <TabsTrigger value="resumen" className={tabsTriggerClass}>{es.reportsPage.tabs.summary}</TabsTrigger>
          <TabsTrigger value="reservas" className={tabsTriggerClass}>{es.reportsPage.tabs.reservations}</TabsTrigger>
          <TabsTrigger value="ocupacion" className={tabsTriggerClass}>{es.reportsPage.tabs.occupancy}</TabsTrigger>
          <TabsTrigger value="ingresos" className={tabsTriggerClass}>{es.reportsPage.tabs.revenue}</TabsTrigger>
        </TabsList>

        {/* Tab: Resumen */}
        <TabsContent value="resumen" className="space-y-4 mt-6">
          {loadingKpis ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : kpis ? (
            <div className="grid gap-gutter md:grid-cols-2 lg:grid-cols-4">
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between h-28">
                <span className="text-label-md text-on-surface-variant uppercase tracking-wider">
                  {es.reportsPage.kpis.activeReservations}
                </span>
                <span className="text-headline-lg text-foreground">{kpis.total_reservas_activas}</span>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between h-28">
                <span className="text-label-md text-on-surface-variant uppercase tracking-wider">
                  {es.reportsPage.kpis.cancelled}
                </span>
                <span className="text-headline-lg text-foreground">{kpis.total_canceladas}</span>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between h-28">
                <span className="text-label-md text-on-surface-variant uppercase tracking-wider">
                  {es.reportsPage.kpis.noShow}
                </span>
                <span className="text-headline-lg text-foreground">{kpis.total_no_show}</span>
              </div>
              <div className="bg-primary-container/10 border border-primary/20 rounded-xl p-5 flex flex-col justify-between h-28">
                <span className="text-label-md text-on-surface-variant uppercase tracking-wider">
                  {es.reportsPage.kpis.estimatedRevenue}
                </span>
                <span className="text-headline-lg text-primary">
                  {formatCurrency(kpis.ingresos_estimados)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-center text-on-surface-variant py-8">
              {es.reportsPage.reservationsTab.noData}
            </p>
          )}
        </TabsContent>

        {/* Tab: Reservas */}
        <TabsContent value="reservas" className="space-y-4 mt-6">
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-label-md text-on-surface-variant">{es.reportsPage.reservationsTab.statusFilter}</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-label-md text-on-surface-variant">{es.reportsPage.reservationsTab.roomFilter}</Label>
              <Select value={roomFilter} onValueChange={setRoomFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {es.reportsPage.reservationsTab.allRooms}
                  </SelectItem>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-label-md text-on-surface-variant">{es.reportsPage.reservationsTab.guestFilter}</Label>
              <Select value={guestFilter} onValueChange={setGuestFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {es.reportsPage.reservationsTab.allGuests}
                  </SelectItem>
                  {guests.map((guest) => (
                    <SelectItem key={guest.id} value={guest.id}>
                      {guest.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={exportCSV} className="gap-2">
              <span className="material-symbols-outlined text-[18px]">download</span>
              {es.reportsPage.reservationsTab.exportCsv}
            </Button>
          </div>

          {/* Table */}
          {loadingReservations ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : reservations.length > 0 ? (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-low border-b border-outline-variant">
                  <tr>
                    <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant">{es.reportsPage.reservationsTab.columns.room}</th>
                    <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant">{es.reportsPage.reservationsTab.columns.guest}</th>
                    <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant">{es.reportsPage.reservationsTab.columns.checkIn}</th>
                    <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant">{es.reportsPage.reservationsTab.columns.checkOut}</th>
                    <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant">{es.reportsPage.reservationsTab.columns.status}</th>
                    <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant">{es.reportsPage.reservationsTab.columns.occupancy}</th>
                    <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant text-right">
                      {es.reportsPage.reservationsTab.columns.price}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {reservations.map((r) => (
                    <tr key={r.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-table-data text-foreground">{r.room_number}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-table-data text-foreground">{r.guest_name}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-body-md text-on-surface-variant">{formatDate(r.check_in_date)}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-body-md text-on-surface-variant">{formatDate(r.check_out_date)}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-body-md text-on-surface-variant">
                        {STATUS_OPTIONS.find((o) => o.value === r.status)?.label || r.status}
                      </td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-body-md text-on-surface-variant">{r.occupancy || "-"}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-table-data text-foreground text-right">
                        {formatCurrency(r.final_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-on-surface-variant py-8">
              {es.reportsPage.reservationsTab.noData}
            </p>
          )}
        </TabsContent>

        {/* Tab: Ocupación */}
        <TabsContent value="ocupacion" className="space-y-4 mt-6">
          {loadingOccupancy ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : occupancy.length > 0 ? (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-low border-b border-outline-variant">
                  <tr>
                    <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant">{es.reportsPage.occupancyTab.columns.day}</th>
                    <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant text-center">
                      {es.reportsPage.occupancyTab.columns.occupied}
                    </th>
                    <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant text-center">
                      {es.reportsPage.occupancyTab.columns.total}
                    </th>
                    <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant text-right">
                      {es.reportsPage.occupancyTab.columns.percentage}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {occupancy.map((row) => (
                    <tr key={row.day} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-table-data text-foreground">{formatDate(row.day)}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-body-md text-on-surface-variant text-center">{row.occupied_rooms}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-body-md text-on-surface-variant text-center">{row.total_rooms}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-table-data text-foreground text-right">
                        {formatPercent(row.occupancy_pct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-on-surface-variant py-8">
              {es.reportsPage.occupancyTab.noData}
            </p>
          )}
        </TabsContent>

        {/* Tab: Ingresos */}
        <TabsContent value="ingresos" className="space-y-4 mt-6">
          {loadingRevenue ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : revenue.length > 0 ? (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-low border-b border-outline-variant">
                  <tr>
                    <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant">{es.reportsPage.revenueTab.columns.day}</th>
                    <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant text-right">
                      {es.reportsPage.revenueTab.columns.revenue}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {revenue.map((row) => (
                    <tr key={row.day} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-table-data text-foreground">{formatDate(row.day)}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-table-data text-foreground text-right">
                        {formatCurrency(row.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-on-surface-variant py-8">
              {es.reportsPage.revenueTab.noData}
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
