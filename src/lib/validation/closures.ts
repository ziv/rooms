import { z } from "zod";
import { uuid } from "./common";

export const createClosureSchema = z
  .object({
    siteId: uuid,
    roomId: uuid.nullable(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    reason: z.string().trim().max(200).optional(),
    cancelConflicts: z.boolean().default(false),
  })
  .refine((v) => v.startAt < v.endAt, { message: "start must be before end", path: ["endAt"] });
export const deleteClosureSchema = z.object({ closureId: uuid });
export type CreateClosureInput = z.infer<typeof createClosureSchema>;
