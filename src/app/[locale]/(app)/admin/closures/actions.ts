"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { flushAfterResponse } from "@/modules/notifications/after";
import { requireUser } from "@/modules/auth/current";
import { createClosureSchema, deleteClosureSchema } from "@/lib/validation/closures";
import { createClosure, deleteClosure } from "@/modules/closures/service";

export async function createClosureAction(raw: unknown) {
  return runAction(async () => {
    const actor = await requireUser();
    const closure = await createClosure(actor, createClosureSchema.parse(raw));
    revalidatePath("/", "layout");
    flushAfterResponse();
    return { id: closure.id };
  });
}

export async function deleteClosureAction(raw: unknown) {
  return runAction(async () => {
    const actor = await requireUser();
    await deleteClosure(actor, deleteClosureSchema.parse(raw).closureId);
    revalidatePath("/", "layout");
    flushAfterResponse();
    return null;
  });
}
