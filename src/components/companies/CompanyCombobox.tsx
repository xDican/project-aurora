import { useState } from "react";
import { Check, Plus, Building2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useCompanies, type Company } from "@/hooks/useCompanies";
import { CreateCompanyModal } from "./CreateCompanyModal";
import { es } from "@/lib/i18n/es";

interface CompanyComboboxProps {
  value: string;
  selectedCompany?: Company | null;
  onChange: (companyId: string, company?: Company | null) => void;
  error?: string;
}

export function CompanyCombobox({ value, selectedCompany, onChange, error }: CompanyComboboxProps) {
  const t = es.companyCombobox;
  const { companies, loading, error: searchError, search, setSearch } = useCompanies();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleCompanyCreated = (company: Company) => {
    onChange(company.id, company);
    setSearch("");
  };

  // Selected state: compact single-line chip (same height as a regular input).
  if (value && selectedCompany) {
    return (
      <div className="space-y-1">
        <div
          className={cn(
            "flex h-10 items-center justify-between gap-2 rounded-md border bg-muted/30 pl-3 pr-1",
            error && "border-destructive"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{selectedCompany.name}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 shrink-0"
            onClick={() => {
              onChange("", null);
              setSearch("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  const isTyping = search.trim().length > 0;

  return (
    <div className="space-y-1">
      <Command
        shouldFilter={false}
        className={cn(
          "relative h-10 overflow-visible rounded-md border bg-transparent [&_[cmdk-input-wrapper]]:h-full [&_[cmdk-input-wrapper]]:border-b-0",
          error && "border-destructive"
        )}
      >
        <CommandInput
          className="h-full py-0"
          placeholder={t.searchPlaceholder}
          value={search}
          onValueChange={setSearch}
        />
        {isTyping && (
          <CommandList className="absolute top-full inset-x-0 z-50 mt-1 max-h-64 rounded-md border bg-popover shadow-md">
            <CommandGroup>
              <CommandItem
                onSelect={() => setIsCreateOpen(true)}
                className="text-primary cursor-pointer"
              >
                <Plus className="mr-2 h-4 w-4" />
                {t.createNew}
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />
            {loading ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                {es.common.loading}
              </div>
            ) : searchError ? (
              <div className="py-4 text-center text-sm text-destructive">
                {searchError}
              </div>
            ) : companies.length === 0 ? (
              <CommandEmpty>{t.noResults}</CommandEmpty>
            ) : (
              <CommandGroup heading={es.empresasPage.title}>
                {companies.map((company) => (
                  <CommandItem
                    key={company.id}
                    value={company.id}
                    onSelect={() => onChange(company.id, company)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === company.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{company.name}</span>
                      <span className="text-xs text-muted-foreground">
                        RTN {company.rtn}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        )}
      </Command>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <CreateCompanyModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCompanyCreated={handleCompanyCreated}
      />
    </div>
  );
}
