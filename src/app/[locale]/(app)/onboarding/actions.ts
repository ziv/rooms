"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { flushAfterResponse } from "@/modules/notifications/after";
import { requireUser } from "@/modules/auth/current";
import { updateProfileSchema } from "@/lib/validation/users";
import { requestMembershipSchema } from "@/lib/validation/memberships";
import { updateProfile } from "@/modules/users/service";
import { requestMembership } from "@/modules/memberships/service";

export async function updateProfileAction(raw: unknown) {
  return runAction(async () => {
    const actor = await requireUser();
    const input = updateProfileSchema.parse(raw);
    const user = await updateProfile(actor, input);
    revalidatePath("/", "layout");
    flushAfterResponse();
    return { fullName: user.fullName, locale: user.preferredLocale };
  });
}

export async function requestMembershipAction(raw: unknown) {
  return runAction(async () => {
    const actor = await requireUser();
    const input = requestMembershipSchema.parse(raw);
    const m = await requestMembership(actor, input.siteId);
    revalidatePath("/", "layout");
    flushAfterResponse();
    return { membershipId: m.id, status: m.status };
  });
}
