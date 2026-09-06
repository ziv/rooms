import { z } from "zod";
import { hhmm, isoDate, uuid, weekday } from "./common";

/** 1 = every week, 2 = every other week. */
export const intervalWeeks = z.union([z.literal(1), z.literal(2)]);

const base = {
  siteId: uuid,
  roomId: uuid,
  userId: uuid,
  weekday,
  intervalWeeks: intervalWeeks.default(1),
  startTime: hhmm,
  endTime: hhmm,
  startsOn: isoDate,
  endsOn: isoDate,
  note: z.string().trim().max(300).optional().nullable(),
};

export const seriesInputSchema = z.object(base);
export const previewSeriesSchema = seriesInputSchema.extend({
  excludeSeriesId: uuid.optional(),
  /** Phase anchor for a biweekly series when previewing a split (the old series' startsOn). */
  anchorOn: isoDate.optional(),
});
export const createSeriesSchema = seriesInputSchema.extend({ skipConflicts: z.boolean().default(false) });
export const splitSeriesSchema = z.object({
  seriesId: uuid,
  fromDate: isoDate,
  changes: z
    .object({
      roomId: uuid,
      userId: uuid,
      weekday,
      intervalWeeks,
      startTime: hhmm,
      endTime: hhmm,
      endsOn: isoDate,
      note: z.string().trim().max(300).nullable(),
    })
    .partial(),
  skipConflicts: z.boolean().default(false),
});
export const cancelSeriesSchema = z.object({ seriesId: uuid, reason: z.string().trim().max(200).optional() });

export type SeriesInput = z.infer<typeof seriesInputSchema>;
export type PreviewSeriesInput = z.infer<typeof previewSeriesSchema>;
export type CreateSeriesInput = z.infer<typeof createSeriesSchema>;
export type SplitSeriesInput = z.infer<typeof splitSeriesSchema>;
export type CancelSeriesInput = z.infer<typeof cancelSeriesSchema>;

export const updateSeriesSchema = seriesInputSchema.extend({
  seriesId: uuid,
  skipConflicts: z.boolean().default(false),
});
export const deleteSeriesSchema = z.object({ seriesId: uuid });
export type UpdateSeriesInput = z.infer<typeof updateSeriesSchema>;
