import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "@/hooks/useRooms";
import { type OccupancyType } from "@/hooks/useRoomRates";
import { es } from "@/lib/i18n/es";

interface RoomFormProps {
  room?: Room | null;
  onSubmit: (data: RoomFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string | null;
  initialRates?: RateConfig[];
}

export interface RateConfig {
  occupancy: OccupancyType;
  enabled: boolean;
  price: number;
}

export interface RoomFormData {
  number: string;
  status: RoomStatus;
  notes: string | null;
  rates: RateConfig[];
}

const { roomsPage, common, statusLabels, occupancyLabels } = es;

const OCCUPANCY_OPTIONS: OccupancyType[] = ["sencilla", "doble", "triple"];

export function RoomForm({ room, onSubmit, onCancel, isLoading, error, initialRates }: RoomFormProps) {
  const [formData, setFormData] = useState<RoomFormData>({
    number: "",
    status: "available",
    notes: "",
    rates: OCCUPANCY_OPTIONS.map((occ) => ({
      occupancy: occ,
      enabled: false,
      price: 0,
    })),
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (room) {
      // Editing existing room - load initial rates if provided
      const ratesMap = new Map(initialRates?.map((r) => [r.occupancy, r]));
      
      setFormData({
        number: room.number,
        status: room.status,
        notes: room.notes || "",
        rates: OCCUPANCY_OPTIONS.map((occ) => {
          const existingRate = ratesMap.get(occ);
          return {
            occupancy: occ,
            enabled: existingRate?.enabled ?? false,
            price: existingRate?.price ?? 0,
          };
        }),
      });
    }
  }, [room, initialRates]);

  const handleRateToggle = (occupancy: OccupancyType, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      rates: prev.rates.map((r) =>
        r.occupancy === occupancy ? { ...r, enabled: checked } : r
      ),
    }));
  };

  const handleRatePrice = (occupancy: OccupancyType, value: string) => {
    const price = parseFloat(value) || 0;
    setFormData((prev) => ({
      ...prev,
      rates: prev.rates.map((r) =>
        r.occupancy === occupancy ? { ...r, price } : r
      ),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!formData.number.trim()) {
      setValidationError(roomsPage.validation.numberRequired);
      return;
    }

    // Check at least one rate is enabled with price > 0
    const enabledRates = formData.rates.filter((r) => r.enabled);
    if (enabledRates.length === 0) {
      setValidationError(roomsPage.validation.atLeastOneRate);
      return;
    }

    const invalidRate = enabledRates.find((r) => r.price <= 0);
    if (invalidRate) {
      setValidationError(roomsPage.validation.ratePriceRequired);
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
          rows={2}
        />
      </div>

      {/* Rates Configuration Section */}
      <div className="border-t pt-4 mt-4">
        <Label className="text-sm font-medium mb-3 block">
          {roomsPage.form.ratesSection} *
        </Label>
        <div className="space-y-3">
          {formData.rates.map((rate) => (
            <div key={rate.occupancy} className="flex items-center gap-3">
              <Checkbox
                id={`rate-${rate.occupancy}`}
                checked={rate.enabled}
                onCheckedChange={(checked) => handleRateToggle(rate.occupancy, !!checked)}
              />
              <Label
                htmlFor={`rate-${rate.occupancy}`}
                className="w-20 cursor-pointer"
              >
                {occupancyLabels[rate.occupancy]}
              </Label>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Precio"
                  value={rate.price || ""}
                  onChange={(e) => handleRatePrice(rate.occupancy, e.target.value)}
                  disabled={!rate.enabled}
                  className="w-28"
                />
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {roomsPage.form.ratesHint}
        </p>
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
