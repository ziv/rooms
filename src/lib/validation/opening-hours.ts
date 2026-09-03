import { z } from "zod";
import { hhmm, uuid, weekday } from "./common";

export const segmentSchema = z.object({ start: hhmm, end: hhmm });
export const setOpeningHoursSchema = z.object({
  siteId: uuid,
  weekday,
  segments: z.array(segmentSchema).max(6),
});
export type SetOpeningHoursInput = z.infer<typeof setOpeningHoursSchema>;
export type Segment = z.infer<typeof segmentSchema>;
