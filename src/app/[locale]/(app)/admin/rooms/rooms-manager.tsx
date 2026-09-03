"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";
import { createRoomAction, reorderRoomsAction, setRoomStatusAction, updateRoomAction } from "./actions";
import type { Room } from "@/lib/db/schema";

export function RoomsManager({ siteId, rooms }: { siteId: string; rooms: Room[] }) {
  const t = useTranslations("admin.rooms");
  const ta = useTranslations("app");
  const router = useRouter();
  const { run, pending } = useAction();
  const [newNumber, setNewNumber] = useState("");
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);

  const refresh = () => router.refresh();
  const onDuplicate = (r: { code: string }) => {
    if (r.code === "ALREADY_EXISTS") {
      toast.error(t("duplicate"));
      return true;
    }
    return false;
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => createRoomAction({ siteId, roomNumber: newNumber }), {
      onSuccess: () => {
        setNewNumber("");
        refresh();
      },
      onError: onDuplicate,
    });
  };

  const saveEdit = () => {
    if (!editing) return;
    run(() => updateRoomAction({ roomId: editing.id, roomNumber: editing.value }), {
      onSuccess: () => {
        setEditing(null);
        refresh();
      },
      onError: onDuplicate,
    });
  };

  const toggle = (room: Room) =>
    run(() => setRoomStatusAction({ roomId: room.id, status: room.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }), {
      onSuccess: refresh,
      onError: (r) => {
        if (r.code === "ROOM_HAS_FUTURE_BOOKINGS") {
          const count = (r.details as { bookings?: unknown[] } | undefined)?.bookings?.length ?? 0;
          toast.error(t("hasFutureBookings", { count }));
          return true;
        }
        return false;
      },
    });

  const move = (index: number, dir: -1 | 1) => {
    const ids = rooms.map((r) => r.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    run(() => reorderRoomsAction({ siteId, roomIds: ids }), { onSuccess: refresh });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex gap-2 max-w-sm">
        <Input
          value={newNumber}
          onChange={(e) => setNewNumber(e.target.value)}
          placeholder={t("roomNumber")}
          required
          maxLength={20}
        />
        <Button type="submit" disabled={pending}>
          {t("add")}
        </Button>
      </form>
      {rooms.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">{t("roomNumber")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.map((room, i) => (
              <TableRow key={room.id}>
                <TableCell>
                  {editing?.id === room.id ? (
                    <div className="flex gap-2">
                      <Input
                        value={editing.value}
                        onChange={(e) => setEditing({ id: room.id, value: e.target.value })}
                        className="w-24"
                        autoFocus
                      />
                      <Button size="sm" onClick={saveEdit} disabled={pending}>
                        {ta("save")}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        {ta("cancel")}
                      </Button>
                    </div>
                  ) : (
                    room.roomNumber
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={room.status === "ACTIVE" ? "default" : "secondary"}>
                    {room.status === "ACTIVE" ? t("active") : t("inactive")}
                  </Badge>
                </TableCell>
                <TableCell className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => move(i, -1)}
                    disabled={pending || i === 0}
                    aria-label={t("moveUp")}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => move(i, 1)}
                    disabled={pending || i === rooms.length - 1}
                    aria-label={t("moveDown")}
                  >
                    ↓
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing({ id: room.id, value: room.roomNumber })}
                    disabled={pending}
                  >
                    {t("edit")}
                  </Button>
                  <Button
                    size="sm"
                    variant={room.status === "ACTIVE" ? "destructive" : "default"}
                    onClick={() => toggle(room)}
                    disabled={pending}
                  >
                    {room.status === "ACTIVE" ? t("deactivate") : t("activate")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
