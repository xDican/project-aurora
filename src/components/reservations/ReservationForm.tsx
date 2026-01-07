import { useState, useEffect, useCallback } from "react";
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
import { type Guest } from "@/hooks/useGuests";
import { type NewReservationInput } from "@/hooks/useReservations";
import { supabase } from "@/integrations/supabase/client";
import { type RoomRate } from "@/hooks/useRoomRates";
import { GuestCombobox } from "./GuestCombobox";
import { type GuestFormData } from "@/components/guests/GuestForm";

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

  // Guest search state
  const [guestSearchQuery, setGuestSearchQuery] = useState("");
  const [filteredGuests, setFilteredGuests] = useState<Guest[]>(guests);
  const [isSearchingGuests, setIsSearchingGuests] = useState(false);

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

  // Search guests with debounce
  useEffect(() => {
    if (!guestSearchQuery.trim()) {
      setFilteredGuests(guests);
      setIsSearchingGuests(false);
      return;
    }

    setIsSearchingGuests(true);
    const timeout = setTimeout(async () => {
      const query = guestSearchQuery.trim();
      const { data } = await supabase
        .from("guests")
        .select("*")
        .eq("is_active", true)
        .or(`name.ilike.%${query}%,document.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(20);

      setFilteredGuests((data as Guest[]) || []);
      setIsSearchingGuests(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [guestSearchQuery, guests]);

  // Handler for inline guest creation
  const handleCreateGuestInline = async (data: GuestFormData): Promise<Guest> => {
    const { data: newGuest, error } = await supabase
      .from("guests")
      .insert({
        name: data.name,
        document: data.document,
        phone: data.phone,
        email: data.email,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Add to filtered guests so it shows immediately
    setFilteredGuests((prev) => [newGuest as Guest, ...prev]);
    return newGuest as Guest;
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
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : es.common.unexpectedError;
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const noActiveRates = roomId && !loadingRates && availableRates.length === 0;
  const canSubmit = !isSubmitting && !conflictWarning && !noActiveRates && selectedRateId;

  return (
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
          guests={filteredGuests}
          selectedGuestId={guestId}
          onSelect={setGuestId}
          onCreateGuest={handleCreateGuestInline}
          searchQuery={guestSearchQuery}
          onSearchChange={setGuestSearchQuery}
          isSearching={isSearchingGuests}
          error={errors.guestId}
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
                    {es.occupancyLabels[rate.occupancy]} - ${rate.price.toFixed(2)}
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

      {/* Price Info (shows when rate is selected) */}
      {selectedRate && !conflictWarning && (
        <div className="rounded-md bg-muted p-3 text-sm">
          <p>
            <strong>{t.form.basePriceLabel}:</strong> $
            {selectedRate.price.toFixed(2)}
          </p>
          <p>
            <strong>{t.form.finalPriceLabel}:</strong> $
            {selectedRate.price.toFixed(2)}
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
  );
}
