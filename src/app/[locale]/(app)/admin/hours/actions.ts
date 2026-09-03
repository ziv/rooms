"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { flushAfterResponse } from "@/modules/notifications/after";
import { requireUser } from "@/modules/auth/current";
import { setOpeningHoursSchema } from "@/lib/validation/opening-hours";
import { setOpeningHours } from "@/modules/opening-hours/service";

export async function setOpeningHoursAction(raw: unknown) {
  return runAction(async () => {
    const actor = await requireUser();
    const result = await setOpeningHours(actor, setOpeningHoursSchema.parse(raw));
    revalidatePath("/", "layout");
    flushAfterResponse();
    return {
      warnings: result.warnings.map((w) => ({ ...w, startAt: w.startAt.toISOString(), endAt: w.endAt.toISOString() })),
    };
  });
}
