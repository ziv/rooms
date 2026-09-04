import { z } from "zod";
import { uuid } from "./common";

export const updateSiteSchema = z.object({
  siteId: uuid,
  name: z.string().trim().min(1).max(80),
  address: z.string().trim().min(1).max(200),
  cancellationCutoffMinutes: z
    .number()
    .int()
    .min(0)
    .max(60 * 24 * 7),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;
