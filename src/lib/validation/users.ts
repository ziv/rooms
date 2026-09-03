import { z } from "zod";
import { fullNameSchema, localeSchema, uuid } from "./common";

export const updateProfileSchema = z.object({
  fullName: fullNameSchema,
  locale: localeSchema,
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const setUserRoleSchema = z.object({
  userId: uuid,
  role: z.enum(["THERAPIST", "SUPER_ADMIN"]),
});
export type SetUserRoleInput = z.infer<typeof setUserRoleSchema>;

export const inviteUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  fullName: fullNameSchema,
  locale: localeSchema,
  siteIds: z.array(uuid).max(20),
  role: z.enum(["THERAPIST", "SUPER_ADMIN"]).default("THERAPIST"),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
