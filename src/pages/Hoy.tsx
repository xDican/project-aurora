import { useState } from "react";
import { useTodayArrivals, TodayArrival } from "@/hooks/useTodayArrivals";
import { useDepartures, DepartureItem } from "@/hooks/useDepartures";
import { es } from "@/lib/i18n/es";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { CalendarCheck, LogOut, Loader2 } from "lucide-react";

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
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => handleCheckIn(arrival.reservationId, arrival.roomId)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                {es.todayPage.processing}
              </>
            ) : (
              es.todayPage.checkInButton
            )}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={isProcessing}>
                {es.todayPage.noShow.button}
              </Button>
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
        </div>
      );
    }
    if (arrival.status === "checked_in") {
      return (
        <span className="text-sm text-muted-foreground">
          {es.todayPage.alreadyCheckedIn}
        </span>
      );
    }
    if (arrival.status === "no_show") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
          {es.todayPage.noShow.label}
        </span>
      );
    }
    if (arrival.status === "cancelled") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          {es.reservationStatusLabels.cancelled}
        </span>
      );
    }
    return <span className="text-sm text-muted-foreground">—</span>;
  };

  const renderDepartureActions = (departure: DepartureItem) => {
    if (departure.status === "checked_in") {
      return (
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            handleCheckOut(departure.reservationId, departure.roomId)
          }
          disabled={processingId === departure.reservationId}
        >
          {processingId === departure.reservationId ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
              {es.todayPage.processing}
            </>
          ) : (
            es.todayPage.checkOutButton
          )}
        </Button>
      );
    }
    if (departure.status === "checked_out") {
      return (
        <span className="text-sm text-muted-foreground">
          {es.todayPage.alreadyCheckedOut}
        </span>
      );
    }
    return <span className="text-sm text-muted-foreground">—</span>;
  };

  return (
    <div className="container mx-auto py-8 px-4 space-y-10">
      {/* Header */}
      <div className="flex items-center justify-end">
        <Button variant="outline" onClick={refresh} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            es.todayPage.refresh
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Arrivals Section */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <CalendarCheck className="h-7 w-7 text-primary" />
          <h2 className="text-2xl font-bold">{es.todayPage.arrivalsTitle}</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">
              {es.common.loading}
            </span>
          </div>
        ) : arrivals.length === 0 ? (
          <div className="text-center py-8 border rounded-md bg-muted/30">
            <CalendarCheck className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">{es.todayPage.noArrivals}</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{es.todayPage.columns.room}</TableHead>
                  <TableHead>{es.todayPage.columns.guest}</TableHead>
                  <TableHead>{es.todayPage.columns.checkIn}</TableHead>
                  <TableHead>{es.todayPage.columns.status}</TableHead>
                  <TableHead>{es.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {arrivals.map((arrival) => (
                  <TableRow key={arrival.reservationId}>
                    <TableCell className="font-medium">
                      {arrival.roomNumber}
                    </TableCell>
                    <TableCell>{arrival.guestName}</TableCell>
                    <TableCell>{arrival.checkInDate}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          arrival.status === "checked_in"
                            ? "bg-green-100 text-green-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {es.reservationStatusLabels[arrival.status] ||
                          arrival.status}
                      </span>
                    </TableCell>
                    <TableCell>{renderArrivalActions(arrival)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Departures Section */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <LogOut className="h-7 w-7 text-primary" />
          <h2 className="text-2xl font-bold">{es.todayPage.departuresTitle}</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">
              {es.common.loading}
            </span>
          </div>
        ) : departures.length === 0 ? (
          <div className="text-center py-8 border rounded-md bg-muted/30">
            <LogOut className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">{es.todayPage.noDepartures}</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{es.todayPage.columns.room}</TableHead>
                  <TableHead>{es.todayPage.columns.guest}</TableHead>
                  <TableHead>{es.todayPage.columns.checkOut}</TableHead>
                  <TableHead>{es.todayPage.columns.status}</TableHead>
                  <TableHead>{es.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departures.map((departure) => (
                  <TableRow key={departure.reservationId}>
                    <TableCell className="font-medium">
                      {departure.roomNumber}
                    </TableCell>
                    <TableCell>{departure.guestName}</TableCell>
                    <TableCell>{departure.checkOutDate}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          departure.status === "checked_out"
                            ? "bg-gray-100 text-gray-800"
                            : departure.status === "checked_in"
                            ? "bg-green-100 text-green-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {es.reservationStatusLabels[departure.status] ||
                          departure.status}
                      </span>
                    </TableCell>
                    <TableCell>{renderDepartureActions(departure)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
