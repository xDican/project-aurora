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
import { AlertCircle, AlertTriangle } from "lucide-react";
import { es } from "@/lib/i18n/es";
import { type Room } from "@/hooks/useRooms";
import { type Guest } from "@/hooks/useGuests";
import { type NewReservationInput } from "@/hooks/useReservations";
import { supabase } from "@/integrations/supabase/client";

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

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  // Get selected room for displaying price info
  const selectedRoom = rooms.find((r) => r.id === roomId);

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
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : es.common.unexpectedError;
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {submitError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {/* Guest Select */}
      <div className="space-y-2">
        <Label htmlFor="guest">{t.form.guestLabel} *</Label>
        <Select value={guestId} onValueChange={setGuestId}>
          <SelectTrigger
            id="guest"
            className={errors.guestId ? "border-destructive" : ""}
          >
            <SelectValue placeholder={t.form.guestPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {guests.map((guest) => (
              <SelectItem key={guest.id} value={guest.id}>
                {guest.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.guestId && (
          <p className="text-sm text-destructive">{errors.guestId}</p>
        )}
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
                {room.number} - {es.roomTypeLabels[room.type] || room.type} ($
                {room.base_price})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.roomId && (
          <p className="text-sm text-destructive">{errors.roomId}</p>
        )}
      </div>

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

      {/* Price Info (read-only, shows when room is selected) */}
      {selectedRoom && !conflictWarning && (
        <div className="rounded-md bg-muted p-3 text-sm">
          <p>
            <strong>{t.form.basePriceLabel}:</strong> $
            {selectedRoom.base_price.toFixed(2)}
          </p>
          <p>
            <strong>{t.form.finalPriceLabel}:</strong> $
            {selectedRoom.base_price.toFixed(2)}
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
        <Button type="submit" disabled={isSubmitting || !!conflictWarning}>
          {isSubmitting ? es.common.saving : es.common.save}
        </Button>
      </div>
    </form>
  );
}
