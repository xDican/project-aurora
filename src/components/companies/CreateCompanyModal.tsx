import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CompanyForm, type CompanyFormData } from "./CompanyForm";
import { type Company } from "@/hooks/useCompanies";
import { supabase } from "@/integrations/supabase/client";
import { es } from "@/lib/i18n/es";

interface CreateCompanyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompanyCreated: (company: Company) => void;
}

export function CreateCompanyModal({
  open,
  onOpenChange,
  onCompanyCreated,
}: CreateCompanyModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: CompanyFormData) => {
    setError(null);
    setIsLoading(true);

    try {
      const { data: newCompany, error: insertError } = await supabase
        .from("companies")
        .insert({
          name: data.name,
          rtn: data.rtn,
          phone: data.phone,
          email: data.email,
          address: data.address,
        })
        .select()
        .single();

      if (insertError) {
        const msg = insertError.message;
        if (msg.includes("companies_rtn_active_unique") || msg.includes("duplicate key")) {
          throw new Error(es.empresasPage.validation.rtnTaken);
        }
        if (msg.includes("companies_rtn_digits") || msg.includes("violates check constraint")) {
          throw new Error(es.empresasPage.validation.rtnInvalid);
        }
        throw new Error(msg);
      }

      onCompanyCreated(newCompany as Company);
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
          <DialogTitle>{es.companyCombobox.creatingNew}</DialogTitle>
        </DialogHeader>
        <CompanyForm
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isLoading={isLoading}
          error={error}
        />
      </DialogContent>
    </Dialog>
  );
}
