import { type RoomCard } from "@/hooks/useRoomMap";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

interface RoomCardComponentProps {
  room: RoomCard;
  onClick: () => void;
  onMarkAsClean?: (roomId: string) => void;
}

const statusStyles: Record<string, { bg: string; text: string; icon: string }> = {
  available: { bg: "bg-[#dcfce7] border border-[#bbf7d0]", text: "text-[#166534]", icon: "bed" },
  occupied: { bg: "bg-[#dbeafe] border border-[#bfdbfe]", text: "text-[#1e40af]", icon: "person" },
  cleaning: { bg: "bg-[#fef9c3] border border-[#fef08a]", text: "text-[#854d0e]", icon: "cleaning_services" },
  maintenance: { bg: "bg-error-container border border-error/20", text: "text-on-error-container", icon: "build" },
};

export function RoomCardComponent({ room, onClick, onMarkAsClean }: RoomCardComponentProps) {
  const handleMarkAsClean = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMarkAsClean?.(room.id);
  };

  const style = statusStyles[room.status] ?? statusStyles.available;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-xl p-4 h-32 flex flex-col justify-between text-left cursor-pointer hover:shadow-md transition-shadow",
        style.bg
      )}
    >
      <div className="flex justify-between items-start">
        <span className={cn("text-headline-md font-bold", style.text)}>{room.number}</span>
        <span className={cn("material-symbols-outlined text-[20px]", style.text)}>{style.icon}</span>
      </div>
      <div className="flex flex-col gap-2">
        <span className={cn("text-label-bold uppercase leading-none", style.text)}>
          {es.statusLabels[room.status] ?? room.status}
        </span>
        {room.status === "cleaning" && onMarkAsClean ? (
          <button
            onClick={handleMarkAsClean}
            className="bg-[#ca8a04] text-white text-[11px] py-1 px-2 rounded hover:bg-[#a16207] transition-colors w-max"
          >
            {es.roomMapPage.markAsClean}
          </button>
        ) : (
          <span className={cn("text-[11px] opacity-70", style.text)}>
            {es.roomTypeLabels[room.type] ?? room.type}
          </span>
        )}
      </div>
    </button>
  );
}
