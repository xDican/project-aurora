import { useState, useCallback } from "react";
import { format, addDays, subDays, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { es } from "@/lib/i18n/es";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Room } from "@/hooks/useRooms";
import { type Guest } from "@/hooks/useGuests";
import { type OccupancyType } from "@/hooks/useRoomRates";
import { ReservationForm } from "@/components/reservations/ReservationForm";
import { useReservations, type NewReservationInput } from "@/hooks/useReservations";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

const OCCUPANCY_OPTIONS = Object.keys(es.occupancyLabels) as OccupancyType[];

interface ConflictingReservation {
  id: string;
  room_id: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
}

interface MergedRange {
  start: Date;
  end: Date;
}

interface AvailableGap {
  start: Date;
  end: Date;
}

interface RoomAvailability {
  room: Room;
  available: boolean;
  conflicts: ConflictingReservation[];
  mergedRanges: MergedRange[];
  nextFreeDate: Date | null;
  suggestedGap: AvailableGap | null;
  // Price for the selected occupancy filter, when one is chosen
  price?: number;
}

/**
 * Consolidates contiguous or overlapping reservations into unified ranges.
 * Rule: merge if next.check_in_date <= current_end (overlap or contiguous)
 */
function mergeReservationRanges(reservations: ConflictingReservation[]): MergedRange[] {
  if (reservations.length === 0) return [];

  const sorted = [...reservations].sort(
    (a, b) => parseISO(a.check_in_date).getTime() - parseISO(b.check_in_date).getTime()
  );

  const merged: MergedRange[] = [];

  for (const r of sorted) {
    const start = parseISO(r.check_in_date);
    const end = parseISO(r.check_out_date);

    if (merged.length === 0) {
      merged.push({ start, end });
      continue;
    }

    const last = merged[merged.length - 1];

    // Merge if overlapping or contiguous (start <= last.end)
    if (start <= last.end) {
      if (end > last.end) {
        last.end = end;
      }
    } else {
      merged.push({ start, end });
    }
  }

  return merged;
}

/**
 * Finds the next free date after the block that conflicts with the selected range.
 */
function findNextFreeDate(
  mergedRanges: MergedRange[],
  selectedStart: Date,
  selectedEnd: Date
): Date | null {
  const sortedRanges = [...mergedRanges].sort((a, b) => a.start.getTime() - b.start.getTime());

  for (const range of sortedRanges) {
    if (range.start < selectedEnd && range.end > selectedStart) {
      return range.end;
    }
  }

  return null;
}

/**
 * Finds the first available gap where the requested duration fits.
 * Searches up to 90 days from the search start date.
 */
