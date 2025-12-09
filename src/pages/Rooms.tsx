import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { RoomForm, type RoomFormData } from "@/components/rooms/RoomForm";
import { toast } from "sonner";
import { useRooms, type Room, type RoomStatus } from "@/hooks/useRooms";
import { Pencil, Plus, Loader2, Archive } from "lucide-react";
import { es } from "@/lib/i18n/es";

const { roomsPage, statusLabels, common } = es;

const statusColors: Record<RoomStatus, string> = {
  available: "bg-green-500/10 text-green-700 border-green-500/20",
  occupied: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  cleaning: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  maintenance: "bg-red-500/10 text-red-700 border-red-500/20",
};

export default function Rooms() {
  const { rooms, loading, error, createRoom, updateRoom, archiveRoom } = useRooms();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

  const truncateText = (text: string | null | undefined, maxLength: number = 50) => {
    if (!text) return "—";
    return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
  };

  // Show error toast if there's a fetch error
  if (error) {
    toast.error(error);
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-foreground">{roomsPage.title}</h1>
          <Button onClick={openCreateModal}>
            <Plus className="mr-2 h-4 w-4" />
            {roomsPage.addRoom}
          </Button>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="text-muted-foreground">{roomsPage.noRooms}</p>
            <Button onClick={openCreateModal} variant="outline" className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              {roomsPage.addFirstRoom}
            </Button>
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
                  <TableHead className="w-[80px]">{common.actions}</TableHead>
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
                        {statusLabels[room.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] text-muted-foreground">
                      {truncateText(room.notes)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(room)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
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
      </div>
    </div>
  );
}
