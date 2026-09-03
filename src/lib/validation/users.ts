import { z } from "zod";
import { fullNameSchema, localeSchema } from "./common";

export const updateProfileSchema = z.object({
  fullName: fullNameSchema,
  locale: localeSchema,
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
