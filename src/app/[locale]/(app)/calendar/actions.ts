"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { flushAfterResponse } from "@/modules/notifications/after";
import { requireUser } from "@/modules/auth/current";
import {
  availabilityQuerySchema,
  cancelBookingSchema,
  createBookingSchema,
  moveBookingSchema,
} from "@/lib/validation/bookings";
import { cancelBooking, createBooking, moveBooking } from "@/modules/bookings/service";
import { getDayAvailability } from "@/modules/availability/service";
import { listApprovedMembers } from "@/modules/memberships/service";
import { uuid } from "@/lib/validation/common";

export async function createBookingAction(raw: unknown) {
  return runAction(async () => {
    const actor = await requireUser();
    const b = await createBooking(actor, createBookingSchema.parse(raw));
    revalidatePath("/", "layout");
    flushAfterResponse();
    return { id: b.id, startAt: b.startAt.toISOString(), endAt: b.endAt.toISOString() };
  });
}

export async function moveBookingAction(raw: unknown) {
  return runAction(async () => {
    const actor = await requireUser();
    const b = await moveBooking(actor, moveBookingSchema.parse(raw));
    revalidatePath("/", "layout");
    flushAfterResponse();
    return { id: b.id, startAt: b.startAt.toISOString(), endAt: b.endAt.toISOString(), roomId: b.roomId };
  });
}

export async function cancelBookingAction(raw: unknown) {
  return runAction(async () => {
    const actor = await requireUser();
    const b = await cancelBooking(actor, cancelBookingSchema.parse(raw));
    revalidatePath("/", "layout");
    flushAfterResponse();
    return { id: b.id, status: b.status };
  });
}

/** Availability for another day (used by the move dialog). */
export async function getAvailabilityAction(raw: unknown) {
  return runAction(async () => {
    const actor = await requireUser();
    return getDayAvailability(actor, availabilityQuerySchema.parse(raw));
  });
}

export async function listApprovedMembersAction(raw: unknown) {
  return runAction(async () => {
    const actor = await requireUser();
    return listApprovedMembers(actor, uuid.parse(raw));
  });
}
