import { z } from "zod";
import { uuid } from "./common";

const note = z.string().trim().max(300).optional().nullable();

export const createBookingSchema = z.object({
  id: uuid,
  siteId: uuid,
  roomId: uuid,
  startAt: z.coerce.date(),
  note,
  forUserId: uuid.optional(),
});
export const moveBookingSchema = z.object({
  bookingId: uuid,
  roomId: uuid,
  startAt: z.coerce.date(),
});
export const cancelBookingSchema = z.object({
  bookingId: uuid,
  reason: z.string().trim().max(200).optional(),
});
export const availabilityQuerySchema = z.object({
  siteId: uuid,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type MoveBookingInput = z.infer<typeof moveBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
