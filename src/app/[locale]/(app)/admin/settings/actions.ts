"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { requireUser } from "@/modules/auth/current";
import { updateSiteSchema } from "@/lib/validation/sites";
import { updateSite } from "@/modules/sites/service";

export async function updateSiteAction(raw: unknown) {
  return runAction(async () => {
    const actor = await requireUser();
    const site = await updateSite(actor, updateSiteSchema.parse(raw));
    revalidatePath("/", "layout");
    return { id: site.id };
  });
}
