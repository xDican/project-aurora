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
import { Badge } from "@/components/ui/badge";
import { RoomForm, type RoomFormData } from "@/components/rooms/RoomForm";
import { toast } from "sonner";
import { useRooms, type Room, type RoomStatus } from "@/hooks/useRooms";
import { useRoomRates, type RoomRate, type OccupancyType } from "@/hooks/useRoomRates";
import { Pencil, Plus, Loader2, Archive, DollarSign } from "lucide-react";
import { es } from "@/lib/i18n/es";
import { useAuth } from "@/contexts/AuthContext";

const { roomsPage, common, roomRates: ratesT } = es;

const statusColors: Record<RoomStatus, string> = {
  available: "bg-green-500/10 text-green-700 border-green-500/20",
  occupied: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  cleaning: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  maintenance: "bg-red-500/10 text-red-700 border-red-500/20",
};

const OCCUPANCY_OPTIONS: OccupancyType[] = ["sencilla", "doble", "triple"];

export default function Rooms() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const { rooms, loading, error, createRoom, updateRoom, archiveRoom } = useRooms();
  const { fetchRatesForRoom, createRate, updateRatePrice, toggleRateActive } = useRoomRates();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
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
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (room: Room) => {
    setEditingRoom(room);
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRoom(null);
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
        await updateRoom(editingRoom.id, data);
        toast.success(roomsPage.roomUpdated);
      } else {
        await createRoom(data);
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
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-foreground">{roomsPage.title}</h1>
          {isAdmin && (
            <Button onClick={openCreateModal}>
              <Plus className="mr-2 h-4 w-4" />
              {roomsPage.addRoom}
            </Button>
          )}
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="text-muted-foreground">{roomsPage.noRooms}</p>
            {isAdmin && (
              <Button onClick={openCreateModal} variant="outline" className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                {roomsPage.addFirstRoom}
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{roomsPage.columns.number}</TableHead>
                  <TableHead>{roomsPage.columns.type}</TableHead>
                  <TableHead>{roomsPage.columns.basePrice}</TableHead>
                  <TableHead>{roomsPage.columns.status}</TableHead>
                  <TableHead>{roomsPage.columns.notes}</TableHead>
                  <TableHead className="w-[120px]">{common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((room) => (
                  <TableRow key={room.id}>
                    <TableCell className="font-medium">{room.number}</TableCell>
                    <TableCell className="capitalize">
                      {es.roomTypeLabels[room.type] || room.type}
                    </TableCell>
                    <TableCell>${room.base_price.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusColors[room.status]}
                      >
                        {es.statusLabels[room.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] text-muted-foreground">
                      {truncateText(room.notes)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {isAdmin && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openRatesModal(room)}
                              title={ratesT.configButton}
                            >
                              <DollarSign className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(room)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Archive className="h-4 w-4" />
                            </Button>
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
                        <Plus className="h-4 w-4 mr-1" />
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
    </div>
  );
}
