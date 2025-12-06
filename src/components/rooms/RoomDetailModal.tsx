import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type RoomCard, type RoomReservation } from "@/hooks/useRoomMap";
import { es } from "@/lib/i18n/es";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

interface RoomDetailModalProps {
  room: RoomCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getRoomReservations: (roomId: string) => Promise<RoomReservation[]>;
}

export function RoomDetailModal({
  room,
  open,
  onOpenChange,
  getRoomReservations,
}: RoomDetailModalProps) {
  const navigate = useNavigate();
  const [reservations, setReservations] = useState<RoomReservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!room || !open) {
      setReservations([]);
      setError(null);
      return;
    }

    async function fetchReservations() {
      setLoading(true);
      setError(null);

      try {
        const data = await getRoomReservations(room!.id);
        setReservations(data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Error al cargar reservas";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    fetchReservations();
  }, [room, open, getRoomReservations]);

  if (!room) return null;

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr + "T00:00:00");
      return date.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
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
              ${room.basePrice.toLocaleString("es-CO")}
            </div>

            <div className="text-muted-foreground">
              {es.roomsPage.columns.status}:
            </div>
            <div>
              <Badge variant="outline">
                {es.statusLabels[room.status] ?? room.status}
              </Badge>
            </div>

            <div className="text-muted-foreground">{es.roomMapPage.notes}:</div>
            <div className="font-medium">
              {room.notes ?? es.roomMapPage.noNotes}
            </div>
          </div>

          {/* Upcoming Reservations */}
          <div>
            <h4 className="font-semibold mb-2">
              {es.roomMapPage.upcomingReservations}
            </h4>

            {error && (
              <Alert variant="destructive" className="mb-2">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

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
                      {formatDate(res.checkIn)} – {formatDate(res.checkOut)}
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
