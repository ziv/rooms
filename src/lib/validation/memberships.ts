import { z } from "zod";
import { uuid } from "./common";

export const requestMembershipSchema = z.object({ siteId: uuid });
export const decideMembershipSchema = z.object({
  membershipId: uuid,
  status: z.enum(["APPROVED", "REJECTED", "SUSPENDED"]),
});
export type RequestMembershipInput = z.infer<typeof requestMembershipSchema>;
export type DecideMembershipInput = z.infer<typeof decideMembershipSchema>;
