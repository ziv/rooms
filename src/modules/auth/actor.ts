import type { GlobalRole, MembershipStatus, UserStatus } from "@/lib/db/schema";
import type { Locale } from "@/i18n/routing";

export type Actor = {
  userId: string;
  email: string;
  fullName: string | null;
  role: GlobalRole;
  status: UserStatus;
  locale: Locale;
  memberships: { siteId: string; status: MembershipStatus }[];
  requestId: string;
};

/** Used by cron / system jobs. Never exposed to HTTP callers. */
export const SYSTEM_ACTOR: Actor = {
  userId: "00000000-0000-0000-0000-000000000000",
  email: "system@local",
  fullName: "system",
  role: "SUPER_ADMIN",
  status: "ACTIVE",
  locale: "he",
  memberships: [],
  requestId: "system",
};

export const isAdmin = (a: Actor) => a.role === "SUPER_ADMIN";

export const approvedSiteIds = (a: Actor) => a.memberships.filter((m) => m.status === "APPROVED").map((m) => m.siteId);

export function isApprovedMember(a: Actor, siteId: string): boolean {
  return isAdmin(a) || a.memberships.some((m) => m.siteId === siteId && m.status === "APPROVED");
}
