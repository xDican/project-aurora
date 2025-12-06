import { Room, RoomStatus } from "@/hooks/useRooms";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

interface RoomCardProps {
  room: Room;
  onClick: () => void;
}

const statusStyles: Record<RoomStatus, string> = {
  available: "bg-status-available text-status-available-foreground",
  occupied: "bg-status-occupied text-status-occupied-foreground",
  cleaning: "bg-status-cleaning text-status-cleaning-foreground",
  maintenance: "bg-status-maintenance text-status-maintenance-foreground",
};

export function RoomCard({ room, onClick }: RoomCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-4 rounded-lg shadow-md transition-all hover:scale-105 hover:shadow-lg cursor-pointer text-left",
        statusStyles[room.status]
      )}
    >
      <div className="text-3xl font-bold mb-1">{room.number}</div>
      <div className="text-sm opacity-90">
        {es.roomTypeLabels[room.type] ?? room.type}
      </div>
      <div className="mt-2 text-xs font-medium px-2 py-1 rounded bg-black/10 inline-block">
        {es.statusLabels[room.status] ?? room.status}
      </div>
    </button>
  );
}
