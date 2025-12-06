import { useState, useEffect } from "react";
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
import { AlertCircle } from "lucide-react";
import { es } from "@/lib/i18n/es";
import { Room } from "@/hooks/useRooms";
import { Guest } from "@/hooks/useGuests";

export interface ReservationFormData {
  guest_id: string;
  room_id: string;
  check_in_date: string;
  check_out_date: string;
  base_price: number;
  final_price: number;
}

interface ReservationFormProps {
  rooms: Room[];
  guests: Guest[];
  onSubmit: (data: ReservationFormData) => Promise<void>;
  onCancel: () => void;
}

export function ReservationForm({ rooms, guests, onSubmit, onCancel }: ReservationFormProps) {
  const t = es.reservationsPage;

  const [guestId, setGuestId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [basePrice, setBasePrice] = useState<number>(0);
  const [finalPrice, setFinalPrice] = useState<number>(0);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update prices when room is selected
  useEffect(() => {
    if (roomId) {
      const selectedRoom = rooms.find((r) => r.id === roomId);
      if (selectedRoom) {
        setBasePrice(selectedRoom.base_price);
        setFinalPrice(selectedRoom.base_price);
      }
    } else {
      setBasePrice(0);
      setFinalPrice(0);
    }
  }, [roomId, rooms]);

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
        guest_id: guestId,
        room_id: roomId,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        base_price: basePrice,
        final_price: finalPrice,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : es.common.unexpectedError;
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
          <SelectTrigger id="guest" className={errors.guestId ? "border-destructive" : ""}>
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
        {errors.guestId && <p className="text-sm text-destructive">{errors.guestId}</p>}
      </div>

      {/* Room Select */}
      <div className="space-y-2">
        <Label htmlFor="room">{t.form.roomLabel} *</Label>
        <Select value={roomId} onValueChange={setRoomId}>
          <SelectTrigger id="room" className={errors.roomId ? "border-destructive" : ""}>
            <SelectValue placeholder={t.form.roomPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {rooms.map((room) => (
              <SelectItem key={room.id} value={room.id}>
                {room.number} - {es.roomTypeLabels[room.type] || room.type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.roomId && <p className="text-sm text-destructive">{errors.roomId}</p>}
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
        {errors.checkInDate && <p className="text-sm text-destructive">{errors.checkInDate}</p>}
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
        {errors.checkOutDate && <p className="text-sm text-destructive">{errors.checkOutDate}</p>}
      </div>

      {/* Base Price (Read-only) */}
      <div className="space-y-2">
        <Label htmlFor="basePrice">{t.form.basePriceLabel}</Label>
        <Input
          id="basePrice"
          type="number"
          value={basePrice}
          readOnly
          className="bg-muted"
        />
      </div>

      {/* Final Price (Read-only) */}
      <div className="space-y-2">
        <Label htmlFor="finalPrice">{t.form.finalPriceLabel}</Label>
        <Input
          id="finalPrice"
          type="number"
          value={finalPrice}
          readOnly
          className="bg-muted"
        />
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {es.common.cancel}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? es.common.saving : es.common.save}
        </Button>
      </div>
    </form>
  );
}
