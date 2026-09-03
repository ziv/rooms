import { AppError, forbidden } from "@/lib/errors";
import { isAdmin, isApprovedMember, type Actor } from "./actor";

export function requireAdmin(actor: Actor): void {
  if (!isAdmin(actor)) throw forbidden();
}

export function requireApprovedMember(actor: Actor, siteId: string): void {
  if (!isApprovedMember(actor, siteId)) throw new AppError("MEMBER_NOT_APPROVED");
}

export function requireActive(actor: Actor): void {
  if (actor.status !== "ACTIVE") throw forbidden("User disabled");
}
