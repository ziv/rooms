import { z } from "zod";
import { isoDate, uuid } from "./common";

export const reportFilterSchema = z.object({
  from: isoDate,
  to: isoDate,
  siteId: uuid.optional(),
  roomId: uuid.optional(),
  userId: uuid.optional(),
  bookingType: z.enum(["REGULAR", "SERIES"]).optional(),
  status: z.enum(["CONFIRMED", "CANCELLED"]).optional(),
});
export type ReportFilter = z.infer<typeof reportFilterSchema>;
