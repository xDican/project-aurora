import { useState } from "react";
import { Check, ChevronsUpDown, Plus, User } from "lucide-react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { type Guest } from "@/hooks/useGuests";
import { type GuestFormData } from "@/components/guests/GuestForm";
import { InlineGuestForm } from "./InlineGuestForm";
import { es } from "@/lib/i18n/es";

interface GuestComboboxProps {
  guests: Guest[];
  selectedGuestId: string;
  onSelect: (guestId: string) => void;
  onCreateGuest: (data: GuestFormData) => Promise<Guest>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isSearching?: boolean;
  error?: string;
}

export function GuestCombobox({
  guests,
  selectedGuestId,
  onSelect,
  onCreateGuest,
  searchQuery,
  onSearchChange,
  isSearching,
  error,
}: GuestComboboxProps) {
  const t = es.guestCombobox;
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedGuest = guests.find((g) => g.id === selectedGuestId);

  const handleCreateGuest = async (data: GuestFormData) => {
    setCreateError(null);
    setIsSaving(true);
    try {
      const newGuest = await onCreateGuest(data);
      onSelect(newGuest.id);
      setIsCreating(false);
      setOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : es.common.unexpectedError;
      setCreateError(message);
    } finally {
      setIsSaving(false);
    }
  };

  // Inline creation view
  if (isCreating) {
    return (
      <div className="border rounded-md p-4 space-y-3 bg-muted/30">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Plus className="h-4 w-4" />
          {t.creatingNew}
        </div>
        <InlineGuestForm
          onSubmit={handleCreateGuest}
          onCancel={() => {
            setIsCreating(false);
            setCreateError(null);
          }}
          isLoading={isSaving}
          error={createError}
        />
      </div>
    );
  }

  // Normal combobox view
  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between font-normal",
              error && "border-destructive",
              !selectedGuestId && "text-muted-foreground"
            )}
          >
            {selectedGuest ? (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>{selectedGuest.name}</span>
              </div>
            ) : (
              t.placeholder
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onValueChange={onSearchChange}
            />
            <CommandList>
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setIsCreating(true);
                    setOpen(false);
                  }}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t.createNew}
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              {isSearching ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {es.common.loading}
                </div>
              ) : guests.length === 0 ? (
                <CommandEmpty>{t.noResults}</CommandEmpty>
              ) : (
                <CommandGroup heading={es.guestsPage.title}>
                  {guests.map((guest) => (
                    <CommandItem
                      key={guest.id}
                      value={guest.id}
                      onSelect={() => {
                        onSelect(guest.id);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedGuestId === guest.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">{guest.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {guest.document && `📄 ${guest.document}`}
                          {guest.document && guest.phone && " • "}
                          {guest.phone && `📞 ${guest.phone}`}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
