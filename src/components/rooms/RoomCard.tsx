import { type RoomCard } from "@/hooks/useRoomMap";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface RoomCardComponentProps {
  room: RoomCard;
  onClick: () => void;
  onMarkAsClean?: (roomId: string) => void;
}

const statusStyles: Record<string, string> = {
  available: "bg-status-available text-status-available-foreground",
  occupied: "bg-status-occupied text-status-occupied-foreground",
  cleaning: "bg-status-cleaning text-status-cleaning-foreground",
  maintenance: "bg-status-maintenance text-status-maintenance-foreground",
};

export function RoomCardComponent({ room, onClick, onMarkAsClean }: RoomCardComponentProps) {
  const handleMarkAsClean = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMarkAsClean?.(room.id);
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-4 rounded-lg shadow-md transition-all hover:scale-105 hover:shadow-lg cursor-pointer text-left",
        statusStyles[room.status] ?? statusStyles.available
      )}
    >
      <div className="text-3xl font-bold mb-1">{room.number}</div>
      <div className="text-sm opacity-90">
        {es.roomTypeLabels[room.type] ?? room.type}
      </div>
      <div className="mt-2 text-xs font-medium px-2 py-1 rounded bg-black/10 inline-block">
        {es.statusLabels[room.status] ?? room.status}
      </div>
      
      {room.status === "cleaning" && onMarkAsClean && (
        <div className="mt-3">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleMarkAsClean}
            className="w-full bg-white/90 hover:bg-white text-foreground"
          >
            {es.roomMapPage.markAsClean}
          </Button>
        </div>
      )}
    </button>
  );
}
