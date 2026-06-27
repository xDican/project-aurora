import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Company } from "@/hooks/useCompanies";
import { es } from "@/lib/i18n/es";

interface CompanyFormProps {
  company?: Company | null;
  onSubmit: (data: CompanyFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export interface CompanyFormData {
  name: string;
  rtn: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

const { empresasPage, common } = es;

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CompanyForm({ company, onSubmit, onCancel, isLoading, error }: CompanyFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    rtn: "",
    phone: "",
    email: "",
    address: "",
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name,
        rtn: company.rtn || "",
        phone: company.phone || "",
        email: company.email || "",
        address: company.address || "",
      });
    }
  }, [company]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!formData.name.trim()) {
      setValidationError(empresasPage.validation.nameRequired);
      return;
    }

    const rtn = formData.rtn.replace(/\D/g, "");
    if (rtn.length !== 14) {
      setValidationError(empresasPage.validation.rtnInvalid);
      return;
    }

    const emailValue = formData.email?.trim();
    if (emailValue && !emailRegex.test(emailValue)) {
      setValidationError(empresasPage.validation.emailInvalid);
      return;
    }

    await onSubmit({
      name: formData.name.trim(),
      rtn,
      phone: formData.phone?.trim() || null,
      email: emailValue || null,
      address: formData.address?.trim() || null,
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
        <Label htmlFor="company-name">{empresasPage.form.nameLabel} *</Label>
        <Input
          id="company-name"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder={empresasPage.form.namePlaceholder}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="company-rtn">{empresasPage.form.rtnLabel} *</Label>
        <Input
          id="company-rtn"
          inputMode="numeric"
          value={formData.rtn}
          onChange={(e) => setFormData((prev) => ({ ...prev, rtn: e.target.value }))}
          placeholder={empresasPage.form.rtnPlaceholder}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="company-phone">{empresasPage.form.phoneLabel}</Label>
        <Input
          id="company-phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
          placeholder={empresasPage.form.phonePlaceholder}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="company-email">{empresasPage.form.emailLabel}</Label>
        <Input
          id="company-email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
          placeholder={empresasPage.form.emailPlaceholder}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="company-address">{empresasPage.form.addressLabel}</Label>
        <Input
          id="company-address"
          value={formData.address}
          onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
          placeholder={empresasPage.form.addressPlaceholder}
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
