import { useState, useMemo } from "react";
import { format, addDays } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { es } from "@/lib/i18n/es";
import { formatCurrency } from "@/lib/currency";
import type { SalonSpace } from "@/hooks/useSalonSpaces";
import type { SalonSlot } from "@/hooks/useSalonSlots";
import type { SalonReservationListItem } from "@/hooks/useSalonReservations";

const t = es.salonPage.board;

interface SalonAvailabilityBoardProps {
  spaces: SalonSpace[];
  slots: SalonSlot[];
  reservations: SalonReservationListItem[];
  onReserve: (spaceId: string, slotId: string, date: string) => void;
  onView: (reservation: SalonReservationListItem) => void;
}

export function SalonAvailabilityBoard({ spaces, slots, reservations, onReserve, onView }: SalonAvailabilityBoardProps) {
  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

  const [date, setDate] = useState(today);
  const [spaceFilter, setSpaceFilter] = useState("all");

  const fmtLong = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });

  const visibleSpaces = useMemo(
    () => spaces.filter((s) => s.is_active && (spaceFilter === "all" || s.id === spaceFilter)),
    [spaces, spaceFilter],
  );

  // Para una fecha dada, una reserva ocupa el (espacio, slot) si no está cancelada
  // y la fecha cae dentro de su rango.
  const findReservation = (spaceId: string, slotId: string) =>
    reservations.find(
      (r) => r.spaceId === spaceId && r.slotId === slotId && r.status !== "cancelled" && date >= r.startDate && date <= r.endDate,
    ) ?? null;

  return (
    <div className="space-y-stack_gap_md">
      {/* Barra de filtro */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
        <div className="space-y-1">
          <label className="text-label-md uppercase text-on-surface-variant">{t.dateLabel}</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
        </div>
        <div className="flex gap-1 rounded-md bg-surface-container-low border border-outline-variant p-1">
          <button
            onClick={() => setDate(today)}
            className={`px-3 py-1 rounded text-label-md transition-colors ${date === today ? "bg-surface-container-lowest text-foreground shadow-sm" : "text-on-surface-variant hover:text-foreground"}`}
          >{t.today}</button>
          <button
            onClick={() => setDate(tomorrow)}
            className={`px-3 py-1 rounded text-label-md transition-colors ${date === tomorrow ? "bg-surface-container-lowest text-foreground shadow-sm" : "text-on-surface-variant hover:text-foreground"}`}
          >{t.tomorrow}</button>
        </div>
        <div className="space-y-1 sm:ml-auto">
          <label className="text-label-md uppercase text-on-surface-variant">{es.salonPage.availability.spaceLabel}</label>
          <Select value={spaceFilter} onValueChange={setSpaceFilter}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.allSpaces}</SelectItem>
              {spaces.filter((s) => s.is_active).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {visibleSpaces.length === 0 ? (
        <div className="text-center py-12 text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl block mb-3">meeting_room</span>
          <p>{t.noSpaces}</p>
        </div>
      ) : (
        <>
          <p className="text-body-sm text-on-surface-variant">{t.showingFor(visibleSpaces.length, fmtLong(date))}</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {visibleSpaces.map((space) => {
              const spaceSlots = slots.filter((s) => s.is_active && s.space_id === space.id);
              return (
                <div key={space.id} className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-outline-variant bg-surface-container-low">
                    <span className="material-symbols-outlined text-[20px] text-on-surface-variant">meeting_room</span>
                    <h3 className="text-table-data text-foreground">{space.name}</h3>
                  </div>
                  {spaceSlots.length === 0 ? (
                    <p className="px-4 py-6 text-center text-body-sm text-on-surface-variant">{t.noSlots}</p>
                  ) : (
                    <ul className="divide-y divide-outline-variant">
                      {spaceSlots.map((slot) => {
                        const occupied = findReservation(space.id, slot.id);
                        return (
                          <li key={slot.id}>
                            <button
                              onClick={() => occupied ? onView(occupied) : onReserve(space.id, slot.id, date)}
                              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-container-low transition-colors"
                            >
                              <div className="min-w-0">
                                <p className="text-body-md text-foreground truncate">{slot.name}</p>
                                <p className="text-label-md text-on-surface-variant">
                                  {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)} · {formatCurrency(slot.price_per_day)}/día
                                </p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                {occupied ? (
                                  <>
                                    <span className="text-body-sm text-on-surface-variant truncate max-w-[120px]">{occupied.guestName}</span>
                                    <span className="inline-flex items-center px-2 py-1 rounded-pill text-label-bold bg-[#FEF3C7] text-[#92400E]">{t.occupied}</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="inline-flex items-center gap-1 text-primary text-label-md font-medium">
                                      <span className="material-symbols-outlined text-[18px]">add</span>{t.reserve}
                                    </span>
                                    <span className="inline-flex items-center px-2 py-1 rounded-pill text-label-bold bg-[#DCFCE7] text-[#166534]">{t.free}</span>
                                  </>
                                )}
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
