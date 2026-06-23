import { Check, Plus, User, X } from "lucide-react";
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
import { type Guest } from "@/hooks/useGuests";
import { es } from "@/lib/i18n/es";

interface GuestComboboxProps {
  guests: Guest[];
  selectedGuestId: string;
  selectedGuest?: Guest | null;
  onSelect: (guestId: string) => void;
  onOpenCreateModal: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isSearching?: boolean;
  error?: string;
  searchError?: string;
}

export function GuestCombobox({
  guests,
  selectedGuestId,
  selectedGuest,
  onSelect,
  onOpenCreateModal,
  searchQuery,
  onSearchChange,
  isSearching,
  error,
  searchError,
}: GuestComboboxProps) {
  const t = es.guestCombobox;

  // If a guest is selected, show a chip with their name
  if (selectedGuestId && selectedGuest) {
    return (
      <div className="space-y-1">
        <div
          className={cn(
            "flex items-center justify-between gap-2 p-3 border rounded-md bg-muted/30",
            error && "border-destructive"
          )}
        >
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="font-medium">{selectedGuest.name}</span>
              <span className="text-xs text-muted-foreground">
                {selectedGuest.document && `📄 ${selectedGuest.document}`}
                {selectedGuest.document && selectedGuest.phone && " • "}
                {selectedGuest.phone && `📞 ${selectedGuest.phone}`}
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => {
              onSelect("");
              onSearchChange("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  // Show search input directly
  return (
    <div className="space-y-1">
      <div
        className={cn(
          "border rounded-md",
          error && "border-destructive"
        )}
      >
        <Command shouldFilter={false} className="rounded-md">
          <CommandInput
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onValueChange={onSearchChange}
          />
          <CommandList>
            <CommandGroup>
              <CommandItem
                onSelect={onOpenCreateModal}
                className="text-primary cursor-pointer"
              >
                <Plus className="mr-2 h-4 w-4" />
                {t.createNew}
              </CommandItem>
            </CommandGroup>

            {/* Only show results when there's a search query */}
            {searchQuery.trim().length > 0 && (
              <>
                <CommandSeparator />
                {isSearching ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    {es.common.loading}
                  </div>
                ) : searchError ? (
                  <div className="py-4 text-center text-sm text-destructive">
                    {searchError}
                  </div>
                ) : guests.length === 0 ? (
                  <CommandEmpty>{t.noResults}</CommandEmpty>
                ) : (
                  <CommandGroup heading={es.guestsPage.title}>
                    {guests.map((guest) => (
                      <CommandItem
                        key={guest.id}
                        value={guest.id}
                        onSelect={() => onSelect(guest.id)}
                        className="cursor-pointer"
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
              </>
            )}
          </CommandList>
        </Command>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
