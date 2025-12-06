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
import type { Tables } from "@/integrations/supabase/types";

type Room = Tables<"rooms">;

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
  status: string;
  notes: string | null;
}

const ROOM_STATUSES = ["available", "occupied", "cleaning", "maintenance"] as const;
const ROOM_TYPES = ["single", "double", "suite", "deluxe"] as const;

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

    // Validation
    if (!formData.number.trim()) {
      setValidationError("Room number is required");
      return;
    }
    if (!formData.type.trim()) {
      setValidationError("Room type is required");
      return;
    }
    if (formData.base_price < 0) {
      setValidationError("Base price must be 0 or greater");
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
        <Label htmlFor="number">Room Number *</Label>
        <Input
          id="number"
          value={formData.number}
          onChange={(e) => setFormData((prev) => ({ ...prev, number: e.target.value }))}
          placeholder="e.g., 101, A-201"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Type *</Label>
        <Select
          value={formData.type}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, type: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {ROOM_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="base_price">Base Price *</Label>
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
        <Label htmlFor="status">Status</Label>
        <Select
          value={formData.status}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            {ROOM_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes || ""}
          onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
          placeholder="Optional notes about this room"
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}
