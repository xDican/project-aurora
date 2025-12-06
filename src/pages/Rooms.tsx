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
import { Badge } from "@/components/ui/badge";
import { RoomForm, type RoomFormData } from "@/components/rooms/RoomForm";
import { toast } from "sonner";
import { useRooms, type Room, type RoomStatus } from "@/hooks/useRooms";
import { Pencil, Plus, Loader2 } from "lucide-react";

const statusColors: Record<RoomStatus, string> = {
  available: "bg-green-500/10 text-green-700 border-green-500/20",
  occupied: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  cleaning: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  maintenance: "bg-red-500/10 text-red-700 border-red-500/20",
};

export default function Rooms() {
  const { rooms, loading, error, createRoom, updateRoom } = useRooms();
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
        toast.success("Room updated successfully");
      } else {
        await createRoom(data);
        toast.success("Room created successfully");
      }
      closeModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setFormError(message);
    } finally {
      setIsSaving(false);
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
          <h1 className="text-2xl font-bold text-foreground">Rooms</h1>
          <Button onClick={openCreateModal}>
            <Plus className="mr-2 h-4 w-4" />
            Add room
          </Button>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="text-muted-foreground">No rooms yet.</p>
            <Button onClick={openCreateModal} variant="outline" className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Add your first room
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Base Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((room) => (
                  <TableRow key={room.id}>
                    <TableCell className="font-medium">{room.number}</TableCell>
                    <TableCell className="capitalize">{room.type}</TableCell>
                    <TableCell>${room.base_price.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusColors[room.status]}
                      >
                        {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] text-muted-foreground">
                      {truncateText(room.notes)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(room)}
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
                {editingRoom ? "Edit Room" : "Add New Room"}
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
