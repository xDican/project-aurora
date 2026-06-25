import { useState, useEffect, useMemo } from "react";
import { differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { es } from "@/lib/i18n/es";
import { type Guest, useGuests } from "@/hooks/useGuests";
import { type NewReservationInput } from "@/hooks/useReservations";
import { supabase } from "@/integrations/supabase/client";
import { type OccupancyType } from "@/hooks/useRoomRates";
import { formatCurrency } from "@/lib/currency";
import { GuestCombobox } from "./GuestCombobox";
import { CreateGuestModal } from "./CreateGuestModal";

interface ReservationFormProps {
  guests: Guest[];
  onSubmit: (input: NewReservationInput) => Promise<void>;
  onCancel: () => void;
  prefillRoomId?: string;
  prefillCheckInDate?: string;
  prefillCheckOutDate?: string;
  // When set, the form edits an existing reservation instead of creating one
  editingReservationId?: string;
  reservationStatus?: string;
  initialGuest?: Guest;
  initialOccupancy?: OccupancyType;
}

interface RoomOption {
  roomId: string;
  roomNumber: string;
  rateId: string;
  price: number;
}

const OCCUPANCY_OPTIONS = Object.keys(es.occupancyLabels) as OccupancyType[];

export function ReservationForm({
  guests,
  onSubmit,
  onCancel,
  prefillRoomId,
  prefillCheckInDate,
  prefillCheckOutDate,
  editingReservationId,
  reservationStatus,
  initialGuest,
  initialOccupancy,
}: ReservationFormProps) {
  const t = es.reservationsPage;
  const isEditing = Boolean(editingReservationId);
  const isCheckedIn = isEditing && reservationStatus === "checked_in";

  const [guestId, setGuestId] = useState(initialGuest?.id || "");
  const [checkInDate, setCheckInDate] = useState(prefillCheckInDate || "");
  const [checkOutDate, setCheckOutDate] = useState(prefillCheckOutDate || "");
  const [occupancy, setOccupancy] = useState<OccupancyType | "">(initialOccupancy || "");
  const [roomId, setRoomId] = useState("");

  // Guest search - reuses the same query as the Guests page (useGuests), instead
  // of the previous bespoke search here that silently swallowed query errors
  const {
    guests: searchedGuests,
    search: guestSearchQuery,
    setSearch: setGuestSearchQuery,
    loading: isSearchingGuests,
    error: guestSearchError,
  } = useGuests();
  // Holds either a guest just created via the modal, or (in edit mode) the
  // reservation's current guest, so the combobox shows a name immediately
  // without depending on a search query matching it
  const [guestOverride, setGuestOverride] = useState<Guest | null>(initialGuest || null);
  const [isCreateGuestModalOpen, setIsCreateGuestModalOpen] = useState(false);

  // Find selected guest for display
  const selectedGuest = (guestOverride && guestOverride.id === guestId ? guestOverride : null) ||
    searchedGuests.find((g) => g.id === guestId) ||
    guests.find((g) => g.id === guestId) || null;

  // Rooms that actually satisfy the chosen dates + occupancy - rooms with a
  // conflicting reservation never appear here, so a conflict becomes
  // impossible to pick instead of something we warn about after the fact.
  const [roomOptions, setRoomOptions] = useState<RoomOption[]>([]);
  const [loadingRoomOptions, setLoadingRoomOptions] = useState(false);
  const [initialRoomApplied, setInitialRoomApplied] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedRoomOption = roomOptions.find((o) => o.roomId === roomId);

  // Calculate number of nights and total price
  const { nights, totalPrice } = useMemo(() => {
    if (!checkInDate || !checkOutDate || !selectedRoomOption) {
      return { nights: 0, totalPrice: 0 };
    }
    const numNights = differenceInDays(new Date(checkOutDate), new Date(checkInDate));
    if (numNights <= 0) return { nights: 0, totalPrice: 0 };
    return { nights: numNights, totalPrice: numNights * selectedRoomOption.price };
  }, [checkInDate, checkOutDate, selectedRoomOption]);

  // Handler when guest is created from modal
  const handleGuestCreated = (newGuest: Guest) => {
    setGuestId(newGuest.id);
    setGuestOverride(newGuest);
    setGuestSearchQuery("");
  };

  // Find rooms available for the chosen dates + occupancy: rooms with an
  // active rate for that occupancy, minus rooms with a conflicting
  // booked/checked_in reservation in that date range.
  useEffect(() => {
    if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate || !occupancy) {
      setRoomOptions([]);
      return;
    }

    let cancelled = false;
    setLoadingRoomOptions(true);

    (async () => {
      const { data: ratesData, error: ratesError } = await supabase
        .from("room_rates")
        .select("id, room_id, price")
        .eq("occupancy", occupancy)
        .eq("is_active", true);

      if (cancelled) return;
      if (ratesError || !ratesData || ratesData.length === 0) {
        setRoomOptions([]);
        setLoadingRoomOptions(false);
        return;
      }

      const roomIds = ratesData.map((r) => r.room_id);

      const { data: roomsData, error: roomsError } = await supabase
        .from("rooms")
        .select("id, number")
        .eq("is_active", true)
        .in("id", roomIds);

      if (cancelled) return;
      if (roomsError || !roomsData) {
        setRoomOptions([]);
        setLoadingRoomOptions(false);
        return;
      }

      let conflictQuery = supabase
        .from("reservations")
        .select("id, room_id")
        .in("room_id", roomIds)
        .in("status", ["booked", "checked_in"])
        .lt("check_in_date", checkOutDate)
        .gt("check_out_date", checkInDate);
      if (editingReservationId) {
        conflictQuery = conflictQuery.neq("id", editingReservationId);
      }
      const { data: conflicts } = await conflictQuery;

      if (cancelled) return;

      const blockedRoomIds = new Set((conflicts ?? []).map((c) => c.room_id));
      const rateByRoom = new Map(ratesData.map((r) => [r.room_id, r]));

      const options: RoomOption[] = roomsData
        .filter((r) => !blockedRoomIds.has(r.id))
        .map((r) => {
          const rate = rateByRoom.get(r.id)!;
          return { roomId: r.id, roomNumber: r.number, rateId: rate.id, price: rate.price };
        })
        .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));

      setRoomOptions(options);
      setLoadingRoomOptions(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [checkInDate, checkOutDate, occupancy, editingReservationId]);

  // Keep the room selection in sync with the available options: apply the
  // prefilled/current room once if it's in the list, auto-pick if there's
  // only one option, and clear a choice that's no longer valid (e.g. the
  // user changed dates/occupancy and that room dropped out).
  useEffect(() => {
    if (roomOptions.length === 0) {
      if (roomId) setRoomId("");
      return;
    }
    if (roomId && roomOptions.some((o) => o.roomId === roomId)) {
      return;
    }
    if (!initialRoomApplied && prefillRoomId && roomOptions.some((o) => o.roomId === prefillRoomId)) {
      setRoomId(prefillRoomId);
      setInitialRoomApplied(true);
      return;
    }
    if (roomOptions.length === 1) {
      setRoomId(roomOptions[0].roomId);
      return;
    }
    setRoomId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomOptions]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!guestId) {
      newErrors.guestId = t.validation.guestRequired;
    }
    if (!checkInDate) {
      newErrors.checkInDate = t.validation.checkInRequired;
    }
    if (!checkOutDate) {
      newErrors.checkOutDate = t.validation.checkOutRequired;
    }
    if (checkInDate && checkOutDate && checkOutDate <= checkInDate) {
      newErrors.checkOutDate = t.validation.checkOutAfterCheckIn;
    }
    // Skip when editing: an existing reservation's check-in is routinely
    // already in the past (e.g. extending a stay that started days ago)
    if (!isEditing) {
      const today = new Date().toISOString().split("T")[0];
      if (checkInDate && checkInDate < today) {
        newErrors.checkInDate = t.validation.checkInPast;
      }
    }
    if (!occupancy) {
      newErrors.occupancy = t.validation.occupancyRequired;
    }
    if (occupancy && !roomId) {
      newErrors.roomId = t.validation.roomRequired;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate() || !selectedRoomOption) return;

    setIsSubmitting(true);

    try {
      await onSubmit({
        guestId,
        roomId,
        checkInDate,
        checkOutDate,
        roomRateId: selectedRoomOption.rateId,
        basePrice: selectedRoomOption.price,
        finalPrice: totalPrice,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : es.common.unexpectedError;
      if (message === "ROOM_OVERLAP") {
        setSubmitError(t.errors.roomOverlap);
      } else if (message === "PAST_CHECKIN") {
        setSubmitError(t.errors.checkInPast);
      } else {
        setSubmitError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const datesValid = Boolean(checkInDate && checkOutDate && checkOutDate > checkInDate);
  const noRoomsAvailable = datesValid && occupancy && !loadingRoomOptions && roomOptions.length === 0;
  const canSubmit = !isSubmitting && Boolean(roomId) && nights > 0;

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {submitError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        {/* Guest Search Combobox */}
        <div className="space-y-2">
          <Label>{t.form.guestLabel} *</Label>
          <GuestCombobox
            guests={searchedGuests}
            selectedGuestId={guestId}
            selectedGuest={selectedGuest}
            onSelect={setGuestId}
            onOpenCreateModal={() => setIsCreateGuestModalOpen(true)}
            searchQuery={guestSearchQuery}
            onSearchChange={setGuestSearchQuery}
            isSearching={isSearchingGuests}
            error={errors.guestId}
            searchError={guestSearchError}
          />
        </div>

        {/* Dates first - everything below depends on these */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="checkInDate">{t.form.checkInLabel} *</Label>
            <Input
              id="checkInDate"
              type="date"
              min={isEditing ? undefined : new Date().toISOString().split("T")[0]}
              value={checkInDate}
              onChange={(e) => setCheckInDate(e.target.value)}
              disabled={isCheckedIn}
              className={errors.checkInDate ? "border-destructive" : ""}
            />
            {isCheckedIn && (
              <p className="text-xs text-muted-foreground">El ingreso ya fue registrado y no puede modificarse.</p>
            )}
            {errors.checkInDate && (
              <p className="text-sm text-destructive">{errors.checkInDate}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="checkOutDate">{t.form.checkOutLabel} *</Label>
            <Input
              id="checkOutDate"
              type="date"
              value={checkOutDate}
              onChange={(e) => setCheckOutDate(e.target.value)}
              className={errors.checkOutDate ? "border-destructive" : ""}
            />
            {errors.checkOutDate && (
              <p className="text-sm text-destructive">{errors.checkOutDate}</p>
            )}
          </div>
        </div>

        {/* Then occupancy */}
        <div className="space-y-2">
          <Label htmlFor="occupancy">{t.form.occupancyLabel} *</Label>
          <Select
            value={occupancy}
            onValueChange={(value) => setOccupancy(value as OccupancyType)}
            disabled={!datesValid}
          >
            <SelectTrigger
              id="occupancy"
              className={errors.occupancy ? "border-destructive" : ""}
            >
              <SelectValue
                placeholder={datesValid ? t.form.occupancyPlaceholder : t.form.datesFirstPlaceholder}
              />
            </SelectTrigger>
            <SelectContent>
              {OCCUPANCY_OPTIONS.map((value) => (
                <SelectItem key={value} value={value}>
                  {es.occupancyLabels[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.occupancy && (
            <p className="text-sm text-destructive">{errors.occupancy}</p>
          )}
        </div>

        {/* Only now: which specific rooms satisfy both dates and occupancy */}
        {datesValid && occupancy && (
          <div className="space-y-2">
            <Label htmlFor="room">{t.form.roomLabel} *</Label>
            {loadingRoomOptions ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {es.common.loading}
              </div>
            ) : noRoomsAvailable ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{t.noRoomsAvailable}</AlertDescription>
              </Alert>
            ) : (
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger
                  id="room"
                  className={errors.roomId ? "border-destructive" : ""}
                >
                  <SelectValue placeholder={t.form.roomPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {roomOptions.map((option) => (
                    <SelectItem key={option.roomId} value={option.roomId}>
                      {option.roomNumber} - {formatCurrency(option.price)} / noche
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {errors.roomId && (
              <p className="text-sm text-destructive">{errors.roomId}</p>
            )}
          </div>
        )}

        {/* Price Info */}
        {selectedRoomOption && nights > 0 && (
          <div className="rounded-md bg-muted p-3 text-sm space-y-1">
            <p>
              <strong>{t.form.basePriceLabel}:</strong>{" "}
              {formatCurrency(selectedRoomOption.price)} / noche
            </p>
            <p className="text-muted-foreground">
              {nights} {nights === 1 ? "noche" : "noches"}
            </p>
            <p className="text-lg font-semibold">
              <strong>{t.form.finalPriceLabel}:</strong>{" "}
              {formatCurrency(totalPrice)}
            </p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {es.common.cancel}
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {isSubmitting
              ? es.common.saving
              : isEditing
                ? t.form.saveChanges
                : es.common.save}
          </Button>
        </div>
      </form>

      {/* Create Guest Modal - Outside form to prevent event propagation issues */}
      <CreateGuestModal
        open={isCreateGuestModalOpen}
        onOpenChange={setIsCreateGuestModalOpen}
        onGuestCreated={handleGuestCreated}
      />
    </>
  );
}
