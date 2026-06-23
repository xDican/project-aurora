import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoomForm, type RoomFormData, type RateConfig } from "@/components/rooms/RoomForm";
import { toast } from "sonner";
import { useRooms, type Room, type RoomStatus } from "@/hooks/useRooms";
import { useRoomRates, type RoomRate, type OccupancyType } from "@/hooks/useRoomRates";
import { Loader2 } from "lucide-react";
import { es } from "@/lib/i18n/es";
import { useAuth } from "@/contexts/AuthContext";

const { roomsPage, common, roomRates: ratesT } = es;

const statusPillClasses: Record<RoomStatus, string> = {
  available: "bg-[#dcfce7] text-[#166534]",
  occupied: "bg-[#dbeafe] text-[#1e40af]",
  cleaning: "bg-[#fef9c3] text-[#854d0e]",
  maintenance: "bg-error-container text-on-error-container",
};

const OCCUPANCY_OPTIONS: OccupancyType[] = ["sencilla", "doble", "triple"];

export default function Rooms() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const { rooms, loading, error, createRoom, updateRoom, archiveRoom } = useRooms();
  const { fetchRatesForRoom, createRate, updateRatePrice, toggleRateActive } = useRoomRates();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editingRoomRates, setEditingRoomRates] = useState<RateConfig[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Rates modal state
  const [isRatesModalOpen, setIsRatesModalOpen] = useState(false);
  const [selectedRoomForRates, setSelectedRoomForRates] = useState<Room | null>(null);
  const [roomRates, setRoomRates] = useState<RoomRate[]>([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [editedPrices, setEditedPrices] = useState<Record<string, string>>({});
  const [newOccupancy, setNewOccupancy] = useState<OccupancyType | "">("");
  const [newPrice, setNewPrice] = useState("");

  const openCreateModal = () => {
    setEditingRoom(null);
    setEditingRoomRates([]);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = async (room: Room) => {
    setEditingRoom(room);
    setFormError(null);
    
    // Load existing rates for this room
    const rates = await fetchRatesForRoom(room.id, false);
    const rateConfigs: RateConfig[] = OCCUPANCY_OPTIONS.map((occ) => {
      const existingRate = rates.find((r) => r.occupancy === occ);
      return {
        occupancy: occ,
        enabled: existingRate?.is_active ?? false,
        price: existingRate?.price ?? 0,
      };
    });
    setEditingRoomRates(rateConfigs);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRoom(null);
    setEditingRoomRates([]);
    setFormError(null);
  };

  const openRatesModal = async (room: Room) => {
    setSelectedRoomForRates(room);
    setIsRatesModalOpen(true);
    setLoadingRates(true);
    setEditedPrices({});
    setNewOccupancy("");
    setNewPrice("");

    const rates = await fetchRatesForRoom(room.id, false);
    setRoomRates(rates);
    setLoadingRates(false);
  };

  const closeRatesModal = () => {
    setIsRatesModalOpen(false);
    setSelectedRoomForRates(null);
    setRoomRates([]);
    setEditedPrices({});
  };

  const handleSubmit = async (data: RoomFormData) => {
    setIsSaving(true);
    setFormError(null);

    try {
      if (editingRoom) {
        await updateRoom(editingRoom.id, {
          number: data.number,
          status: data.status,
          notes: data.notes,
          rates: data.rates,
        });
        toast.success(roomsPage.roomUpdated);
      } else {
        await createRoom({
          number: data.number,
          status: data.status,
          notes: data.notes,
          rates: data.rates,
        });
        toast.success(roomsPage.roomCreated);
      }
      closeModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setFormError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (roomId: string) => {
    try {
      await archiveRoom(roomId);
      toast.success(roomsPage.archive.success);
    } catch (err) {
      if (err instanceof Error && err.message === "HAS_ACTIVE_RESERVATIONS") {
        toast.error(roomsPage.archive.hasActiveReservations);
      } else {
        toast.error(roomsPage.archive.error);
      }
    }
  };

  const handlePriceChange = (rateId: string, value: string) => {
    setEditedPrices((prev) => ({ ...prev, [rateId]: value }));
  };

  const handleSavePrice = async (rate: RoomRate) => {
    const newPriceValue = editedPrices[rate.id];
    if (newPriceValue === undefined) return;

    const price = parseFloat(newPriceValue);
    if (isNaN(price) || price < 0) {
      toast.error("Precio inválido");
      return;
    }

    try {
      await updateRatePrice(rate.id, price);
      toast.success(ratesT.rateUpdated);
      // Refresh rates
      if (selectedRoomForRates) {
        const rates = await fetchRatesForRoom(selectedRoomForRates.id, false);
        setRoomRates(rates);
      }
      setEditedPrices((prev) => {
        const copy = { ...prev };
        delete copy[rate.id];
        return copy;
      });
    } catch {
      toast.error("Error al guardar precio");
    }
  };

  const handleToggleActive = async (rate: RoomRate) => {
    try {
      await toggleRateActive(rate.id, !rate.is_active);
      toast.success(ratesT.rateToggled);
      // Refresh rates
      if (selectedRoomForRates) {
        const rates = await fetchRatesForRoom(selectedRoomForRates.id, false);
        setRoomRates(rates);
      }
    } catch {
      toast.error("Error al cambiar estado");
    }
  };

  const handleCreateRate = async () => {
    if (!newOccupancy || !newPrice || !selectedRoomForRates) return;

    const price = parseFloat(newPrice);
    if (isNaN(price) || price < 0) {
      toast.error("Precio inválido");
      return;
    }

    try {
      await createRate(selectedRoomForRates.id, newOccupancy, price);
      toast.success(ratesT.rateCreated);
      // Refresh rates
      const rates = await fetchRatesForRoom(selectedRoomForRates.id, false);
      setRoomRates(rates);
      setNewOccupancy("");
      setNewPrice("");
    } catch {
      toast.error("Error al crear configuración");
    }
  };

  const truncateText = (text: string | null | undefined, maxLength: number = 50) => {
    if (!text) return "—";
    return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
  };

  // Get occupancies that are not yet configured for this room
  const availableOccupancies = OCCUPANCY_OPTIONS.filter(
    (occ) => !roomRates.some((r) => r.occupancy === occ)
  );

  // Show error toast if there's a fetch error
  if (error) {
    toast.error(error);
  }

  return (
    <div className="space-y-stack_gap_md">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-headline-md text-foreground font-bold">{roomsPage.title}</h2>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Administra el inventario y estado físico de las habitaciones.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreateModal} className="gap-2">
            <span className="material-symbols-outlined text-[18px]">add</span>
            {roomsPage.addRoom}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          {es.common.loading}
        </div>
      ) : rooms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-outline-variant p-12 text-center">
          <p className="text-on-surface-variant">{roomsPage.noRooms}</p>
          {isAdmin && (
            <Button onClick={openCreateModal} variant="outline" className="mt-4 gap-2">
              <span className="material-symbols-outlined text-[18px]">add</span>
              {roomsPage.addFirstRoom}
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
                <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant">{roomsPage.columns.number}</th>
                <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant">{roomsPage.columns.status}</th>
                <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant">{roomsPage.columns.notes}</th>
                <th className="px-table_cell_padding_x py-table_cell_padding_y text-label-bold text-on-surface-variant text-right">{common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {rooms.map((room) => (
                <tr key={room.id} className="hover:bg-surface-container-low transition-colors group">
                  <td className="px-table_cell_padding_x py-table_cell_padding_y text-table-data text-foreground font-semibold">
                    {room.number}
                  </td>
                  <td className="px-table_cell_padding_x py-table_cell_padding_y">
                    <span className={`inline-flex items-center px-2 py-1 rounded-pill text-label-md ${statusPillClasses[room.status]}`}>
                      {es.statusLabels[room.status]}
                    </span>
                  </td>
                  <td className="px-table_cell_padding_x py-table_cell_padding_y text-body-sm text-on-surface-variant max-w-xs truncate">
                    {truncateText(room.notes)}
                  </td>
                  <td className="px-table_cell_padding_x py-table_cell_padding_y text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => openRatesModal(room)}
                            title={ratesT.configButton}
                            className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container-high rounded transition-colors"
                          >
                            <span className="material-symbols-outlined text-[20px]">attach_money</span>
                          </button>
                          <button
                            onClick={() => openEditModal(room)}
                            title={es.common.edit}
                            className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container-high rounded transition-colors"
                          >
                            <span className="material-symbols-outlined text-[20px]">edit</span>
                          </button>
                        </>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            title={es.common.edit}
                            className="p-1.5 text-on-surface-variant hover:text-destructive hover:bg-error-container/20 rounded transition-colors"
                          >
                            <span className="material-symbols-outlined text-[20px]">archive</span>
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {roomsPage.archive.dialogTitle}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {roomsPage.archive.dialogMessage}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              {roomsPage.archive.back}
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleArchive(room.id)}
                            >
                              {roomsPage.archive.confirm}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

        {/* Room Edit/Create Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingRoom ? roomsPage.editRoom : roomsPage.newRoom}
              </DialogTitle>
            </DialogHeader>
            <RoomForm
              room={editingRoom}
              onSubmit={handleSubmit}
              onCancel={closeModal}
              isLoading={isSaving}
              error={formError}
              initialRates={editingRoomRates}
            />
          </DialogContent>
        </Dialog>

        {/* Room Rates Modal (Admin only) */}
        <Dialog open={isRatesModalOpen} onOpenChange={setIsRatesModalOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {ratesT.title} - {ratesT.room} {selectedRoomForRates?.number}
              </DialogTitle>
            </DialogHeader>

            {loadingRates ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Existing rates table */}
                {roomRates.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{ratesT.occupancy}</TableHead>
                        <TableHead>{ratesT.price}</TableHead>
                        <TableHead>{ratesT.active}</TableHead>
                        <TableHead>{common.actions}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roomRates.map((rate) => (
                        <TableRow key={rate.id}>
                          <TableCell className="font-medium">
                            {es.occupancyLabels[rate.occupancy]}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                editedPrices[rate.id] !== undefined
                                  ? editedPrices[rate.id]
                                  : rate.price.toString()
                              }
                              onChange={(e) => handlePriceChange(rate.id, e.target.value)}
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={rate.is_active}
                              onCheckedChange={() => handleToggleActive(rate)}
                            />
                          </TableCell>
                          <TableCell>
                            {editedPrices[rate.id] !== undefined && (
                              <Button
                                size="sm"
                                onClick={() => handleSavePrice(rate)}
                              >
                                {common.save}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {ratesT.noRates}
                  </p>
                )}

                {/* Add new rate */}
                {availableOccupancies.length > 0 && (
                  <div className="border-t pt-4">
                    <Label className="text-sm font-medium mb-2 block">
                      {ratesT.addRate}
                    </Label>
                    <div className="flex gap-2">
                      <Select
                        value={newOccupancy}
                        onValueChange={(v) => setNewOccupancy(v as OccupancyType)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder={ratesT.selectOccupancy} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableOccupancies.map((occ) => (
                            <SelectItem key={occ} value={occ}>
                              {es.occupancyLabels[occ]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Precio"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        className="w-24"
                      />
                      <Button
                        onClick={handleCreateRate}
                        disabled={!newOccupancy || !newPrice}
                      >
                        <span className="material-symbols-outlined text-[16px] mr-1">add</span>
                        {ratesT.add}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
    </div>
  );
}
