import { useState, useEffect, useCallback, useMemo } from "react";
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
import { AlertCircle, AlertTriangle, Loader2 } from "lucide-react";
import { es } from "@/lib/i18n/es";
import { type Room } from "@/hooks/useRooms";
import { type Guest, useGuests } from "@/hooks/useGuests";
import { type NewReservationInput } from "@/hooks/useReservations";
import { supabase } from "@/integrations/supabase/client";
import { type RoomRate } from "@/hooks/useRoomRates";
import { formatCurrency } from "@/lib/currency";
import { GuestCombobox } from "./GuestCombobox";
import { CreateGuestModal } from "./CreateGuestModal";

interface ReservationFormProps {
  rooms: Room[];
  guests: Guest[];
  onSubmit: (input: NewReservationInput) => Promise<void>;
  onCancel: () => void;
  prefillRoomId?: string;
  prefillCheckInDate?: string;
  prefillCheckOutDate?: string;
}

export function ReservationForm({
  rooms,
  guests,
  onSubmit,
  onCancel,
  prefillRoomId,
  prefillCheckInDate,
  prefillCheckOutDate,
}: ReservationFormProps) {
  const t = es.reservationsPage;

  const [guestId, setGuestId] = useState("");
  const [roomId, setRoomId] = useState(prefillRoomId || "");
  const [checkInDate, setCheckInDate] = useState(prefillCheckInDate || "");
  const [checkOutDate, setCheckOutDate] = useState(prefillCheckOutDate || "");

  // Guest search - reuses the same query as the Guests page (useGuests), instead
  // of the previous bespoke search here that silently swallowed query errors
  const {
    guests: searchedGuests,
    search: guestSearchQuery,
    setSearch: setGuestSearchQuery,
    loading: isSearchingGuests,
    error: guestSearchError,
  } = useGuests();
  const [createdGuest, setCreatedGuest] = useState<Guest | null>(null);
  const [isCreateGuestModalOpen, setIsCreateGuestModalOpen] = useState(false);

  // Find selected guest for display
  const selectedGuest = (createdGuest && createdGuest.id === guestId ? createdGuest : null) ||
    searchedGuests.find((g) => g.id === guestId) ||
    guests.find((g) => g.id === guestId) || null;

  // Room rates state
  const [availableRates, setAvailableRates] = useState<RoomRate[]>([]);
  const [selectedRateId, setSelectedRateId] = useState("");
  const [loadingRates, setLoadingRates] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  // Get selected rate for displaying price info
  const selectedRate = availableRates.find((r) => r.id === selectedRateId);

  // Calculate number of nights and total price
  const { nights, totalPrice } = useMemo(() => {
    if (!checkInDate || !checkOutDate || !selectedRate) {
      return { nights: 0, totalPrice: 0 };
    }
    const numNights = differenceInDays(new Date(checkOutDate), new Date(checkInDate));
    if (numNights <= 0) return { nights: 0, totalPrice: 0 };
    return { nights: numNights, totalPrice: numNights * selectedRate.price };
  }, [checkInDate, checkOutDate, selectedRate]);

  // Handler when guest is created from modal
  const handleGuestCreated = (newGuest: Guest) => {
    setGuestId(newGuest.id);
    setCreatedGuest(newGuest);
    setGuestSearchQuery("");
  };

  // Load rates when room changes
  useEffect(() => {
    if (!roomId) {
      setAvailableRates([]);
      setSelectedRateId("");
      return;
    }

    setLoadingRates(true);
    supabase
      .from("room_rates")
      .select("id, room_id, occupancy, price, is_active, created_at")
      .eq("room_id", roomId)
      .eq("is_active", true)
      .order("occupancy", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) {
          const rates = data as RoomRate[];
          setAvailableRates(rates);
          // Auto-select if only one rate
          if (rates.length === 1) {
            setSelectedRateId(rates[0].id);
          } else {
            setSelectedRateId("");
          }
        } else {
          setAvailableRates([]);
          setSelectedRateId("");
        }
        setLoadingRates(false);
      });
  }, [roomId]);

  // Check availability when room/dates change
  const checkAvailability = useCallback(async () => {
    if (!roomId || !checkInDate || !checkOutDate || checkOutDate <= checkInDate) {
      setConflictWarning(null);
      return;
    }

    const { data, error } = await supabase
      .from("reservations")
      .select("id")
      .eq("room_id", roomId)
      .in("status", ["booked", "checked_in"])
      .lt("check_in_date", checkOutDate)
      .gt("check_out_date", checkInDate);

    if (!error && data && data.length > 0) {
      setConflictWarning(t.warnings.conflictDetected);
    } else {
      setConflictWarning(null);
    }
  }, [roomId, checkInDate, checkOutDate, t.warnings.conflictDetected]);

  useEffect(() => {
    const timeout = setTimeout(checkAvailability, 300);
    return () => clearTimeout(timeout);
  }, [checkAvailability]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!guestId) {
      newErrors.guestId = t.validation.guestRequired;
    }
    if (!roomId) {
      newErrors.roomId = t.validation.roomRequired;
    }
    if (!selectedRateId) {
      newErrors.rateId = t.validation.occupancyRequired;
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
    const today = new Date().toISOString().split("T")[0];
    if (checkInDate && checkInDate < today) {
      newErrors.checkInDate = t.validation.checkInPast;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      await onSubmit({
        guestId,
        roomId,
        checkInDate,
        checkOutDate,
        roomRateId: selectedRateId,
        basePrice: selectedRate?.price ?? 0,
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

  const noActiveRates = roomId && !loadingRates && availableRates.length === 0;
  const canSubmit = !isSubmitting && !conflictWarning && !noActiveRates && selectedRateId && nights > 0;

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

        {/* Room Select */}
        <div className="space-y-2">
          <Label htmlFor="room">{t.form.roomLabel} *</Label>
          <Select value={roomId} onValueChange={setRoomId}>
            <SelectTrigger
              id="room"
              className={errors.roomId ? "border-destructive" : ""}
            >
              <SelectValue placeholder={t.form.roomPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {rooms.map((room) => (
                <SelectItem key={room.id} value={room.id}>
                  {room.number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.roomId && (
            <p className="text-sm text-destructive">{errors.roomId}</p>
          )}
        </div>

        {/* Occupancy / Rate Select */}
        {roomId && (
          <div className="space-y-2">
            <Label htmlFor="rate">{t.form.occupancyLabel} *</Label>
            {loadingRates ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {es.common.loading}
              </div>
            ) : noActiveRates ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{t.noRatesWarning}</AlertDescription>
              </Alert>
            ) : (
              <Select value={selectedRateId} onValueChange={setSelectedRateId}>
                <SelectTrigger
                  id="rate"
                  className={errors.rateId ? "border-destructive" : ""}
                >
                  <SelectValue placeholder={t.form.occupancyPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {availableRates.map((rate) => (
                    <SelectItem key={rate.id} value={rate.id}>
                      {es.occupancyLabels[rate.occupancy]} - {formatCurrency(rate.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {errors.rateId && (
              <p className="text-sm text-destructive">{errors.rateId}</p>
            )}
          </div>
        )}

        {/* Check-in Date */}
        <div className="space-y-2">
          <Label htmlFor="checkInDate">{t.form.checkInLabel} *</Label>
          <Input
            id="checkInDate"
            type="date"
            min={new Date().toISOString().split("T")[0]}
            value={checkInDate}
            onChange={(e) => setCheckInDate(e.target.value)}
            className={errors.checkInDate ? "border-destructive" : ""}
          />
          {errors.checkInDate && (
            <p className="text-sm text-destructive">{errors.checkInDate}</p>
          )}
        </div>

        {/* Check-out Date */}
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

        {/* Conflict Warning */}
        {conflictWarning && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{conflictWarning}</AlertDescription>
          </Alert>
        )}

        {/* Price Info (shows when rate is selected and dates are valid) */}
        {selectedRate && nights > 0 && !conflictWarning && (
          <div className="rounded-md bg-muted p-3 text-sm space-y-1">
            <p>
              <strong>{t.form.basePriceLabel}:</strong>{" "}
              {formatCurrency(selectedRate.price)} / noche
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
            {isSubmitting ? es.common.saving : es.common.save}
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
