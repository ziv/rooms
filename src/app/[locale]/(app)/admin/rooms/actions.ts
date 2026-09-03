"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { requireUser } from "@/modules/auth/current";
import { createRoomSchema, reorderRoomsSchema, setRoomStatusSchema, updateRoomSchema } from "@/lib/validation/rooms";
import { createRoom, reorderRooms, setRoomStatus, updateRoom } from "@/modules/rooms/service";

export async function createRoomAction(raw: unknown) {
  return runAction(async () => {
    const actor = await requireUser();
    const room = await createRoom(actor, createRoomSchema.parse(raw));
    revalidatePath("/", "layout");
    return { id: room.id };
  });
}

export async function updateRoomAction(raw: unknown) {
  return runAction(async () => {
    const actor = await requireUser();
    const room = await updateRoom(actor, updateRoomSchema.parse(raw));
    revalidatePath("/", "layout");
    return { id: room.id };
  });
}

export async function setRoomStatusAction(raw: unknown) {
  return runAction(async () => {
    const actor = await requireUser();
    const room = await setRoomStatus(actor, setRoomStatusSchema.parse(raw));
    revalidatePath("/", "layout");
    return { id: room.id, status: room.status };
  });
}

export async function reorderRoomsAction(raw: unknown) {
  return runAction(async () => {
    const actor = await requireUser();
    await reorderRooms(actor, reorderRoomsSchema.parse(raw));
    revalidatePath("/", "layout");
    return null;
  });
}
