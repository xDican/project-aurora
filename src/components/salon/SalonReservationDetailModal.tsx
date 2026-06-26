import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { es } from "@/lib/i18n/es";
import { formatCurrency } from "@/lib/currency";
import type { SalonReservationListItem } from "@/hooks/useSalonReservations";

const t = es.salonPage;
const td = es.salonPage.detail;

const STATUS_PILL: Record<string, string> = {
  booked:    "bg-[#FEF3C7] text-[#92400E]",
  done:      "bg-[#DCFCE7] text-[#166534]",
  cancelled: "bg-surface-container-highest text-on-surface-variant",
};

function formatDateRange(start: string, end: string) {
  const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

interface SalonReservationDetailModalProps {
  reservation: SalonReservationListItem | null;
  onClose: () => void;
  onEdit: (reservation: SalonReservationListItem) => void;
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
}

export function SalonReservationDetailModal({
  reservation, onClose, onEdit, onComplete, onCancel,
}: SalonReservationDetailModalProps) {
  if (!reservation) return null;
  const r = reservation;

  const equipmentCost = r.resources.reduce((sum, res) => sum + res.unitPrice * res.quantityRequested, 0);
  const cateringCost = Math.max(r.addonsPrice - equipmentCost, 0);

  const equipmentText = r.resources.length > 0
    ? r.resources.map((res) => res.quantityRequested > 1 ? `${res.resourceName} ×${res.quantityRequested}` : res.resourceName).join(", ")
    : td.none;

  const cateringParts: string[] = [];
  if (r.menuName) cateringParts.push(r.menuName);
  if (r.coffeeStation) cateringParts.push(td.coffeeStation);
  if (r.coffeeCookies) cateringParts.push(td.cookies);
  const cateringText = cateringParts.length > 0 ? cateringParts.join(", ") : td.none;

  const canManage = r.status === "booked";

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[480px] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="truncate">{r.guestName || td.title}</span>
            <span className={`inline-flex items-center px-2 py-1 rounded-pill text-label-bold shrink-0 ${STATUS_PILL[r.status] ?? "bg-surface-variant text-on-surface-variant"}`}>
              {es.salonReservationStatusLabels[r.status] ?? r.status}
            </span>
          </DialogTitle>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-body-md">
          <div>
            <dt className="text-label-md uppercase text-on-surface-variant">{td.space}</dt>
            <dd className="text-foreground">{r.spaceName || "—"}</dd>
          </div>
          <div>
            <dt className="text-label-md uppercase text-on-surface-variant">{td.date}</dt>
            <dd className="text-foreground">{formatDateRange(r.startDate, r.endDate)}</dd>
          </div>
          <div>
            <dt className="text-label-md uppercase text-on-surface-variant">{td.slot}</dt>
            <dd className="text-foreground">{r.slotName || "—"}</dd>
          </div>
          <div>
            <dt className="text-label-md uppercase text-on-surface-variant">{td.attendees}</dt>
            <dd className="text-foreground">{r.attendees ?? "—"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-label-md uppercase text-on-surface-variant">{td.equipment}</dt>
            <dd className="text-foreground">{equipmentText}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-label-md uppercase text-on-surface-variant">{td.catering}</dt>
            <dd className="text-foreground">{cateringText}</dd>
          </div>
        </dl>

        <div className="rounded-lg bg-surface-container-low p-3 space-y-1 text-body-md">
          <p className="text-label-md uppercase text-on-surface-variant pb-1">{td.costsTitle}</p>
          <div className="flex justify-between text-on-surface-variant"><span>{td.base}</span><span>{formatCurrency(r.basePrice)}</span></div>
          {equipmentCost > 0 && <div className="flex justify-between text-on-surface-variant"><span>{td.equipmentCost}</span><span>{formatCurrency(equipmentCost)}</span></div>}
          {cateringCost > 0 && <div className="flex justify-between text-on-surface-variant"><span>{td.cateringCost}</span><span>{formatCurrency(cateringCost)}</span></div>}
          <div className="flex justify-between font-semibold pt-1 border-t border-outline-variant">
            <span>{td.total}</span><span className="text-primary">{formatCurrency(r.finalPrice)}</span>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center justify-between gap-2 pt-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 px-2">{td.cancel}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t.cancel.dialogTitle}</AlertDialogTitle>
                  <AlertDialogDescription>{t.cancel.dialogMessage}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t.cancel.back}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onCancel(r.id)}>{t.cancel.confirm}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onComplete(r.id)}>{td.complete}</Button>
              <Button onClick={() => onEdit(r)} className="gap-2">
                <span className="material-symbols-outlined text-[18px]">edit</span>{td.edit}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
