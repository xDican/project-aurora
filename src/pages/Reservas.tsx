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
import { Plus, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { es } from "@/lib/i18n/es";
import { useReservations } from "@/hooks/useReservations";
import { useRooms, Room } from "@/hooks/useRooms";
import { useGuests, Guest } from "@/hooks/useGuests";
import { ReservationForm, ReservationFormData } from "@/components/reservations/ReservationForm";
import { supabase } from "@/integrations/supabase/client";

export default function Reservas() {
  const t = es.reservationsPage;
  const { toast } = useToast();

  const { reservations, loading, error, refresh } = useReservations();
  
  // We need rooms and guests for the form selects
  const [rooms, setRooms] = useState<Room[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loadingDeps, setLoadingDeps] = useState(true);

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Load rooms and guests for the form
  useEffect(() => {
    async function loadDependencies() {
      setLoadingDeps(true);
      try {
        const [roomsRes, guestsRes] = await Promise.all([
          supabase.from("rooms").select("*").order("number"),
          supabase.from("guests").select("*").order("name"),
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

  const handleCreate = async (data: ReservationFormData) => {
    const insertData = {
      room_id: data.room_id,
      guest_id: data.guest_id,
      check_in_date: data.check_in_date,
      check_out_date: data.check_out_date,
      status: "booked",
      base_price: data.base_price,
      discount: 0,
      final_price: data.final_price,
    };

    const { error: insertError } = await supabase.from("reservations").insert(insertData);

    if (insertError) {
      throw new Error(`Error al crear reserva: ${insertError.message}`);
    }

    await refresh();
    setIsDialogOpen(false);
    toast({
      title: t.reservationCreated,
    });
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "USD",
    }).format(price);
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
                  <TableHead>{t.columns.guest}</TableHead>
                  <TableHead>{t.columns.checkIn}</TableHead>
                  <TableHead>{t.columns.checkOut}</TableHead>
                  <TableHead>{t.columns.status}</TableHead>
                  <TableHead>{t.columns.finalPrice}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.map((reservation) => (
                  <TableRow key={reservation.id}>
                    <TableCell className="font-medium">
                      {reservation.room_number || "-"}
                    </TableCell>
                    <TableCell>{reservation.guest_name || "-"}</TableCell>
                    <TableCell>{formatDate(reservation.check_in_date)}</TableCell>
                    <TableCell>{formatDate(reservation.check_out_date)}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {es.reservationStatusLabels[reservation.status] || reservation.status}
                      </span>
                    </TableCell>
                    <TableCell>{formatPrice(reservation.final_price)}</TableCell>
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
    </div>
  );
}
