"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { requireUser } from "@/modules/auth/current";
import { flushAfterResponse } from "@/modules/notifications/after";
import {
  deleteUserSchema,
  inviteUserSchema,
  setUserRoleSchema,
  setUserStatusSchema,
  updateUserSchema,
} from "@/lib/validation/users";
import { deleteUser, inviteUser, setUserRole, setUserStatus, updateUser } from "@/modules/users/service";
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

export async function updateUserAction(raw: unknown) {
  return runAction(async () => {
    const actor = await requireUser();
    const u = await updateUser(actor, updateUserSchema.parse(raw), supabaseAuthAdmin());
    revalidatePath("/", "layout");
    return { id: u.id };
  });
}

export async function setUserStatusAction(raw: unknown) {
  return runAction(async () => {
    const actor = await requireUser();
    const u = await setUserStatus(actor, setUserStatusSchema.parse(raw));
    revalidatePath("/", "layout");
    return { id: u.id, status: u.status };
  });
}

export async function deleteUserAction(raw: unknown) {
  return runAction(async () => {
    const actor = await requireUser();
    const r = await deleteUser(actor, deleteUserSchema.parse(raw).userId, supabaseAuthAdmin());
    revalidatePath("/", "layout");
    return r;
  });
}
