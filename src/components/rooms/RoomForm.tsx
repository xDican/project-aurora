import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type Room,
  type RoomStatus,
  ROOM_STATUSES,
  ROOM_TYPES,
} from "@/hooks/useRooms";
import { es } from "@/lib/i18n/es";

interface RoomFormProps {
  room?: Room | null;
  onSubmit: (data: RoomFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export interface RoomFormData {
  number: string;
  type: string;
  base_price: number;
  status: RoomStatus;
  notes: string | null;
}

const { roomsPage, common, statusLabels, roomTypeLabels } = es;

export function RoomForm({ room, onSubmit, onCancel, isLoading, error }: RoomFormProps) {
  const [formData, setFormData] = useState<RoomFormData>({
    number: "",
    type: "single",
    base_price: 0,
    status: "available",
    notes: "",
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (room) {
      setFormData({
        number: room.number,
        type: room.type,
        base_price: room.base_price,
        status: room.status,
        notes: room.notes || "",
      });
    }
  }, [room]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!formData.number.trim()) {
      setValidationError(roomsPage.validation.numberRequired);
      return;
    }
    if (!formData.type.trim()) {
      setValidationError(roomsPage.validation.typeRequired);
      return;
    }
    if (formData.base_price < 0) {
      setValidationError(roomsPage.validation.pricePositive);
      return;
    }

    await onSubmit({
      ...formData,
      notes: formData.notes?.trim() || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {(validationError || error) && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {validationError || error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="number">{roomsPage.form.numberLabel} *</Label>
        <Input
          id="number"
          value={formData.number}
          onChange={(e) => setFormData((prev) => ({ ...prev, number: e.target.value }))}
          placeholder={roomsPage.form.numberPlaceholder}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">{roomsPage.form.typeLabel} *</Label>
        <Select
          value={formData.type}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, type: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder={roomsPage.form.typePlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {ROOM_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {roomTypeLabels[type] || type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="base_price">{roomsPage.form.basePriceLabel} *</Label>
        <Input
          id="base_price"
          type="number"
          min={0}
          step="0.01"
          value={formData.base_price}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, base_price: parseFloat(e.target.value) || 0 }))
          }
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">{roomsPage.form.statusLabel}</Label>
        <Select
          value={formData.status}
          onValueChange={(value: RoomStatus) => setFormData((prev) => ({ ...prev, status: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder={roomsPage.form.statusPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {ROOM_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {statusLabels[status] || status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">{roomsPage.form.notesLabel}</Label>
        <Textarea
          id="notes"
          value={formData.notes || ""}
          onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
          placeholder={roomsPage.form.notesPlaceholder}
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {common.cancel}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? common.saving : common.save}
        </Button>
      </div>
    </form>
  );
}
