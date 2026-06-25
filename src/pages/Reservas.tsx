import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { es } from "@/lib/i18n/es";
import {
  useReservations,
  RESERVATION_STATUSES,
  type NewReservationInput,
  type ReservationListItem,
} from "@/hooks/useReservations";
import { type Guest } from "@/hooks/useGuests";
import { ReservationForm } from "@/components/reservations/ReservationForm";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";

const STATUS_PILL_CLASSES: Record<string, string> = {
  booked: "bg-[#FEF3C7] text-[#92400E]",
  checked_in: "bg-[#DCFCE7] text-[#166534]",
  checked_out: "bg-secondary-container text-on-secondary-container",
  cancelled: "bg-error-container text-on-error-container",
  no_show: "bg-surface-container-highest text-on-surface-variant",
};

export default function Reservas() {
  const t = es.reservationsPage;

  const {
    reservations,
    loading,
    error,
    createReservation,
    updateReservation,
    cancelReservation,
  } = useReservations();

  // We need guests for the form's prop fallback (initialGuest lookup)
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loadingDeps, setLoadingDeps] = useState(true);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<ReservationListItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Load guests for the form
  useEffect(() => {
    async function loadDependencies() {
      setLoadingDeps(true);
      try {
        const guestsRes = await supabase
          .from("guests")
          .select("*")
          .eq("is_active", true)
          .order("name");

        if (guestsRes.data) {
          setGuests(guestsRes.data as unknown as Guest[]);
        }
      } catch (err) {
        console.error("Error loading dependencies:", err);
      } finally {
        setLoadingDeps(false);
      }
    }
    loadDependencies();
  }, []);

  const handleCreate = async (input: NewReservationInput) => {
    try {
      await createReservation(input);
      setIsDialogOpen(false);
      toast.success(t.reservationCreated);
    } catch (err) {
      const message = err instanceof Error ? err.message : es.common.unexpectedError;
      if (message === "ROOM_OVERLAP") {
        toast.error(t.errors.roomOverlap);
      } else if (message === "PAST_CHECKIN") {
        toast.error(t.errors.checkInPast);
      } else {
        toast.error(message);
      }
      // NO cerrar el dialog - usuario debe corregir
    }
  };

  const handleUpdate = async (input: NewReservationInput) => {
    if (!editingReservation) return;
    try {
      await updateReservation(editingReservation.id, input);
      setEditingReservation(null);
      toast.success(t.reservationUpdated);
    } catch (err) {
      const message = err instanceof Error ? err.message : es.common.unexpectedError;
      if (message === "ROOM_OVERLAP") {
        toast.error(t.errors.roomOverlap);
      } else {
        toast.error(message);
      }
      // NO cerrar el dialog - usuario debe corregir
    }
  };

  const handleCancel = async (reservationId: string) => {
    try {
      await cancelReservation(reservationId);
      toast.success(t.cancel.success);
    } catch (err) {
      const message = err instanceof Error ? err.message : t.cancel.error;
      toast.error(message);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const filteredReservations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return reservations.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!query) return true;
      return (
        r.guestName.toLowerCase().includes(query) ||
        r.roomNumber.toLowerCase().includes(query)
      );
    });
  }, [reservations, searchQuery, statusFilter]);

  const isLoading = loading || loadingDeps;

  return (
    <div className="space-y-stack_gap_md">
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar huésped o habitación..."
              className="pl-10 pr-4 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-body-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-64 placeholder:text-outline"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-body-sm text-foreground focus:outline-none focus:border-primary"
          >
            <option value="all">Todos los estados</option>
            {RESERVATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {es.reservationStatusLabels[status]}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t.newReservation}
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded bg-destructive/10 text-destructive text-body-md">{error}</div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          {es.common.loading}
        </div>
      ) : reservations.length === 0 ? (
        <div className="text-center py-12 text-on-surface-variant">
          <p>{t.noReservations}</p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container border-b border-outline-variant">
              <tr>
                <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-md text-on-surface-variant">{t.columns.room}</th>
                <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-md text-on-surface-variant">{t.columns.occupancy}</th>
                <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-md text-on-surface-variant">{t.columns.guest}</th>
                <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-md text-on-surface-variant">{t.columns.checkIn}</th>
                <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-md text-on-surface-variant">{t.columns.checkOut}</th>
                <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-md text-on-surface-variant">{t.columns.status}</th>
                <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-md text-on-surface-variant text-right">{t.columns.finalPrice}</th>
                <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-md text-on-surface-variant text-center">{t.columns.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {filteredReservations.map((reservation) => (
                <tr key={reservation.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-table_cell_padding_x py-table_cell_padding_y text-table-data text-foreground">
                    {reservation.roomNumber || "-"}
                  </td>
                  <td className="px-table_cell_padding_x py-table_cell_padding_y text-body-md text-on-surface-variant">
                    {reservation.occupancy ? es.occupancyLabels[reservation.occupancy] : "-"}
                  </td>
                  <td className="px-table_cell_padding_x py-table_cell_padding_y text-table-data text-foreground">
                    {reservation.guestName || "-"}
                  </td>
                  <td className="px-table_cell_padding_x py-table_cell_padding_y text-body-md text-on-surface-variant">
                    {formatDate(reservation.checkInDate)}
                  </td>
                  <td className="px-table_cell_padding_x py-table_cell_padding_y text-body-md text-on-surface-variant">
                    {formatDate(reservation.checkOutDate)}
                  </td>
                  <td className="px-table_cell_padding_x py-table_cell_padding_y">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-pill text-label-bold ${
                        STATUS_PILL_CLASSES[reservation.status] ?? "bg-surface-variant text-on-surface-variant"
                      }`}
                    >
                      {es.reservationStatusLabels[reservation.status] || reservation.status}
                    </span>
                  </td>
                  <td className="px-table_cell_padding_x py-table_cell_padding_y text-table-data text-foreground text-right">
                    {formatCurrency(reservation.finalPrice)}
                  </td>
                  <td className="px-table_cell_padding_x py-table_cell_padding_y text-center">
                    <div className="flex items-center justify-center gap-2">
                      {(reservation.status === "booked" || reservation.status === "checked_in") && (
                        <button
                          onClick={() => setEditingReservation(reservation)}
                          className="p-1 text-on-surface-variant hover:text-primary transition-colors"
                          title={es.common.edit}
                        >
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                      )}
                      {reservation.status === "booked" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="px-2 py-1 border border-destructive text-destructive rounded text-label-md hover:bg-destructive/10 transition-colors">
                              {t.cancel.button}
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t.cancel.dialogTitle}</AlertDialogTitle>
                              <AlertDialogDescription>{t.cancel.dialogMessage}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t.cancel.back}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleCancel(reservation.id)}>
                                {t.cancel.confirm}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredReservations.length === 0 && (
            <p className="text-center py-8 text-on-surface-variant">{t.noReservations}</p>
          )}
        </div>
      )}

      {/* New Reservation Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t.newReservation}</DialogTitle>
          </DialogHeader>
          <ReservationForm
            guests={guests}
            onSubmit={handleCreate}
            onCancel={() => setIsDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Reservation Dialog */}
      <Dialog
        open={editingReservation !== null}
        onOpenChange={(open) => !open && setEditingReservation(null)}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t.editDialogTitle}</DialogTitle>
          </DialogHeader>
          {editingReservation && (
            <ReservationForm
              guests={guests}
              onSubmit={handleUpdate}
              onCancel={() => setEditingReservation(null)}
              editingReservationId={editingReservation.id}
              reservationStatus={editingReservation.status}
              prefillRoomId={editingReservation.roomId}
              prefillCheckInDate={editingReservation.checkInDate}
              prefillCheckOutDate={editingReservation.checkOutDate}
              initialOccupancy={editingReservation.occupancy}
              initialGuest={
                guests.find((g) => g.id === editingReservation.guestId) ?? {
                  id: editingReservation.guestId,
                  name: editingReservation.guestName,
                  created_at: "",
                }
              }
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
