import { useState, useMemo } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  addMonths, format, isSameMonth, isToday, parseISO,
} from "date-fns";
import { es as dfEs } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { es } from "@/lib/i18n/es";
import type { SalonSpace } from "@/hooks/useSalonSpaces";
import type { SalonSlot } from "@/hooks/useSalonSlots";
import type { SalonReservationListItem } from "@/hooks/useSalonReservations";

const t = es.salonPage.availability;

type DayStatus = "free" | "partial" | "full";

const CELL: Record<DayStatus, string> = {
  free:    "bg-[#e6f4ea] text-[#137333] hover:bg-[#d3ecdb]",
  partial: "bg-[#fef7e0] text-[#b06000] hover:bg-[#fbeec5]",
  full:    "bg-[#fce8e6] text-[#c5221f] hover:bg-[#f7d6d3]",
};

const DOT: Record<DayStatus, string> = {
  free: "bg-[#137333]", partial: "bg-[#b06000]", full: "bg-[#c5221f]",
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Props {
  spaces: SalonSpace[];
  slots: SalonSlot[];
  reservations: SalonReservationListItem[];
}

export function SalonAvailabilityCalendar({ spaces, slots, reservations }: Props) {
  const [spaceId, setSpaceId] = useState("");
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  // Mantener un espacio válido aunque la lista cargue después del montaje.
  const effectiveSpaceId = spaces.some((s) => s.id === spaceId) ? spaceId : (spaces[0]?.id ?? "");

  const spaceSlots = useMemo(
    () => slots
      .filter((s) => s.is_active && s.space_id === effectiveSpaceId)
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [slots, effectiveSpaceId],
  );

  // día (yyyy-MM-dd) -> set de slotIds ocupados en ese espacio.
  const bookedByDay = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const r of reservations) {
      if (r.spaceId !== effectiveSpaceId || r.status === "cancelled") continue;
      for (const d of eachDayOfInterval({ start: parseISO(r.startDate), end: parseISO(r.endDate) })) {
        const key = format(d, "yyyy-MM-dd");
        if (!map.has(key)) map.set(key, new Set());
        map.get(key)!.add(r.slotId);
      }
    }
    return map;
  }, [reservations, effectiveSpaceId]);

  const gridDays = useMemo(() => eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end:   endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  }), [month]);

  const totalSlots = spaceSlots.length;

  const dayStatus = (key: string): DayStatus => {
    const booked = bookedByDay.get(key)?.size ?? 0;
    if (booked === 0) return "free";
    if (totalSlots > 0 && booked >= totalSlots) return "full";
    return "partial";
  };

  if (spaces.length === 0) {
    return <p className="text-center py-12 text-on-surface-variant">{t.noSpaces}</p>;
  }

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-full sm:w-64">
          <Select value={effectiveSpaceId} onValueChange={setSpaceId}>
            <SelectTrigger><SelectValue placeholder={t.spaceLabel} /></SelectTrigger>
            <SelectContent>{spaces.map((sp) => <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth((m) => addMonths(m, -1))} className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors" aria-label="Mes anterior">
            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
          </button>
          <span className="text-body-md font-medium text-on-surface min-w-[140px] text-center">{cap(format(month, "LLLL yyyy", { locale: dfEs }))}</span>
          <button onClick={() => setMonth((m) => addMonths(m, 1))} className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors" aria-label="Mes siguiente">
            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
          </button>
        </div>
      </div>

      {totalSlots === 0 ? (
        <p className="text-center py-12 text-on-surface-variant">{t.noSlots}</p>
      ) : (
        <>
          {/* Encabezado de días de semana */}
          <div className="grid grid-cols-7 gap-1.5">
            {t.weekdays.map((d) => (
              <div key={d} className="text-center text-label-md text-on-surface-variant uppercase tracking-wider py-1">{d}</div>
            ))}
          </div>

          {/* Grilla del mes */}
          <div className="grid grid-cols-7 gap-1.5">
            {gridDays.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const inMonth = isSameMonth(day, month);
              if (!inMonth) {
                return <div key={key} className="aspect-square rounded-lg bg-surface-container-lowest/40" />;
              }
              const status = dayStatus(key);
              const dayRes = reservations.filter((r) => r.spaceId === effectiveSpaceId && r.status !== "cancelled" && r.startDate <= key && key <= r.endDate);
              const freeSlots = spaceSlots.filter((s) => !dayRes.some((r) => r.slotId === s.id));

              return (
                <Popover key={key}>
                  <PopoverTrigger asChild>
                    <button className={`aspect-square rounded-lg border border-outline-variant/40 flex flex-col items-center justify-center gap-1 transition-colors ${CELL[status]} ${isToday(day) ? "ring-2 ring-primary ring-offset-1" : ""}`}>
                      <span className="text-body-md font-medium">{format(day, "d")}</span>
                      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3 space-y-2" align="center">
                    <p className="text-label-bold text-on-surface">{cap(format(day, "EEEE d 'de' LLLL", { locale: dfEs }))}</p>
                    {dayRes.length === 0 ? (
                      <p className="text-body-sm text-[#137333]">{t.allFree}</p>
                    ) : (
                      <div className="space-y-1.5">
                        <p className="text-label-md text-on-surface-variant uppercase tracking-wider">{t.bookedSlots}</p>
                        {dayRes.map((r) => (
                          <p key={r.id} className="text-body-sm text-on-surface">
                            <span className="font-medium">{r.slotName}</span> — {r.guestName || "—"}
                          </p>
                        ))}
                      </div>
                    )}
                    {dayRes.length > 0 && freeSlots.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-outline-variant">
                        <p className="text-label-md text-on-surface-variant uppercase tracking-wider">{t.freeSlots}</p>
                        {freeSlots.map((s) => <p key={s.id} className="text-body-sm text-[#137333]">{s.name}</p>)}
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              );
            })}
          </div>

          {/* Leyenda */}
          <div className="flex items-center gap-4 pt-1">
            {([["free", t.free], ["partial", t.partial], ["full", t.full]] as const).map(([k, label]) => (
              <div key={k} className="flex items-center gap-1.5">
                <span className={`h-3 w-3 rounded ${CELL[k].split(" ")[0]}`} />
                <span className="text-body-sm text-on-surface-variant">{label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
