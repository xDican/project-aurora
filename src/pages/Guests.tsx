import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GuestForm, type GuestFormData } from "@/components/guests/GuestForm";
import { toast } from "sonner";
import { useGuests, type Guest } from "@/hooks/useGuests";
import { Pencil, Plus, Loader2, Search } from "lucide-react";
import { es } from "@/lib/i18n/es";

const { guestsPage, common } = es;

export default function Guests() {
  const {
    guests,
    loading,
    error,
    search,
    setSearch,
    createGuest,
    updateGuest,
  } = useGuests();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingGuest(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (guest: Guest) => {
    setEditingGuest(guest);
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingGuest(null);
    setFormError(null);
  };

  const handleSubmit = async (data: GuestFormData) => {
    setIsSaving(true);
    setFormError(null);

    try {
      if (editingGuest) {
        await updateGuest(editingGuest.id, data);
        toast.success(guestsPage.guestUpdated);
      } else {
        await createGuest(data);
        toast.success(guestsPage.guestCreated);
      }
      closeModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : common.unexpectedError;
      setFormError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const displayValue = (value: string | null | undefined) => value || "—";

  // Show error toast if there's a fetch error
  if (error) {
    toast.error(error);
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-foreground">{guestsPage.title}</h1>
          <Button onClick={openCreateModal}>
            <Plus className="mr-2 h-4 w-4" />
            {guestsPage.addGuest}
          </Button>
        </header>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={guestsPage.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : guests.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="text-muted-foreground">
              {search ? `No se encontraron resultados para "${search}"` : guestsPage.noGuests}
            </p>
            {!search && (
              <Button onClick={openCreateModal} variant="outline" className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                {guestsPage.addFirstGuest}
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{guestsPage.columns.name}</TableHead>
                  <TableHead>{guestsPage.columns.document}</TableHead>
                  <TableHead>{guestsPage.columns.phone}</TableHead>
                  <TableHead>{guestsPage.columns.email}</TableHead>
                  <TableHead className="w-[80px]">{common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guests.map((guest) => (
                  <TableRow key={guest.id}>
                    <TableCell className="font-medium">{guest.name}</TableCell>
                    <TableCell>{displayValue(guest.document)}</TableCell>
                    <TableCell>{displayValue(guest.phone)}</TableCell>
                    <TableCell>{displayValue(guest.email)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(guest)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingGuest ? guestsPage.editGuest : guestsPage.newGuest}
              </DialogTitle>
            </DialogHeader>
            <GuestForm
              guest={editingGuest}
              onSubmit={handleSubmit}
              onCancel={closeModal}
              isLoading={isSaving}
              error={formError}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
