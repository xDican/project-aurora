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

interface RoomAvailability {
  room: Room;
  available: boolean;
  conflicts: ConflictingReservation[];
  mergedRanges: MergedRange[];
}

/**
 * Consolidates contiguous or overlapping reservations into unified ranges.
 * Rule: merge if next.check_in_date <= current_end (overlap or contiguous)
 */
function mergeReservationRanges(reservations: ConflictingReservation[]): MergedRange[] {
  if (reservations.length === 0) return [];

  const sorted = [...reservations].sort(
    (a, b) => new Date(a.check_in_date).getTime() - new Date(b.check_in_date).getTime()
  );

  const merged: MergedRange[] = [];

  for (const r of sorted) {
    const start = new Date(r.check_in_date);
    const end = new Date(r.check_out_date);

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
        const hasConflictInSelectedRange = conflicts.some((c) => {
          const cStart = new Date(c.check_in_date);
          const cEnd = new Date(c.check_out_date);
          return cStart < selectedEnd && cEnd > selectedStart;
        });

        return {
          room,
          available: !hasConflictInSelectedRange,
          conflicts,
          mergedRanges: mergeReservationRanges(conflicts),
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
    if (ranges.length === 0) return "";

    if (ranges.length === 1) {
      return `${t.occupiedFrom} ${format(ranges[0].start, "dd/MM/yyyy")} ${t.to} ${format(ranges[0].end, "dd/MM/yyyy")}`;
    }

    const rangeStrings = ranges.map(
      (r) => `${format(r.start, "dd/MM")}→${format(r.end, "dd/MM")}`
    );
    return `${t.occupied}: ${rangeStrings.join(", ")}`;
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
                  {filteredResults.map(({ room, available, mergedRanges }) => (
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
                        {mergedRanges.length > 0 && (
                          <span className="text-sm text-muted-foreground">
                            {formatMergedRanges(mergedRanges)}
                          </span>
                        )}
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
