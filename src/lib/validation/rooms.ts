import { z } from "zod";
import { uuid } from "./common";

export const createRoomSchema = z.object({
  siteId: uuid,
  roomNumber: z.string().trim().min(1).max(20),
});
export const updateRoomSchema = z.object({
  roomId: uuid,
  roomNumber: z.string().trim().min(1).max(20),
});
export const setRoomStatusSchema = z.object({
  roomId: uuid,
  status: z.enum(["ACTIVE", "INACTIVE"]),
});
export const reorderRoomsSchema = z.object({
  siteId: uuid,
  roomIds: z.array(uuid).min(1),
});
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type SetRoomStatusInput = z.infer<typeof setRoomStatusSchema>;
export type ReorderRoomsInput = z.infer<typeof reorderRoomsSchema>;
