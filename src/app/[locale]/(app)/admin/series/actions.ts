"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { flushAfterResponse } from "@/modules/notifications/after";
import { requireUser } from "@/modules/auth/current";
import {
  cancelSeriesSchema,
  createSeriesSchema,
  deleteSeriesSchema,
  previewSeriesSchema,
  splitSeriesSchema,
  updateSeriesSchema,
} from "@/lib/validation/recurrence";
import {
  cancelSeries,
  createSeries,
  deleteSeries,
  previewSeries,
  splitSeries,
  updateSeries,
} from "@/modules/recurrence/service";

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

export async function updateSeriesAction(raw: unknown) {
  return runAction(async () => {
    const r = await updateSeries(await requireUser(), updateSeriesSchema.parse(raw));
    revalidatePath("/", "layout");
    flushAfterResponse();
    return { id: r.series.id, created: r.created, skipped: r.skipped, deleted: r.deleted };
  });
}

export async function deleteSeriesAction(raw: unknown) {
  return runAction(async () => {
    const r = await deleteSeries(await requireUser(), deleteSeriesSchema.parse(raw).seriesId);
    revalidatePath("/", "layout");
    flushAfterResponse();
    return r;
  });
}
