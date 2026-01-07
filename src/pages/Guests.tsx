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
import { Pencil, Plus, Loader2, Search, Archive } from "lucide-react";
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
                {guests.map((guest) => {
                  const canEdit = canEditGuest(guest);
                  
                  return (
                    <TableRow key={guest.id}>
                      <TableCell className="font-medium">{guest.name}</TableCell>
                      <TableCell>{displayValue(guest.document)}</TableCell>
                      <TableCell>{displayValue(guest.phone)}</TableCell>
                      <TableCell>{displayValue(guest.email)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {canEdit ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(guest)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ) : (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="sm" disabled>
                                    <Pencil className="h-4 w-4 text-muted-foreground" />
                                  </Button>
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
                                <Button variant="ghost" size="sm">
                                  <Archive className="h-4 w-4" />
                                </Button>
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
                      </TableCell>
                    </TableRow>
                  );
                })}
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
