"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { requireUser } from "@/modules/auth/current";
import { flushAfterResponse } from "@/modules/notifications/after";
import { inviteUserSchema, setUserRoleSchema } from "@/lib/validation/users";
import { inviteUser, setUserRole } from "@/modules/users/service";
import { supabaseAuthAdmin } from "@/modules/users/auth-admin";

export async function setUserRoleAction(raw: unknown) {
  return runAction(async () => {
    const actor = await requireUser();
    const u = await setUserRole(actor, setUserRoleSchema.parse(raw));
    revalidatePath("/", "layout");
    flushAfterResponse();
    return { id: u.id, role: u.globalRole };
  });
}

export async function inviteUserAction(raw: unknown) {
  return runAction(async () => {
    const actor = await requireUser();
    const r = await inviteUser(actor, inviteUserSchema.parse(raw), supabaseAuthAdmin());
    revalidatePath("/", "layout");
    flushAfterResponse();
    return { id: r.user.id, created: r.created };
  });
}
