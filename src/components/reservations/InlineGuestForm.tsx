import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { type GuestFormData } from "@/components/guests/GuestForm";
import { es } from "@/lib/i18n/es";

interface InlineGuestFormProps {
  onSubmit: (data: GuestFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export function InlineGuestForm({
  onSubmit,
  onCancel,
  isLoading,
  error,
}: InlineGuestFormProps) {
  const t = es.guestsPage;
  const tCombobox = es.guestCombobox;

  const [formData, setFormData] = useState({
    name: "",
    document: "",
    phone: "",
    email: "",
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!formData.name.trim()) {
      setValidationError(t.validation.nameRequired);
      return;
    }

    // Email validation if provided
    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        setValidationError(t.validation.emailInvalid);
        return;
      }
    }

    await onSubmit({
      name: formData.name.trim(),
      document: formData.document.trim() || null,
      phone: formData.phone.trim() || null,
      email: formData.email.trim() || null,
    });
  };

  const displayError = validationError || error;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Name - full width */}
      <div className="space-y-1">
        <Label htmlFor="inline-name" className="text-xs">
          {t.form.nameLabel} *
        </Label>
        <Input
          id="inline-name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder={t.form.namePlaceholder}
          className="h-9"
        />
      </div>

      {/* Document & Phone - side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="inline-document" className="text-xs">
            {t.form.documentLabel}
          </Label>
          <Input
            id="inline-document"
            value={formData.document}
            onChange={(e) => setFormData({ ...formData, document: e.target.value })}
            placeholder={t.form.documentPlaceholder}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="inline-phone" className="text-xs">
            {t.form.phoneLabel}
          </Label>
          <Input
            id="inline-phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder={t.form.phonePlaceholder}
            className="h-9"
          />
        </div>
      </div>

      {/* Email - full width */}
      <div className="space-y-1">
        <Label htmlFor="inline-email" className="text-xs">
          {t.form.emailLabel}
        </Label>
        <Input
          id="inline-email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder={t.form.emailPlaceholder}
          className="h-9"
        />
      </div>

      {/* Error display */}
      {displayError && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">{displayError}</AlertDescription>
        </Alert>
      )}

      {/* Buttons */}
      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isLoading}
        >
          {es.common.cancel}
        </Button>
        <Button type="submit" size="sm" disabled={isLoading}>
          {isLoading ? es.common.saving : tCombobox.saveGuest}
        </Button>
      </div>
    </form>
  );
}
