import { useState } from "react";
import { useTodayArrivals } from "@/hooks/useTodayArrivals";
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
import { useToast } from "@/hooks/use-toast";
import { CalendarCheck, Loader2 } from "lucide-react";

export default function Hoy() {
  const { arrivals, loading, error, checkIn, refresh } = useTodayArrivals();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleCheckIn = async (reservationId: string, roomId: string) => {
    setProcessingId(reservationId);
    try {
      await checkIn(reservationId, roomId);
      toast({
        title: es.todayPage.checkInSuccess,
        description: es.todayPage.checkInSuccessDescription,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : es.common.unexpectedError;
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CalendarCheck className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">{es.todayPage.title}</h1>
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            es.todayPage.refresh
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">
            {es.common.loading}
          </span>
        </div>
      ) : arrivals.length === 0 ? (
        <div className="text-center py-12">
          <CalendarCheck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-lg">
            {es.todayPage.noArrivals}
          </p>
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
                <TableRow key={arrival.id}>
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
                  <TableCell>
                    {arrival.status === "booked" ? (
                      <Button
                        size="sm"
                        onClick={() =>
                          handleCheckIn(arrival.id, arrival.roomId)
                        }
                        disabled={processingId === arrival.id}
                      >
                        {processingId === arrival.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            {es.todayPage.processing}
                          </>
                        ) : (
                          es.todayPage.checkInButton
                        )}
                      </Button>
                    ) : arrival.status === "checked_in" ? (
                      <span className="text-sm text-muted-foreground">
                        {es.todayPage.alreadyCheckedIn}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