function findFirstAvailableGap(
  mergedRanges: MergedRange[],
  nights: number,
  searchFromDate: Date
): AvailableGap | null {
  const sortedRanges = [...mergedRanges]
    .filter((r) => r.end > searchFromDate)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const maxSearchDate = addDays(searchFromDate, 90);

  // If no occupied ranges, available from searchFromDate
  if (sortedRanges.length === 0) {
    return { start: searchFromDate, end: addDays(searchFromDate, nights) };
  }

  // Check gap BEFORE first range
  const firstRange = sortedRanges[0];
  if (firstRange.start > searchFromDate) {
    const gapNights = Math.floor(
      (firstRange.start.getTime() - searchFromDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (gapNights >= nights) {
      return { start: searchFromDate, end: addDays(searchFromDate, nights) };
    }
  }

  // Check gaps BETWEEN ranges
  for (let i = 0; i < sortedRanges.length - 1; i++) {
    const currentEnd = sortedRanges[i].end;
    const nextStart = sortedRanges[i + 1].start;

    const gapNights = Math.floor(
      (nextStart.getTime() - currentEnd.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (gapNights >= nights) {
      return { start: currentEnd, end: addDays(currentEnd, nights) };
    }
  }

  // Gap AFTER last range
  const lastRange = sortedRanges[sortedRanges.length - 1];
  if (lastRange.end < maxSearchDate) {
    return { start: lastRange.end, end: addDays(lastRange.end, nights) };
  }

  return null;
}

export default function Disponibilidad() {
  const t = es.availabilityPage;
  const { createReservation } = useReservations();

  // Filters
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);
  const [occupancyFilter, setOccupancyFilter] = useState<OccupancyType | "all">("all");

  // Results
  const [roomAvailability, setRoomAvailability] = useState<RoomAvailability[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Reservation modal
  const [isReservationDialogOpen, setIsReservationDialogOpen] = useState(false);
  const [prefillData, setPrefillData] = useState<{
    roomId: string;
    checkIn: string;
    checkOut: string;
    occupancy?: OccupancyType;
  } | null>(null);

  // Data for reservation form
  const [rooms, setRooms] = useState<Room[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);

  const searchAvailability = useCallback(async () => {
    if (!checkInDate || !checkOutDate) {
      toast.error(t.validation.datesRequired);
      return;
    }

    if (checkOutDate <= checkInDate) {
      toast.error(es.reservationsPage.validation.checkOutAfterCheckIn);
      return;
    }

    const today = format(new Date(), "yyyy-MM-dd");
    if (checkInDate < today) {
      toast.error(es.reservationsPage.validation.checkInPast);
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      // 1. Get active rooms
      const { data: roomsData, error: roomsError } = await supabase
        .from("rooms")
        .select("*")
        .eq("is_active", true)
        .order("number", { ascending: true });

      if (roomsError) throw roomsError;

      let parsedRooms = (roomsData ?? []) as Room[];

      // 1b. If a room size was chosen, only keep rooms that have an active
      // rate for that occupancy, and remember the price to show on the card
      let priceByRoomId: Record<string, number> = {};
      if (occupancyFilter !== "all") {
        const { data: ratesData, error: ratesError } = await supabase
          .from("room_rates")
          .select("room_id, price")
          .eq("occupancy", occupancyFilter)
          .eq("is_active", true);

        if (ratesError) throw ratesError;

        priceByRoomId = Object.fromEntries(
          (ratesData ?? []).map((r) => [r.room_id, r.price])
        );
        parsedRooms = parsedRooms.filter((room) => room.id in priceByRoomId);
      }

      setRooms(parsedRooms);

      // 2. Get blocking reservations with extended window to capture contiguous chains
      const selectedStart = parseISO(checkInDate);
      const selectedEnd = parseISO(checkOutDate);
      const windowStart = format(subDays(selectedStart, 30), "yyyy-MM-dd");
      const windowEnd = format(addDays(selectedEnd, 30), "yyyy-MM-dd");

      const { data: reservations, error: resError } = await supabase
        .from("reservations")
        .select("id, room_id, check_in_date, check_out_date, status")
        .in("status", ["booked", "checked_in"])
        .lt("check_in_date", windowEnd)
        .gt("check_out_date", windowStart);

      if (resError) throw resError;

      // 3. Create conflicts map by room_id - store ALL reservations
      const conflictsByRoomId: Record<string, ConflictingReservation[]> = {};
      (reservations ?? []).forEach((res) => {
        const roomId = res.room_id;
        if (!conflictsByRoomId[roomId]) {
          conflictsByRoomId[roomId] = [];
        }
        conflictsByRoomId[roomId].push(res as ConflictingReservation);
      });

      // 4. Calculate availability - check against SELECTED range only
      const availability: RoomAvailability[] = parsedRooms.map((room) => {
        const conflicts = conflictsByRoomId[room.id] || [];
        const mergedRanges = mergeReservationRanges(conflicts);
        const hasConflictInSelectedRange = conflicts.some((c) => {
          const cStart = parseISO(c.check_in_date);
          const cEnd = parseISO(c.check_out_date);
          return cStart < selectedEnd && cEnd > selectedStart;
        });

        // Calculate next free date if not available
        const nextFreeDate = hasConflictInSelectedRange
          ? findNextFreeDate(mergedRanges, selectedStart, selectedEnd)
          : null;

        // Calculate nights requested
        const nightsRequested = Math.floor(
          (selectedEnd.getTime() - selectedStart.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Find suggested gap if not available
        const suggestedGap = hasConflictInSelectedRange
          ? findFirstAvailableGap(mergedRanges, nightsRequested, selectedStart)
          : null;

        return {
          room,
          available: !hasConflictInSelectedRange,
          conflicts,
          mergedRanges,
          nextFreeDate,
          suggestedGap,
          price: priceByRoomId[room.id],
        };
      });

      setRoomAvailability(availability);

      // 5. Load guests for reservation form
      const { data: guestsData } = await supabase
        .from("guests")
        .select("*")
        .eq("is_active", true)
        .order("name");

      setGuests((guestsData ?? []) as Guest[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : es.common.unexpectedError;
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [checkInDate, checkOutDate, occupancyFilter, t.validation.datesRequired]);

  const handleReserveClick = (room: Room) => {
    setPrefillData({
      roomId: room.id,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      occupancy: occupancyFilter !== "all" ? occupancyFilter : undefined,
    });
    setIsReservationDialogOpen(true);
  };

  const handleReservationCreate = async (input: NewReservationInput) => {
    try {
      await createReservation(input);
      setIsReservationDialogOpen(false);
      toast.success(es.reservationsPage.reservationCreated);
      // Re-run search to update availability
      await searchAvailability();
    } catch (err) {
      const message = err instanceof Error ? err.message : es.common.unexpectedError;
      if (message === "ROOM_OVERLAP") {
        toast.error(es.reservationsPage.errors.roomOverlap);
      } else if (message === "PAST_CHECKIN") {
        toast.error(es.reservationsPage.errors.checkInPast);
      } else {
        toast.error(message);
      }
    }
  };

  const setQuickRange = (type: "today" | "tomorrow" | "week") => {
    const today = new Date();
    let start: Date;
    let end: Date;

    switch (type) {
      case "today":
        start = today;
        end = addDays(today, 1);
        break;
      case "tomorrow":
        start = addDays(today, 1);
        end = addDays(today, 2);
        break;
      case "week":
        start = today;
        end = addDays(today, 7);
        break;
    }

    setCheckInDate(format(start, "yyyy-MM-dd"));
    setCheckOutDate(format(end, "yyyy-MM-dd"));
  };

  const formatMergedRanges = (ranges: MergedRange[]): string => {
    // Filter out ranges that ended before today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const relevantRanges = ranges.filter((r) => r.end > today);

    if (relevantRanges.length === 0) return "";

    if (relevantRanges.length === 1) {
      return `${t.occupiedFrom} ${format(relevantRanges[0].start, "dd/MM/yyyy")} ${t.to} ${format(relevantRanges[0].end, "dd/MM/yyyy")}`;
    }

    const rangeStrings = relevantRanges.map(
      (r) => `${format(r.start, "dd/MM")}→${format(r.end, "dd/MM")}`
    );
    return `${t.occupied}: ${rangeStrings.join(", ")}`;
  };

  // Filter results based on toggle
  const filteredResults = showOnlyAvailable
    ? roomAvailability.filter((r) => r.available)
    : roomAvailability;

  return (
    <div className="space-y-stack_gap_md">
      {/* Filters & Controls */}
      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col lg:flex-row gap-6 items-start lg:items-end justify-between">
        <div className="flex flex-col md:flex-row gap-4 w-full lg:w-auto">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="checkIn" className="text-label-md text-on-surface-variant">
              {t.checkInLabel}
            </Label>
            <Input
              id="checkIn"
              type="date"
              min={format(new Date(), "yyyy-MM-dd")}
              value={checkInDate}
              onChange={(e) => setCheckInDate(e.target.value)}
              className="w-full md:w-40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="checkOut" className="text-label-md text-on-surface-variant">
              {t.checkOutLabel}
            </Label>
            <Input
              id="checkOut"
              type="date"
              value={checkOutDate}
              onChange={(e) => setCheckOutDate(e.target.value)}
              className="w-full md:w-40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="occupancyFilter" className="text-label-md text-on-surface-variant">
              {t.occupancyFilterLabel}
            </Label>
            <Select
              value={occupancyFilter}
              onValueChange={(value) => setOccupancyFilter(value as OccupancyType | "all")}
            >
              <SelectTrigger id="occupancyFilter" className="w-full md:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.anySize}</SelectItem>
                {OCCUPANCY_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {es.occupancyLabels[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex bg-surface-container-low border border-outline-variant rounded-lg p-1">
            <button
              type="button"
              onClick={() => setQuickRange("today")}
              className="px-4 py-1.5 rounded-md text-on-surface-variant hover:bg-surface text-label-md transition-colors"
            >
              {t.shortcuts.today}
            </button>
            <button
              type="button"
              onClick={() => setQuickRange("tomorrow")}
              className="px-4 py-1.5 rounded-md text-on-surface-variant hover:bg-surface text-label-md transition-colors"
            >
              {t.shortcuts.tomorrow}
            </button>
            <button
              type="button"
              onClick={() => setQuickRange("week")}
              className="px-4 py-1.5 rounded-md text-on-surface-variant hover:bg-surface text-label-md transition-colors"
            >
              {t.shortcuts.nextWeek}
            </button>
          </div>
          <div className="w-px h-8 bg-outline-variant mx-2 hidden md:block" />
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch
              id="showAvailable"
              checked={showOnlyAvailable}
              onCheckedChange={setShowOnlyAvailable}
            />
            <span className="text-label-md text-on-surface-variant">{t.showOnlyAvailable}</span>
          </label>
          <Button
            onClick={searchAvailability}
            disabled={!checkInDate || !checkOutDate || loading}
            className="min-w-[140px]"
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {loading ? es.common.loading : t.searchButton}
          </Button>
        </div>
      </section>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          {es.common.loading}
        </div>
      ) : !hasSearched ? (
        <div className="text-center py-12 text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl opacity-50 mb-2 block">
            calendar_month
          </span>
          <p>{t.selectDatesToSearch}</p>
        </div>
      ) : filteredResults.length === 0 ? (
        <div className="text-center py-12 text-on-surface-variant">
          <p>{t.noResults}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-1">
            <p className="text-body-sm text-on-surface-variant">
              Mostrando <strong className="text-on-surface">{filteredResults.length}</strong>{" "}
              habitaciones en los criterios seleccionados.
            </p>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-label-md text-on-surface-variant">
                <span className="w-2 h-2 rounded-full bg-primary" /> {t.available}
              </span>
              <span className="flex items-center gap-1 text-label-md text-on-surface-variant">
                <span className="w-2 h-2 rounded-full bg-surface-container-highest" /> {t.notAvailable}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-gutter pb-8">
            {filteredResults.map(({ room, available, mergedRanges, nextFreeDate, suggestedGap, price }) => (
              <article
                key={room.id}
                className={cn(
                  "border border-outline-variant rounded-xl p-5 flex flex-col gap-4",
                  available
                    ? "bg-surface-container-lowest hover:bg-surface-container-low transition-colors"
                    : "bg-surface-container-lowest opacity-90"
                )}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-headline-md text-foreground font-bold">{room.number}</h3>
                    <p className="text-label-md text-on-surface-variant mt-0.5">
                      {es.roomTypeLabels[room.type] || room.type}
                      {occupancyFilter !== "all" && ` · ${es.occupancyLabels[occupancyFilter]}`}
                    </p>
                    {price !== undefined && (
                      <p className="text-body-sm text-primary font-medium mt-0.5">
                        {formatCurrency(price)} / noche
                      </p>
                    )}
                  </div>
                  {available ? (
                    <span className="bg-primary-container text-on-primary-container px-2.5 py-1 rounded-pill flex items-center gap-1.5 text-label-bold uppercase">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      {t.available}
                    </span>
                  ) : (
                    <span className="bg-surface-container-highest text-on-surface-variant px-2.5 py-1 rounded-pill flex items-center gap-1.5 text-label-bold uppercase">
                      <span className="material-symbols-outlined text-[14px]">block</span>
                      {t.notAvailable}
                    </span>
                  )}
                </div>

                {!available && (
                  <div className="flex flex-col gap-1.5">
                    {formatMergedRanges(mergedRanges) && (
                      <div className="flex items-center gap-2 text-foreground">
                        <span className="material-symbols-outlined text-[16px] text-destructive">
                          event_busy
                        </span>
                        <span className="text-body-sm font-medium">
                          {formatMergedRanges(mergedRanges)}
                        </span>
                      </div>
                    )}
                    {nextFreeDate && (
                      <div className="flex items-center gap-2 text-primary">
                        <span className="material-symbols-outlined text-[16px]">event_available</span>
                        <span className="text-body-sm">
                          {t.availableFrom}: {format(nextFreeDate, "dd/MM/yyyy")}
                        </span>
                      </div>
                    )}
                    {suggestedGap && (
                      <div className="flex items-center gap-2 text-tertiary">
                        <span className="material-symbols-outlined text-[16px]">event</span>
                        <span className="text-body-sm">
                          {t.suggestedGap}: {format(suggestedGap.start, "dd/MM")} → {format(suggestedGap.end, "dd/MM")}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-auto pt-4 border-t border-surface-variant">
                  <button
                    type="button"
                    disabled={!available}
                    onClick={() => handleReserveClick(room)}
                    className="w-full bg-primary text-primary-foreground hover:bg-on-primary-fixed-variant disabled:opacity-40 disabled:cursor-not-allowed text-label-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {available ? t.reserveButton : t.notAvailable}
                    {available && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {/* Reservation Dialog with prefill */}
      <Dialog
        open={isReservationDialogOpen}
        onOpenChange={setIsReservationDialogOpen}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{es.reservationsPage.newReservation}</DialogTitle>
          </DialogHeader>
          <ReservationForm
            guests={guests}
            onSubmit={handleReservationCreate}
            onCancel={() => setIsReservationDialogOpen(false)}
            prefillRoomId={prefillData?.roomId}
            prefillCheckInDate={prefillData?.checkIn}
            prefillCheckOutDate={prefillData?.checkOut}
            initialOccupancy={prefillData?.occupancy}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
