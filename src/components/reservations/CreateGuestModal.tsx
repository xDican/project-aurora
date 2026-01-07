import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineGuestForm } from "./InlineGuestForm";
import { type Guest } from "@/hooks/useGuests";
import { type GuestFormData } from "@/components/guests/GuestForm";
import { supabase } from "@/integrations/supabase/client";
import { es } from "@/lib/i18n/es";

interface CreateGuestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGuestCreated: (guest: Guest) => void;
}

export function CreateGuestModal({
  open,
  onOpenChange,
  onGuestCreated,
}: CreateGuestModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: GuestFormData) => {
    setError(null);
    setIsLoading(true);

    try {
      const { data: newGuest, error: insertError } = await supabase
        .from("guests")
        .insert({
          name: data.name,
          document: data.document,
          phone: data.phone,
          email: data.email,
        })
        .select()
        .single();

      if (insertError) throw new Error(insertError.message);

      onGuestCreated(newGuest as Guest);
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : es.common.unexpectedError;
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setError(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{es.guestCombobox.creatingNew}</DialogTitle>
        </DialogHeader>
        <InlineGuestForm
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isLoading={isLoading}
          error={error}
        />
      </DialogContent>
    </Dialog>
  );
}
