import { useState, useCallback } from "react";
import { format, addDays, subDays, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, CalendarCheck, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { es } from "@/lib/i18n/es";
import { supabase } from "@/integrations/supabase/client";
import { type Room } from "@/hooks/useRooms";
import { type Guest } from "@/hooks/useGuests";
import { ReservationForm } from "@/components/reservations/ReservationForm";
import { useReservations, type NewReservationInput } from "@/hooks/useReservations";
import { cn } from "@/lib/utils";

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

      const parsedRooms = (roomsData ?? []) as Room[];
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
  }, [checkInDate, checkOutDate, t.validation.datesRequired]);

  const handleReserveClick = (room: Room) => {
    setPrefillData({
      roomId: room.id,
      checkIn: checkInDate,
      checkOut: checkOutDate,
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

  const formatRoomInfo = (
    available: boolean,
    mergedRanges: MergedRange[],
    nextFreeDate: Date | null,
    suggestedGap: AvailableGap | null
  ): React.ReactNode => {
    const occupiedText = formatMergedRanges(mergedRanges);

    if (available) {
      return (
        <div className="space-y-1">
          {occupiedText && (
            <span className="text-sm text-muted-foreground block">{occupiedText}</span>
          )}
          <span className="text-sm text-green-600 dark:text-green-400 font-medium">
            {t.freeToBook}
          </span>
        </div>
      );
    }

    // Not available
    return (
      <div className="space-y-1">
        {occupiedText && (
          <span className="text-sm text-muted-foreground block">{occupiedText}</span>
        )}
        {nextFreeDate && (
          <span className="text-sm text-blue-600 dark:text-blue-400 block">
            {t.availableFrom}: {format(nextFreeDate, "dd/MM/yyyy")}
          </span>
        )}
        {suggestedGap && (
          <span className="text-sm text-amber-600 dark:text-amber-400 block">
            {t.suggestedGap}: {format(suggestedGap.start, "dd/MM")} → {format(suggestedGap.end, "dd/MM")}
          </span>
        )}
      </div>
    );
  };

  // Filter results based on toggle
  const filteredResults = showOnlyAvailable
    ? roomAvailability.filter((r) => r.available)
    : roomAvailability;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <CalendarCheck className="h-6 w-6" />
            {t.title}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="checkIn">{t.checkInLabel}</Label>
              <Input
                id="checkIn"
                type="date"
                min={format(new Date(), "yyyy-MM-dd")}
                value={checkInDate}
                onChange={(e) => setCheckInDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="checkOut">{t.checkOutLabel}</Label>
              <Input
                id="checkOut"
                type="date"
                value={checkOutDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="showAvailable"
                checked={showOnlyAvailable}
                onCheckedChange={setShowOnlyAvailable}
              />
              <Label htmlFor="showAvailable" className="text-sm">
                {t.showOnlyAvailable}
              </Label>
            </div>

            <Button
              onClick={searchAvailability}
              disabled={!checkInDate || !checkOutDate || loading}
            >
              <Search className="h-4 w-4 mr-2" />
              {loading ? es.common.loading : t.searchButton}
            </Button>
          </div>

          {/* Quick shortcuts */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setQuickRange("today")}>
              {t.shortcuts.today}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setQuickRange("tomorrow")}>
              {t.shortcuts.tomorrow}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setQuickRange("week")}>
              {t.shortcuts.nextWeek}
            </Button>
          </div>

          {/* Results */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              {es.common.loading}
            </div>
          ) : !hasSearched ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t.selectDatesToSearch}</p>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>{t.noResults}</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.columns.room}</TableHead>
                    <TableHead>{t.columns.type}</TableHead>
                    <TableHead>{t.columns.roomStatus}</TableHead>
                    <TableHead>{t.columns.availability}</TableHead>
                    <TableHead>{t.columns.conflictInfo}</TableHead>
                    <TableHead>{t.columns.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {filteredResults.map(({ room, available, mergedRanges, nextFreeDate, suggestedGap }) => (
                    <TableRow key={room.id}>
                      <TableCell className="font-medium">{room.number}</TableCell>
                      <TableCell>
                        {es.roomTypeLabels[room.type] || room.type}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                            room.status === "available"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                          )}
                        >
                          {es.statusLabels[room.status] || room.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {available ? (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                            <CheckCircle className="h-4 w-4" />
                            {t.available}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                            <XCircle className="h-4 w-4" />
                            {t.notAvailable}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {formatRoomInfo(available, mergedRanges, nextFreeDate, suggestedGap)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          disabled={!available}
                          onClick={() => handleReserveClick(room)}
                        >
                          {available ? t.reserveButton : t.notAvailable}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
            rooms={rooms}
            guests={guests}
            onSubmit={handleReservationCreate}
            onCancel={() => setIsReservationDialogOpen(false)}
            prefillRoomId={prefillData?.roomId}
            prefillCheckInDate={prefillData?.checkIn}
            prefillCheckOutDate={prefillData?.checkOut}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
