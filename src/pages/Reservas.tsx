import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Plus, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { es } from "@/lib/i18n/es";
import {
  useReservations,
  type NewReservationInput,
  type ReservationListItem,
} from "@/hooks/useReservations";
import { type Room } from "@/hooks/useRooms";
import { type Guest } from "@/hooks/useGuests";
import { ReservationForm } from "@/components/reservations/ReservationForm";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";

export default function Reservas() {
  const t = es.reservationsPage;

  const {
    reservations,
    loading,
    error,
    createReservation,
    updateReservation,
    cancelReservation,
  } = useReservations();

  // We need rooms and guests for the form selects
  const [rooms, setRooms] = useState<Room[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loadingDeps, setLoadingDeps] = useState(true);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<ReservationListItem | null>(null);

  // Load rooms and guests for the form
  useEffect(() => {
    async function loadDependencies() {
      setLoadingDeps(true);
      try {
        const [roomsRes, guestsRes] = await Promise.all([
          supabase.from("rooms").select("*").eq("is_active", true).order("number"),
          supabase.from("guests").select("*").eq("is_active", true).order("name"),
        ]);

        if (roomsRes.data) {
          setRooms(roomsRes.data as unknown as Room[]);
        }
        if (guestsRes.data) {
          setGuests(guestsRes.data as unknown as Guest[]);
        }
      } catch (err) {
        console.error("Error loading dependencies:", err);
      } finally {
        setLoadingDeps(false);
      }
    }
    loadDependencies();
  }, []);

  const handleCreate = async (input: NewReservationInput) => {
    try {
      await createReservation(input);
      setIsDialogOpen(false);
      toast.success(t.reservationCreated);
    } catch (err) {
      const message = err instanceof Error ? err.message : es.common.unexpectedError;
      if (message === "ROOM_OVERLAP") {
        toast.error(t.errors.roomOverlap);
      } else if (message === "PAST_CHECKIN") {
        toast.error(t.errors.checkInPast);
      } else {
        toast.error(message);
      }
      // NO cerrar el dialog - usuario debe corregir
    }
  };

  const handleUpdate = async (input: NewReservationInput) => {
    if (!editingReservation) return;
    try {
      await updateReservation(editingReservation.id, input);
      setEditingReservation(null);
      toast.success(t.reservationUpdated);
    } catch (err) {
      const message = err instanceof Error ? err.message : es.common.unexpectedError;
      if (message === "ROOM_OVERLAP") {
        toast.error(t.errors.roomOverlap);
      } else {
        toast.error(message);
      }
      // NO cerrar el dialog - usuario debe corregir
    }
  };

  const handleCancel = async (reservationId: string) => {
    try {
      await cancelReservation(reservationId);
      toast.success(t.cancel.success);
    } catch (err) {
      const message = err instanceof Error ? err.message : t.cancel.error;
      toast.error(message);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const isLoading = loading || loadingDeps;

  return (
    <div className="min-h-screen bg-background p-6">
      <Card className="max-w-6xl mx-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6" />
            {t.title}
          </CardTitle>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t.newReservation}
          </Button>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-md">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              {es.common.loading}
            </div>
          ) : reservations.length === 0 ? (
            <div className="text-center py-12">
              <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t.noReservations}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.columns.room}</TableHead>
                  <TableHead>{t.columns.occupancy}</TableHead>
                  <TableHead>{t.columns.guest}</TableHead>
                  <TableHead>{t.columns.checkIn}</TableHead>
                  <TableHead>{t.columns.checkOut}</TableHead>
                  <TableHead>{t.columns.status}</TableHead>
                  <TableHead>{t.columns.finalPrice}</TableHead>
                  <TableHead>{t.columns.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.map((reservation) => (
                  <TableRow key={reservation.id}>
                    <TableCell className="font-medium">
                      {reservation.roomNumber || "-"}
                    </TableCell>
                    <TableCell>
                      {reservation.occupancy
                        ? es.occupancyLabels[reservation.occupancy]
                        : "-"}
                    </TableCell>
                    <TableCell>{reservation.guestName || "-"}</TableCell>
                    <TableCell>{formatDate(reservation.checkInDate)}</TableCell>
                    <TableCell>
                      {formatDate(reservation.checkOutDate)}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {es.reservationStatusLabels[reservation.status] ||
                          reservation.status}
                      </span>
                    </TableCell>
                    <TableCell>{formatCurrency(reservation.finalPrice)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {(reservation.status === "booked" ||
                          reservation.status === "checked_in") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingReservation(reservation)}
                          >
                            {es.common.edit}
                          </Button>
                        )}
                        {reservation.status === "booked" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                {t.cancel.button}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {t.cancel.dialogTitle}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t.cancel.dialogMessage}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>
                                  {t.cancel.back}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleCancel(reservation.id)}
                                >
                                  {t.cancel.confirm}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Reservation Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t.newReservation}</DialogTitle>
          </DialogHeader>
          <ReservationForm
            rooms={rooms}
            guests={guests}
            onSubmit={handleCreate}
            onCancel={() => setIsDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Reservation Dialog */}
      <Dialog
        open={editingReservation !== null}
        onOpenChange={(open) => !open && setEditingReservation(null)}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t.editDialogTitle}</DialogTitle>
          </DialogHeader>
          {editingReservation && (
            <ReservationForm
              rooms={rooms}
              guests={guests}
              onSubmit={handleUpdate}
              onCancel={() => setEditingReservation(null)}
              editingReservationId={editingReservation.id}
              prefillRoomId={editingReservation.roomId}
              prefillCheckInDate={editingReservation.checkInDate}
              prefillCheckOutDate={editingReservation.checkOutDate}
              initialRoomRateId={editingReservation.roomRateId ?? undefined}
              initialGuest={
                guests.find((g) => g.id === editingReservation.guestId) ?? {
                  id: editingReservation.guestId,
                  name: editingReservation.guestName,
                  created_at: "",
                }
              }
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
