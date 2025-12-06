import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Room } from "@/hooks/useRooms";
import { supabase } from "@/integrations/supabase/client";
import { es } from "@/lib/i18n/es";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface RoomReservation {
  id: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
}

interface RoomDetailModalProps {
  room: Room | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RoomDetailModal({ room, open, onOpenChange }: RoomDetailModalProps) {
  const navigate = useNavigate();
  const [reservations, setReservations] = useState<RoomReservation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!room || !open) {
      setReservations([]);
      return;
    }

    async function fetchReservations() {
      setLoading(true);
      const today = format(new Date(), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("reservations")
        .select("id, check_in_date, check_out_date, status, guests(name)")
        .eq("room_id", room!.id)
        .gte("check_out_date", today)
        .order("check_in_date", { ascending: true });

      if (!error && data) {
        const parsed = data.map((r) => ({
          id: String(r.id),
          guestName: (r.guests as { name: string } | null)?.name ?? "",
          checkInDate: String(r.check_in_date),
          checkOutDate: String(r.check_out_date),
          status: String(r.status),
        }));
        setReservations(parsed);
      }
      setLoading(false);
    }

    fetchReservations();
  }, [room, open]);

  if (!room) return null;

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr + "T00:00:00"), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {es.roomMapPage.roomDetails} – {room.number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Room Info */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-muted-foreground">
              {es.roomsPage.columns.type}:
            </div>
            <div className="font-medium">
              {es.roomTypeLabels[room.type] ?? room.type}
            </div>

            <div className="text-muted-foreground">
              {es.roomMapPage.basePrice}:
            </div>
            <div className="font-medium">
              ${room.base_price.toLocaleString("es-CO")}
            </div>

            <div className="text-muted-foreground">
              {es.roomsPage.columns.status}:
            </div>
            <div>
              <Badge variant="outline">
                {es.statusLabels[room.status] ?? room.status}
              </Badge>
            </div>

            <div className="text-muted-foreground">
              {es.roomMapPage.notes}:
            </div>
            <div className="font-medium">
              {room.notes ?? es.roomMapPage.noNotes}
            </div>
          </div>

          {/* Upcoming Reservations */}
          <div>
            <h4 className="font-semibold mb-2">
              {es.roomMapPage.upcomingReservations}
            </h4>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : reservations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {es.roomMapPage.noUpcomingReservations}
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {reservations.map((res) => (
                  <div
                    key={res.id}
                    className="p-2 border rounded-md text-sm space-y-1"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{res.guestName}</span>
                      <Badge variant="secondary">
                        {es.reservationStatusLabels[res.status] ?? res.status}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground">
                      {formatDate(res.checkInDate)} – {formatDate(res.checkOutDate)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end">
            <Button onClick={() => navigate("/reservas")}>
              {es.roomMapPage.goToReservations}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
