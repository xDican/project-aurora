import { useState, useMemo } from "react";
import { useRoomMap, type RoomCard } from "@/hooks/useRoomMap";
import { es } from "@/lib/i18n/es";
import { RoomCardComponent } from "@/components/rooms/RoomCard";
import { RoomDetailModal } from "@/components/rooms/RoomDetailModal";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const LEGEND: Array<{ status: RoomCard["status"]; dot: string }> = [
  { status: "available", dot: "bg-[#dcfce7]" },
  { status: "occupied", dot: "bg-[#dbeafe]" },
  { status: "cleaning", dot: "bg-[#fef9c3]" },
  { status: "maintenance", dot: "bg-error-container" },
];

export default function Mapa() {
  const { rooms, loading, error, getRoomReservations, markAsClean } = useRoomMap();
  const [selectedRoom, setSelectedRoom] = useState<RoomCard | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { toast } = useToast();

  const countByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    rooms.forEach((r) => {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    });
    return counts;
  }, [rooms]);

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
    <div className="space-y-stack_gap_md">
      <div className="flex flex-wrap gap-3 justify-end">
        {LEGEND.map(({ status, dot }) => (
          <div
            key={status}
            className="flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-pill border border-outline-variant"
          >
            <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
            <span className="text-label-md text-foreground">
              {es.statusLabels[status]} ({countByStatus[status] ?? 0})
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="p-4 rounded bg-destructive/10 text-destructive text-body-md">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          {es.common.loading}
        </div>
      ) : rooms.length === 0 ? (
        <p className="text-center text-on-surface-variant py-12">{es.roomMapPage.noRooms}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-gutter">
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

      <RoomDetailModal
        room={selectedRoom}
        open={modalOpen}
        onOpenChange={setModalOpen}
        getRoomReservations={getRoomReservations}
      />
    </div>
  );
}
