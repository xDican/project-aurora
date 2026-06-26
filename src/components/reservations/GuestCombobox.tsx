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

  // If a guest is selected, show a compact single-line field (same height as a
  // regular input) with their name and a clear button.
  if (selectedGuestId && selectedGuest) {
    return (
      <div className="space-y-1">
        <div
          className={cn(
            "flex h-10 items-center justify-between gap-2 rounded-md border bg-muted/30 pl-3 pr-1",
            error && "border-destructive"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <User className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{selectedGuest.name}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 shrink-0"
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

  // Show search input directly. The results panel only appears while typing and
  // floats over the elements below (absolute) so it doesn't push the layout down.
  const isTyping = searchQuery.trim().length > 0;

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
          value={searchQuery}
          onValueChange={onSearchChange}
        />
        {isTyping && (
          <CommandList className="absolute top-full inset-x-0 z-50 mt-1 max-h-64 rounded-md border bg-popover shadow-md">
            <CommandGroup>
              <CommandItem
                onSelect={onOpenCreateModal}
                className="text-primary cursor-pointer"
              >
                <Plus className="mr-2 h-4 w-4" />
                {t.createNew}
              </CommandItem>
            </CommandGroup>

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
          </CommandList>
        )}
      </Command>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
