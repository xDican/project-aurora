import { useState } from "react";
import { useTodayArrivals, TodayArrival } from "@/hooks/useTodayArrivals";
import { useDepartures, DepartureItem } from "@/hooks/useDepartures";
import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const occupancyIcon: Record<string, string> = {
  sencilla: "person",
  doble: "group",
  triple: "group",
};

export default function Hoy() {
  const {
    arrivals,
    loading: arrivalsLoading,
    error: arrivalsError,
    checkIn,
    markNoShow,
    refresh: refreshArrivals,
  } = useTodayArrivals();

  const {
    departures,
    loading: departuresLoading,
    error: departuresError,
    checkOut,
    refresh: refreshDepartures,
  } = useDepartures();

  const [processingId, setProcessingId] = useState<string | null>(null);

  const loading = arrivalsLoading || departuresLoading;
  const error = arrivalsError || departuresError;

  const refresh = async () => {
    await Promise.all([refreshArrivals(), refreshDepartures()]);
  };

  const handleCheckIn = async (reservationId: string, roomId: string) => {
    setProcessingId(reservationId);
    try {
      await checkIn(reservationId, roomId);
      toast.success(es.todayPage.checkInSuccess, {
        description: es.todayPage.checkInSuccessDescription,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : es.common.unexpectedError;
      toast.error("Error", { description: message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleCheckOut = async (reservationId: string, roomId: string) => {
    setProcessingId(reservationId);
    try {
      await checkOut(reservationId, roomId);
      toast.success(es.todayPage.checkOutSuccess, {
        description: es.todayPage.checkOutSuccessDescription,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : es.common.unexpectedError;
      toast.error("Error", { description: message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleNoShow = async (reservationId: string) => {
    setProcessingId(reservationId);
    try {
      await markNoShow(reservationId);
      toast.success(es.todayPage.noShow.success);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : es.todayPage.noShow.error;
      toast.error("Error", { description: message });
    } finally {
      setProcessingId(null);
    }
  };

  const renderArrivalActions = (arrival: TodayArrival) => {
    const isProcessing = processingId === arrival.reservationId;

    if (arrival.status === "booked") {
      return (
        <div className="flex justify-end gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                disabled={isProcessing}
                className="inline-flex items-center justify-center px-3 py-1.5 rounded border border-outline text-primary hover:bg-surface-container-low text-label-md transition-colors disabled:opacity-50"
              >
                {es.todayPage.noShow.button}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{es.todayPage.noShow.dialogTitle}</AlertDialogTitle>
                <AlertDialogDescription>
                  {es.todayPage.noShow.dialogMessage}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{es.todayPage.noShow.back}</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleNoShow(arrival.reservationId)}>
                  {es.todayPage.noShow.confirm}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <button
            onClick={() => handleCheckIn(arrival.reservationId, arrival.roomId)}
            disabled={isProcessing}
            className="inline-flex items-center justify-center gap-1 px-4 py-1.5 rounded bg-primary text-primary-foreground hover:bg-on-primary-fixed-variant text-label-md font-semibold transition-colors disabled:opacity-50"
          >
            {isProcessing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {es.todayPage.checkInButton}
          </button>
        </div>
      );
    }
    if (arrival.status === "checked_in") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-secondary-container text-on-secondary-container text-label-bold">
          <span className="material-symbols-outlined text-[14px]">check_circle</span>
          {es.todayPage.alreadyCheckedIn}
        </span>
      );
    }
    if (arrival.status === "no_show") {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-pill bg-tertiary-container/20 text-tertiary text-label-bold">
          {es.todayPage.noShow.label}
        </span>
      );
    }
    if (arrival.status === "cancelled") {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-pill bg-destructive/10 text-destructive text-label-bold">
          {es.reservationStatusLabels.cancelled}
        </span>
      );
    }
    return <span className="text-body-sm text-outline">—</span>;
  };

  const renderDepartureActions = (departure: DepartureItem) => {
    if (departure.status === "checked_in") {
      const isProcessing = processingId === departure.reservationId;
      return (
        <button
          onClick={() => handleCheckOut(departure.reservationId, departure.roomId)}
          disabled={isProcessing}
          className="inline-flex items-center justify-center gap-1 px-4 py-1.5 rounded bg-primary text-primary-foreground hover:bg-on-primary-fixed-variant text-label-md font-semibold transition-colors disabled:opacity-50"
        >
          {isProcessing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {es.todayPage.checkOutButton}
        </button>
      );
    }
    if (departure.status === "checked_out") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-surface-variant text-on-surface-variant text-label-bold">
          <span className="material-symbols-outlined text-[14px]">done_all</span>
          {es.todayPage.alreadyCheckedOut}
        </span>
      );
    }
    return <span className="text-body-sm text-outline">—</span>;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-end">
        <Button variant="outline" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : es.todayPage.refresh}
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded bg-destructive/10 text-destructive text-body-md">{error}</div>
      )}

      {/* Llegadas de hoy */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-headline-md text-foreground flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
              flight_land
            </span>
            {es.todayPage.arrivalsTitle}
            <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-pill bg-surface-container-high text-on-surface-variant text-label-bold">
              {arrivals.length}
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            {es.common.loading}
          </div>
        ) : arrivals.length === 0 ? (
          <div className="text-center py-8 rounded bg-surface-container-low text-on-surface-variant">
            {es.todayPage.noArrivals}
          </div>
        ) : (
          <div className="bg-surface-container-lowest border border-surface-variant rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container border-b border-surface-variant">
                  <th className="px-table_cell_padding_x py-3 text-label-bold text-on-surface-variant uppercase tracking-wider">
                    {es.todayPage.columns.guest}
                  </th>
                  <th className="px-table_cell_padding_x py-3 text-label-bold text-on-surface-variant uppercase tracking-wider w-32">
                    {es.todayPage.columns.room}
                  </th>
                  <th className="px-table_cell_padding_x py-3 text-label-bold text-on-surface-variant uppercase tracking-wider w-40">
                    Ocupación
                  </th>
                  <th className="px-table_cell_padding_x py-3 text-label-bold text-on-surface-variant uppercase tracking-wider text-right w-64">
                    {es.common.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant">
                {arrivals.map((arrival) => (
                  <tr
                    key={arrival.reservationId}
                    className={cn(
                      "transition-colors",
                      arrival.status === "booked"
                        ? "hover:bg-surface-container-low"
                        : "bg-surface-container-low/50"
                    )}
                  >
                    <td className="px-table_cell_padding_x py-table_cell_padding_y">
                      <div className="text-table-data text-foreground">{arrival.guestName}</div>
                    </td>
                    <td className="px-table_cell_padding_x py-table_cell_padding_y text-table-data text-foreground">
                      {arrival.roomNumber}
                    </td>
                    <td className="px-table_cell_padding_x py-table_cell_padding_y">
                      {arrival.occupancy && (
                        <span className="inline-flex items-center gap-1 text-body-sm text-on-surface-variant">
                          <span className="material-symbols-outlined text-[16px]">
                            {occupancyIcon[arrival.occupancy] ?? "person"}
                          </span>
                          {es.occupancyLabels[arrival.occupancy]}
                        </span>
                      )}
                    </td>
                    <td className="px-table_cell_padding_x py-table_cell_padding_y text-right">
                      {renderArrivalActions(arrival)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Salidas de hoy */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-headline-md text-foreground flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>
              flight_takeoff
            </span>
            {es.todayPage.departuresTitle}
            <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-pill bg-surface-container-high text-on-surface-variant text-label-bold">
              {departures.length}
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            {es.common.loading}
          </div>
        ) : departures.length === 0 ? (
          <div className="text-center py-8 rounded bg-surface-container-low text-on-surface-variant">
            {es.todayPage.noDepartures}
          </div>
        ) : (
          <div className="bg-surface-container-lowest border border-surface-variant rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container border-b border-surface-variant">
                  <th className="px-table_cell_padding_x py-3 text-label-bold text-on-surface-variant uppercase tracking-wider">
                    {es.todayPage.columns.guest}
                  </th>
                  <th className="px-table_cell_padding_x py-3 text-label-bold text-on-surface-variant uppercase tracking-wider w-32">
                    {es.todayPage.columns.room}
                  </th>
                  <th className="px-table_cell_padding_x py-3 text-label-bold text-on-surface-variant uppercase tracking-wider w-40">
                    Ocupación
                  </th>
                  <th className="px-table_cell_padding_x py-3 text-label-bold text-on-surface-variant uppercase tracking-wider text-right w-48">
                    {es.common.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant">
                {departures.map((departure) => (
                  <tr
                    key={departure.reservationId}
                    className={cn(
                      "transition-colors",
                      departure.status === "checked_in"
                        ? "hover:bg-surface-container-low"
                        : "bg-surface-container-low/50"
                    )}
                  >
                    <td className="px-table_cell_padding_x py-table_cell_padding_y">
                      <div className="text-table-data text-foreground">{departure.guestName}</div>
                    </td>
                    <td
                      className={cn(
                        "px-table_cell_padding_x py-table_cell_padding_y text-table-data",
                        departure.status === "checked_out"
                          ? "text-outline-variant line-through"
                          : "text-foreground"
                      )}
                    >
                      {departure.roomNumber}
                    </td>
                    <td className="px-table_cell_padding_x py-table_cell_padding_y">
                      {departure.occupancy && (
                        <span className="inline-flex items-center gap-1 text-body-sm text-on-surface-variant">
                          <span className="material-symbols-outlined text-[16px]">
                            {occupancyIcon[departure.occupancy] ?? "person"}
                          </span>
                          {es.occupancyLabels[departure.occupancy]}
                        </span>
                      )}
                    </td>
                    <td className="px-table_cell_padding_x py-table_cell_padding_y text-right">
                      {renderDepartureActions(departure)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
