"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { flushAfterResponse } from "@/modules/notifications/after";
import { requireUser } from "@/modules/auth/current";
import { decideMembershipSchema } from "@/lib/validation/memberships";
import { decideMembership } from "@/modules/memberships/service";

export async function decideMembershipAction(raw: unknown) {
  return runAction(async () => {
    const actor = await requireUser();
    const input = decideMembershipSchema.parse(raw);
    const m = await decideMembership(actor, input);
    revalidatePath("/", "layout");
    flushAfterResponse();
    return { id: m.id, status: m.status };
  });
}
