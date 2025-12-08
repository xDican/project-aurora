import { useState } from "react";
import { useRoomMap, type RoomCard } from "@/hooks/useRoomMap";
import { es } from "@/lib/i18n/es";
import { RoomCardComponent } from "@/components/rooms/RoomCard";
import { RoomDetailModal } from "@/components/rooms/RoomDetailModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Map } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Mapa() {
  const { rooms, loading, error, getRoomReservations, markAsClean } = useRoomMap();
  const [selectedRoom, setSelectedRoom] = useState<RoomCard | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { toast } = useToast();

  const handleCardClick = (room: RoomCard) => {
    setSelectedRoom(room);
    setModalOpen(true);
  };

  const handleMarkAsClean = async (roomId: string) => {
    try {
      await markAsClean(roomId);
      toast({
        title: es.roomMapPage.markAsCleanSuccess,
      });
    } catch (err) {
      toast({
        title: es.roomMapPage.markAsCleanError,
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Map className="h-5 w-5" />
            {es.roomMapPage.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : rooms.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              {es.roomMapPage.noRooms}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {rooms.map((room) => (
                <RoomCardComponent
                  key={room.id}
                  room={room}
                  onClick={() => handleCardClick(room)}
                  onMarkAsClean={handleMarkAsClean}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RoomDetailModal
        room={selectedRoom}
        open={modalOpen}
        onOpenChange={setModalOpen}
        getRoomReservations={getRoomReservations}
      />
    </div>
  );
}
