import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { es } from "@/lib/i18n/es";
import { formatCurrency } from "@/lib/currency";
import { useAuth } from "@/contexts/AuthContext";
import { useSalonReservations, type SalonReservationListItem, type NewSalonReservationInput } from "@/hooks/useSalonReservations";
import { useSalonSlots } from "@/hooks/useSalonSlots";
import { useSalonMenus } from "@/hooks/useSalonMenus";
import { useSalonConfig } from "@/hooks/useSalonConfig";
import { useSalonSpaces } from "@/hooks/useSalonSpaces";
import { useSalonResources } from "@/hooks/useSalonResources";
import { SalonReservationForm } from "@/components/salon/SalonReservationForm";
import { SalonConfigPanel } from "@/components/salon/SalonConfigPanel";
import { SalonAvailabilityCalendar } from "@/components/salon/SalonAvailabilityCalendar";

const t = es.salonPage;

const STATUS_PILL: Record<string, string> = {
  booked:    "bg-[#FEF3C7] text-[#92400E]",
  done:      "bg-[#DCFCE7] text-[#166534]",
  cancelled: "bg-surface-container-highest text-on-surface-variant",
};

function formatDateRange(start: string, end: string) {
  const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

export default function Salon() {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const { reservations, loading, error, createReservation, updateReservation, cancelReservation, markDone } = useSalonReservations();
  const { spaces } = useSalonSpaces(true);
  const { slots } = useSalonSlots(undefined, true);
  const { menus } = useSalonMenus(true);
  const { resources } = useSalonResources(true);
  const { config } = useSalonConfig();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<SalonReservationListItem | null>(null);

  const closeSheet = () => { setSheetOpen(false); setEditingReservation(null); };

  const handleCreate = async (input: NewSalonReservationInput) => {
    await createReservation(input);
    closeSheet();
    toast.success(t.reservationCreated);
  };

  const handleUpdate = async (input: NewSalonReservationInput) => {
    if (!editingReservation) return;
    await updateReservation(editingReservation.id, input);
    closeSheet();
    toast.success(t.reservationUpdated);
  };

  const handleCancel = async (id: string) => {
    try { await cancelReservation(id); toast.success(t.cancel.success); }
    catch { toast.error(t.cancel.error); }
  };

  const handleMarkDone = async (id: string) => {
    try { await markDone(id); toast.success("Reserva completada"); }
    catch { toast.error(es.common.unexpectedError); }
  };

  const isSheetOpen = sheetOpen || editingReservation !== null;

  return (
    <div className="space-y-stack_gap_md">
      <div className="flex justify-end">
        <Button onClick={() => setSheetOpen(true)} className="gap-2">
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t.newReservation}
        </Button>
      </div>

      {error && <div className="p-4 rounded bg-destructive/10 text-destructive text-body-md">{error}</div>}

      <Tabs defaultValue="reservations">
        <TabsList className="mb-4">
          <TabsTrigger value="reservations">Reservas de Salón</TabsTrigger>
          <TabsTrigger value="availability">{t.availability.tab}</TabsTrigger>
          {isAdmin && <TabsTrigger value="config">Configuración</TabsTrigger>}
        </TabsList>

        <TabsContent value="reservations">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />{es.common.loading}
            </div>
          ) : reservations.length === 0 ? (
            <div className="text-center py-12 text-on-surface-variant">
              <span className="material-symbols-outlined text-5xl block mb-3">event_busy</span>
              <p>{t.noReservations}</p>
            </div>
          ) : (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container border-b border-outline-variant">
                  <tr>
                    {[t.columns.guest, t.columns.space, t.columns.slot, t.columns.dates, t.columns.days, t.columns.attendees, t.columns.status, t.columns.price, t.columns.actions].map((h) => (
                      <th key={h} className="px-table_cell_padding_x py-table_cell_padding_y text-label-md text-on-surface-variant">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {reservations.map((r) => (
                    <tr key={r.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-table-data text-foreground">{r.guestName || "—"}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-table-data text-foreground">{r.spaceName || "—"}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-body-md text-on-surface-variant">{r.slotName || "—"}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-body-md text-on-surface-variant">{formatDateRange(r.startDate, r.endDate)}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-body-md text-on-surface-variant">{r.numDays}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-body-md text-on-surface-variant">{r.attendees ?? "—"}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y">
                        <span className={`inline-flex items-center px-2 py-1 rounded-pill text-label-bold ${STATUS_PILL[r.status] ?? "bg-surface-variant text-on-surface-variant"}`}>
                          {es.salonReservationStatusLabels[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y text-table-data text-foreground">{formatCurrency(r.finalPrice)}</td>
                      <td className="px-table_cell_padding_x py-table_cell_padding_y">
                        {r.status === "booked" && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => setEditingReservation(r)} className="p-1 text-on-surface-variant hover:text-primary transition-colors" title={es.common.edit}>
                              <span className="material-symbols-outlined text-[20px]">edit</span>
                            </button>
                            <button onClick={() => handleMarkDone(r.id)} className="p-1 text-on-surface-variant hover:text-[#166534] transition-colors" title="Completar">
                              <span className="material-symbols-outlined text-[20px]">check_circle</span>
                            </button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button className="p-1 text-on-surface-variant hover:text-destructive transition-colors" title={t.cancel.button}>
                                  <span className="material-symbols-outlined text-[20px]">cancel</span>
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t.cancel.dialogTitle}</AlertDialogTitle>
                                  <AlertDialogDescription>{t.cancel.dialogMessage}</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t.cancel.back}</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleCancel(r.id)}>{t.cancel.confirm}</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="availability">
          <SalonAvailabilityCalendar spaces={spaces} slots={slots} reservations={reservations} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="config">
            <SalonConfigPanel />
          </TabsContent>
        )}
      </Tabs>

      <Sheet open={isSheetOpen} onOpenChange={(v) => !v && closeSheet()}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>{editingReservation ? t.editDialogTitle : t.newReservation}</SheetTitle>
          </SheetHeader>
          <SalonReservationForm
            spaces={spaces}
            slots={slots}
            menus={menus}
            resources={resources}
            config={config}
            onSubmit={editingReservation ? handleUpdate : handleCreate}
            onCancel={closeSheet}
            isAdmin={isAdmin}
            editingId={editingReservation?.id}
            initialValues={editingReservation ? {
              guestId: editingReservation.guestId,
              initialGuest: { id: editingReservation.guestId, name: editingReservation.guestName, created_at: "" },
              spaceId: editingReservation.spaceId,
              slotId: editingReservation.slotId,
              startDate: editingReservation.startDate,
              endDate: editingReservation.endDate,
              attendees: editingReservation.attendees,
              resources: editingReservation.resources.map((r) => ({ resourceId: r.resourceId, quantityRequested: r.quantityRequested })),
              menuId: editingReservation.menuId,
              coffeeStation: editingReservation.coffeeStation,
              coffeeCookies: editingReservation.coffeeCookies,
              notes: editingReservation.notes,
            } : undefined}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
