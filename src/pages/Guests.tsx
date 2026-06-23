import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GuestForm, type GuestFormData } from "@/components/guests/GuestForm";
import { toast } from "sonner";
import { useGuests, type Guest } from "@/hooks/useGuests";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { es } from "@/lib/i18n/es";

const { guestsPage, common } = es;

// 15 minutes in milliseconds
const EDIT_WINDOW_MS = 15 * 60 * 1000;

export default function Guests() {
  const {
    guests,
    loading,
    error,
    search,
    setSearch,
    createGuest,
    updateGuest,
    archiveGuest,
  } = useGuests();
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Check if user can edit a guest based on role and creation time
  const canEditGuest = (guest: Guest): boolean => {
    if (isAdmin) return true;
    
    const createdAt = new Date(guest.created_at).getTime();
    const now = Date.now();
    return (now - createdAt) <= EDIT_WINDOW_MS;
  };

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
      const errorMessage = err instanceof Error ? err.message : common.unexpectedError;
      
      if (errorMessage === "EDIT_WINDOW_EXPIRED") {
        setFormError(guestsPage.editWindowExpired);
      } else if (errorMessage === "NOT_ALLOWED") {
        setFormError(guestsPage.notAllowed);
      } else {
        setFormError(errorMessage);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (guestId: string) => {
    try {
      await archiveGuest(guestId);
      toast.success(guestsPage.archive.success);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === "HAS_ACTIVE_RESERVATIONS") {
          toast.error(guestsPage.archive.hasActiveReservations);
        } else if (err.message === "NOT_ALLOWED") {
          toast.error(guestsPage.archive.notAllowed);
        } else {
          toast.error(guestsPage.archive.error);
        }
      } else {
        toast.error(guestsPage.archive.error);
      }
    }
  };

  const displayValue = (value: string | null | undefined) => value || "—";

  // Show error toast if there's a fetch error
  if (error) {
    toast.error(error);
  }

  return (
    <div className="space-y-stack_gap_md">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-headline-md text-foreground font-bold">{guestsPage.title}</h2>
        <Button onClick={openCreateModal} className="gap-2">
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          {guestsPage.addGuest}
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
          search
        </span>
        <Input
          placeholder={guestsPage.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          {es.common.loading}
        </div>
      ) : guests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-outline-variant p-12 text-center">
          <p className="text-on-surface-variant">
            {search ? `No se encontraron resultados para "${search}"` : guestsPage.noGuests}
          </p>
          {!search && (
            <Button onClick={openCreateModal} variant="outline" className="mt-4 gap-2">
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              {guestsPage.addFirstGuest}
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
                <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant">{guestsPage.columns.name}</th>
                <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant">{guestsPage.columns.document}</th>
                <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant">{guestsPage.columns.phone}</th>
                <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant">{guestsPage.columns.email}</th>
                <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant text-right">{common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {guests.map((guest) => {
                const canEdit = canEditGuest(guest);

                return (
                  <tr key={guest.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-table_cell_padding_x py-table_cell_padding_y text-table-data text-foreground font-medium">
                      {guest.name}
                    </td>
                    <td className="px-table_cell_padding_x py-table_cell_padding_y text-body-sm text-on-surface-variant">
                      {displayValue(guest.document)}
                    </td>
                    <td className="px-table_cell_padding_x py-table_cell_padding_y text-body-sm text-on-surface-variant">
                      {displayValue(guest.phone)}
                    </td>
                    <td className="px-table_cell_padding_x py-table_cell_padding_y text-body-sm text-on-surface-variant">
                      {displayValue(guest.email)}
                    </td>
                    <td className="px-table_cell_padding_x py-table_cell_padding_y text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit ? (
                          <button
                            onClick={() => openEditModal(guest)}
                            title={es.common.edit}
                            className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-primary-container/20 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[20px]">edit</span>
                          </button>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button disabled className="p-1 rounded text-outline-variant cursor-not-allowed">
                                  <span className="material-symbols-outlined text-[20px]">edit</span>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {guestsPage.editDisabledTooltip}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}

                        {isAdmin && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                title={common.actions}
                                className="p-1 rounded text-on-surface-variant hover:text-destructive hover:bg-error-container/20 transition-colors"
                              >
                                <span className="material-symbols-outlined text-[20px]">archive</span>
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {guestsPage.archive.dialogTitle}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {guestsPage.archive.dialogMessage}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>
                                  {guestsPage.archive.back}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleArchive(guest.id)}
                                >
                                  {guestsPage.archive.confirm}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
  );
}
