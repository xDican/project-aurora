import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Guest } from "@/hooks/useGuests";
import { es } from "@/lib/i18n/es";

interface GuestFormProps {
  guest?: Guest | null;
  onSubmit: (data: GuestFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export interface GuestFormData {
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
}

const { guestsPage, common } = es;

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function GuestForm({ guest, onSubmit, onCancel, isLoading, error }: GuestFormProps) {
  const [formData, setFormData] = useState<GuestFormData>({
    name: "",
    document: "",
    phone: "",
    email: "",
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (guest) {
      setFormData({
        name: guest.name,
        document: guest.document || "",
        phone: guest.phone || "",
        email: guest.email || "",
      });
    }
  }, [guest]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!formData.name.trim()) {
      setValidationError(guestsPage.validation.nameRequired);
      return;
    }

    const emailValue = formData.email?.trim();
    if (emailValue && !emailRegex.test(emailValue)) {
      setValidationError(guestsPage.validation.emailInvalid);
      return;
    }

    await onSubmit({
      name: formData.name.trim(),
      document: formData.document?.trim() || null,
      phone: formData.phone?.trim() || null,
      email: emailValue || null,
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
        <Label htmlFor="name">{guestsPage.form.nameLabel} *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder={guestsPage.form.namePlaceholder}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="document">{guestsPage.form.documentLabel}</Label>
        <Input
          id="document"
          value={formData.document || ""}
          onChange={(e) => setFormData((prev) => ({ ...prev, document: e.target.value }))}
          placeholder={guestsPage.form.documentPlaceholder}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">{guestsPage.form.phoneLabel}</Label>
        <Input
          id="phone"
          type="tel"
          value={formData.phone || ""}
          onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
          placeholder={guestsPage.form.phonePlaceholder}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{guestsPage.form.emailLabel}</Label>
        <Input
          id="email"
          type="email"
          value={formData.email || ""}
          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
          placeholder={guestsPage.form.emailPlaceholder}
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
