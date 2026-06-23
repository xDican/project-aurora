import { useState, useEffect, useCallback } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { es as dateEs } from "date-fns/locale";
import { BarChart3, Download, Loader2, RefreshCw } from "lucide-react";
import { es } from "@/lib/i18n/es";
import { useReports } from "@/hooks/useReports";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">{es.reportsPage.title}</h1>
      </div>

      {/* Date range selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">{es.reportsPage.startDate}</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">{es.reportsPage.endDate}</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>
            <Button
              onClick={loadActiveTabData}
              disabled={!isValidRange}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {es.reportsPage.updateButton}
            </Button>
            {!isValidRange && (
              <span className="text-sm text-destructive">
                {es.reportsPage.invalidRange}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="resumen">{es.reportsPage.tabs.summary}</TabsTrigger>
          <TabsTrigger value="reservas">{es.reportsPage.tabs.reservations}</TabsTrigger>
          <TabsTrigger value="ocupacion">{es.reportsPage.tabs.occupancy}</TabsTrigger>
          <TabsTrigger value="ingresos">{es.reportsPage.tabs.revenue}</TabsTrigger>
        </TabsList>

        {/* Tab: Resumen */}
        <TabsContent value="resumen" className="space-y-4">
          {loadingKpis ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : kpis ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {es.reportsPage.kpis.activeReservations}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{kpis.total_reservas_activas}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {es.reportsPage.kpis.cancelled}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{kpis.total_canceladas}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {es.reportsPage.kpis.noShow}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{kpis.total_no_show}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {es.reportsPage.kpis.estimatedRevenue}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">
                    {formatCurrency(kpis.ingresos_estimados)}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              {es.reportsPage.reservationsTab.noData}
            </p>
          )}
        </TabsContent>

        {/* Tab: Reservas */}
        <TabsContent value="reservas" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label>{es.reportsPage.reservationsTab.statusFilter}</Label>
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
                <div className="space-y-2">
                  <Label>{es.reportsPage.reservationsTab.roomFilter}</Label>
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
                <div className="space-y-2">
                  <Label>{es.reportsPage.reservationsTab.guestFilter}</Label>
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
                  <Download className="h-4 w-4" />
                  {es.reportsPage.reservationsTab.exportCsv}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          {loadingReservations ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : reservations.length > 0 ? (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{es.reportsPage.reservationsTab.columns.room}</TableHead>
                    <TableHead>{es.reportsPage.reservationsTab.columns.guest}</TableHead>
                    <TableHead>{es.reportsPage.reservationsTab.columns.checkIn}</TableHead>
                    <TableHead>{es.reportsPage.reservationsTab.columns.checkOut}</TableHead>
                    <TableHead>{es.reportsPage.reservationsTab.columns.status}</TableHead>
                    <TableHead>{es.reportsPage.reservationsTab.columns.occupancy}</TableHead>
                    <TableHead className="text-right">
                      {es.reportsPage.reservationsTab.columns.price}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservations.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.room_number}</TableCell>
                      <TableCell>{r.guest_name}</TableCell>
                      <TableCell>{formatDate(r.check_in_date)}</TableCell>
                      <TableCell>{formatDate(r.check_out_date)}</TableCell>
                      <TableCell>
                        {STATUS_OPTIONS.find((o) => o.value === r.status)?.label || r.status}
                      </TableCell>
                      <TableCell>{r.occupancy || "-"}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(r.final_price)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              {es.reportsPage.reservationsTab.noData}
            </p>
          )}
        </TabsContent>

        {/* Tab: Ocupación */}
        <TabsContent value="ocupacion" className="space-y-4">
          {loadingOccupancy ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : occupancy.length > 0 ? (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{es.reportsPage.occupancyTab.columns.day}</TableHead>
                    <TableHead className="text-center">
                      {es.reportsPage.occupancyTab.columns.occupied}
                    </TableHead>
                    <TableHead className="text-center">
                      {es.reportsPage.occupancyTab.columns.total}
                    </TableHead>
                    <TableHead className="text-right">
                      {es.reportsPage.occupancyTab.columns.percentage}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {occupancy.map((row) => (
                    <TableRow key={row.day}>
                      <TableCell className="font-medium">{formatDate(row.day)}</TableCell>
                      <TableCell className="text-center">{row.occupied_rooms}</TableCell>
                      <TableCell className="text-center">{row.total_rooms}</TableCell>
                      <TableCell className="text-right">
                        {formatPercent(row.occupancy_pct)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              {es.reportsPage.occupancyTab.noData}
            </p>
          )}
        </TabsContent>

        {/* Tab: Ingresos */}
        <TabsContent value="ingresos" className="space-y-4">
          {loadingRevenue ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : revenue.length > 0 ? (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{es.reportsPage.revenueTab.columns.day}</TableHead>
                    <TableHead className="text-right">
                      {es.reportsPage.revenueTab.columns.revenue}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenue.map((row) => (
                    <TableRow key={row.day}>
                      <TableCell className="font-medium">{formatDate(row.day)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.revenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              {es.reportsPage.revenueTab.noData}
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
