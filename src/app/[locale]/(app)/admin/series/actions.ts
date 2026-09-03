"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { flushAfterResponse } from "@/modules/notifications/after";
import { requireUser } from "@/modules/auth/current";
import {
  cancelSeriesSchema,
  createSeriesSchema,
  previewSeriesSchema,
  splitSeriesSchema,
} from "@/lib/validation/recurrence";
import { cancelSeries, createSeries, previewSeries, splitSeries } from "@/modules/recurrence/service";

export async function previewSeriesAction(raw: unknown) {
  return runAction(async () => previewSeries(await requireUser(), previewSeriesSchema.parse(raw)));
}

export async function createSeriesAction(raw: unknown) {
  return runAction(async () => {
    const r = await createSeries(await requireUser(), createSeriesSchema.parse(raw));
    revalidatePath("/", "layout");
    flushAfterResponse();
    return { id: r.series.id, created: r.created, skipped: r.skipped };
  });
}

export async function splitSeriesAction(raw: unknown) {
  return runAction(async () => {
    const r = await splitSeries(await requireUser(), splitSeriesSchema.parse(raw));
    revalidatePath("/", "layout");
    flushAfterResponse();
    return { newSeriesId: r.newSeries.id, created: r.created, skipped: r.skipped, deleted: r.deleted };
  });
}

export async function cancelSeriesAction(raw: unknown) {
  return runAction(async () => {
    const r = await cancelSeries(await requireUser(), cancelSeriesSchema.parse(raw));
    revalidatePath("/", "layout");
    flushAfterResponse();
    return r;
  });
}
