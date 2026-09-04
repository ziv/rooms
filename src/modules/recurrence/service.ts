import "server-only";
import { and, asc, desc, eq, gt, gte, inArray, lt } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, schema, type Tx } from "@/lib/db";
import { lockRooms } from "@/lib/db/locks";
import { isExclusionViolation } from "@/lib/db/errors";
import { AppError, notFound, validation } from "@/lib/errors";
import { audit } from "@/modules/audit/service";
import type { Actor } from "@/modules/auth/actor";
import { requireAdmin } from "@/modules/auth/guards";
import { enqueue } from "@/modules/notifications/outbox";
import { segmentsForWeekday } from "@/modules/opening-hours/service";
import {
  addDays,
  containedIn,
  isOnQuarter,
  localToUtc,
  overlaps,
  timeToMinutes,
  todayLocal,
  type Range,
} from "@/lib/time";
import { expandSeries, MAX_SERIES_WEEKS } from "./expand";
import type {
  CancelSeriesInput,
  CreateSeriesInput,
  PreviewSeriesInput,
  SeriesInput,
  SplitSeriesInput,
  UpdateSeriesInput,
} from "@/lib/validation/recurrence";
import type { RecurrenceSeries, Site } from "@/lib/db/schema";

export type OccurrencePreview = {
  date: string;
  start: string | null;
  end: string | null;
  conflict: null | {
    code: "INVALID_LOCAL_TIME" | "OUTSIDE_OPENING_HOURS" | "CLOSED" | "SLOT_TAKEN";
    with?: { bookingId: string; userName: string | null };
  };
};

export type SeriesPreview = { occurrences: OccurrencePreview[]; conflictCount: number; freeCount: number };

async function validateSeriesInput(tx: Tx, input: SeriesInput): Promise<Site> {
  const site = await tx.query.sites.findFirst({ where: eq(schema.sites.id, input.siteId) });
  if (!site) throw notFound("site");
  const room = await tx.query.rooms.findFirst({
    where: and(eq(schema.rooms.id, input.roomId), eq(schema.rooms.siteId, input.siteId)),
  });
  if (!room || room.status !== "ACTIVE") throw notFound("room");
  const membership = await tx.query.siteMemberships.findFirst({
    where: and(eq(schema.siteMemberships.siteId, input.siteId), eq(schema.siteMemberships.userId, input.userId)),
  });
  if (!membership || membership.status !== "APPROVED") throw new AppError("MEMBER_NOT_APPROVED");
  if (!isOnQuarter(input.startTime) || !isOnQuarter(input.endTime)) throw new AppError("INVALID_START_STEP");
  const minutes = timeToMinutes(input.endTime) - timeToMinutes(input.startTime);
  if (minutes < 60 || minutes > 12 * 60) throw validation({ duration: "between 1 and 12 hours" });
  if (input.endsOn < input.startsOn) throw validation({ endsOn: "before startsOn" });
  if (addDays(input.startsOn, MAX_SERIES_WEEKS * 7 - 1) < input.endsOn)
    throw validation({ endsOn: `max ${MAX_SERIES_WEEKS} weeks` });
  return site;
}

/** Computes occurrences and conflicts without writing. Callable inside or outside a transaction. */
async function computePreview(tx: Tx, site: Site, input: PreviewSeriesInput): Promise<SeriesPreview> {
  const tz = site.timezone;
  const occurrences = expandSeries({ ...input, tz });
  const segments = await segmentsForWeekday(tx, site.id, input.weekday);
  const ranges = occurrences.filter((o) => o.range).map((o) => o.range!);
  if (ranges.length === 0)
    return {
      occurrences: occurrences.map((o) => ({
        date: o.date,
        start: null,
        end: null,
        conflict: { code: "INVALID_LOCAL_TIME" },
      })),
      conflictCount: occurrences.length,
      freeCount: 0,
    };
  const first = ranges[0].start;
  const last = ranges[ranges.length - 1].end;

  const [closures, bookings] = await Promise.all([
    tx.query.closures.findMany({
      where: and(
        eq(schema.closures.siteId, site.id),
        lt(schema.closures.startAt, last),
        gt(schema.closures.endAt, first),
      ),
    }),
    tx
      .select({
        id: schema.bookings.id,
        startAt: schema.bookings.startAt,
        endAt: schema.bookings.endAt,
        seriesId: schema.bookings.seriesId,
        userName: schema.users.fullName,
      })
      .from(schema.bookings)
      .innerJoin(schema.users, eq(schema.users.id, schema.bookings.userId))
      .where(
        and(
          eq(schema.bookings.roomId, input.roomId),
          eq(schema.bookings.status, "CONFIRMED"),
          lt(schema.bookings.startAt, last),
          gt(schema.bookings.endAt, first),
        ),
      ),
  ]);

  const out: OccurrencePreview[] = occurrences.map((o) => {
    if (!o.range) return { date: o.date, start: null, end: null, conflict: { code: "INVALID_LOCAL_TIME" } };
    const r = o.range;
    const base = { date: o.date, start: r.start.toISOString(), end: r.end.toISOString() };
    const inSegment = segments.some((s) => {
      const ss = localToUtc(o.date, s.start, tz);
      const se = localToUtc(o.date, s.end, tz);
      return ss && se && containedIn(r, { start: ss, end: se });
    });
    if (!inSegment) return { ...base, conflict: { code: "OUTSIDE_OPENING_HOURS" } };
    if (
      closures.some((c) => (!c.roomId || c.roomId === input.roomId) && overlaps(r, { start: c.startAt, end: c.endAt }))
    )
      return { ...base, conflict: { code: "CLOSED" } };
    const clash = bookings.find(
      (b) => b.seriesId !== input.excludeSeriesId && overlaps(r, { start: b.startAt, end: b.endAt }),
    );
    if (clash)
      return { ...base, conflict: { code: "SLOT_TAKEN", with: { bookingId: clash.id, userName: clash.userName } } };
    return { ...base, conflict: null };
  });
  const conflictCount = out.filter((o) => o.conflict).length;
  return { occurrences: out, conflictCount, freeCount: out.length - conflictCount };
}

export async function previewSeries(actor: Actor, input: PreviewSeriesInput): Promise<SeriesPreview> {
  requireAdmin(actor);
  return db.transaction(async (tx) => {
    const site = await validateSeriesInput(tx, input);
    return computePreview(tx, site, input);
  });
}

async function insertSeriesWithOccurrences(
  tx: Tx,
  actor: Actor,
  site: Site,
  input: SeriesInput,
  preview: SeriesPreview,
): Promise<{ series: RecurrenceSeries; created: number; skipped: string[] }> {
  const [series] = await tx
    .insert(schema.recurrenceSeries)
    .values({
      siteId: input.siteId,
      roomId: input.roomId,
      userId: input.userId,
      weekday: input.weekday,
      startTime: input.startTime,
      endTime: input.endTime,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      note: input.note ?? null,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    })
    .returning();
  const free = preview.occurrences.filter((o) => !o.conflict && o.start && o.end);
  if (free.length) {
    try {
      await tx.insert(schema.bookings).values(
        free.map((o) => ({
          id: randomUUID(),
          siteId: input.siteId,
          roomId: input.roomId,
          userId: input.userId,
          startAt: new Date(o.start!),
          endAt: new Date(o.end!),
          bookingType: "SERIES" as const,
          seriesId: series.id,
          note: input.note ?? null,
          createdBy: actor.userId,
          updatedBy: actor.userId,
        })),
      );
    } catch (e) {
      if (isExclusionViolation(e)) throw new AppError("SLOT_TAKEN");
      throw e;
    }
  }
  const skipped = preview.occurrences.filter((o) => o.conflict).map((o) => o.date);
  void site;
  return { series, created: free.length, skipped };
}

export async function createSeries(
  actor: Actor,
  input: CreateSeriesInput,
): Promise<{ series: RecurrenceSeries; created: number; skipped: string[] }> {
  requireAdmin(actor);
  return db.transaction(async (tx) => {
    const site = await validateSeriesInput(tx, input);
    await lockRooms(tx, [input.roomId]);
    const preview = await computePreview(tx, site, input);
    if (preview.conflictCount > 0 && !input.skipConflicts)
      throw new AppError("CONFLICTS", "Series has conflicts", preview);
    const result = await insertSeriesWithOccurrences(tx, actor, site, input, preview);
    await audit(tx, {
      actor,
      siteId: input.siteId,
      action: "SERIES_CREATED",
      entityType: "series",
      entityId: result.series.id,
      after: { ...seriesSummary(result.series), created: result.created, skipped: result.skipped },
    });
    await notifyUser(tx, input.userId, "SERIES_CREATED", {
      ...seriesPayload(result.series, site),
      created: result.created,
      skipped: result.skipped,
    });
    return result;
  });
}

/**
 * "This and following": ends the old series the day before `fromDate`, deletes its
 * occurrences from that date (including exceptions), and creates a new series with the changes.
 */
export async function splitSeries(
  actor: Actor,
  input: SplitSeriesInput,
): Promise<{
  oldSeries: RecurrenceSeries;
  newSeries: RecurrenceSeries;
  deleted: number;
  created: number;
  skipped: string[];
}> {
  requireAdmin(actor);
  return db.transaction(async (tx) => {
    const old = await tx.query.recurrenceSeries.findFirst({ where: eq(schema.recurrenceSeries.id, input.seriesId) });
    if (!old) throw notFound("series");
    const site = await tx.query.sites.findFirst({ where: eq(schema.sites.id, old.siteId) });
    if (!site) throw notFound("site");
    if (old.status !== "ACTIVE") throw validation({ status: "series is not active" });
    if (input.fromDate < todayLocal(site.timezone)) throw validation({ fromDate: "must be today or later" });
    if (input.fromDate < old.startsOn || input.fromDate > old.endsOn)
      throw validation({ fromDate: "outside the series range" });

    const newInput: SeriesInput = {
      siteId: old.siteId,
      roomId: input.changes.roomId ?? old.roomId,
      userId: input.changes.userId ?? old.userId,
      weekday: input.changes.weekday ?? old.weekday,
      startTime: input.changes.startTime ?? old.startTime.slice(0, 5),
      endTime: input.changes.endTime ?? old.endTime.slice(0, 5),
      startsOn: input.fromDate,
      endsOn: input.changes.endsOn ?? old.endsOn,
      note: input.changes.note === undefined ? old.note : input.changes.note,
    };
    await validateSeriesInput(tx, newInput);
    await lockRooms(tx, [old.roomId, newInput.roomId]);

    // Remove replaced future occurrences of the old series.
    const fromStart = localToUtc(input.fromDate, "00:00", site.timezone)!;
    const toDelete = await tx.query.bookings.findMany({
      where: and(eq(schema.bookings.seriesId, old.id), gte(schema.bookings.startAt, fromStart)),
    });
    if (toDelete.length)
      await tx.delete(schema.bookings).where(
        inArray(
          schema.bookings.id,
          toDelete.map((b) => b.id),
        ),
      );

    const newEndsOn = addDays(input.fromDate, -1);
    const [oldUpdated] = await tx
      .update(schema.recurrenceSeries)
      .set({
        endsOn: newEndsOn < old.startsOn ? old.startsOn : newEndsOn,
        status: newEndsOn < old.startsOn ? "CANCELLED" : "ENDED",
        updatedBy: actor.userId,
        updatedAt: new Date(),
      })
      .where(eq(schema.recurrenceSeries.id, old.id))
      .returning();

    const preview = await computePreview(tx, site, newInput);
    if (preview.conflictCount > 0 && !input.skipConflicts)
      throw new AppError("CONFLICTS", "Series has conflicts", preview);
    const result = await insertSeriesWithOccurrences(tx, actor, site, newInput, preview);

    await audit(tx, {
      actor,
      siteId: old.siteId,
      action: "SERIES_SPLIT",
      entityType: "series",
      entityId: old.id,
      before: { ...seriesSummary(old), deletedOccurrences: toDelete.length },
      after: {
        newSeriesId: result.series.id,
        ...seriesSummary(result.series),
        created: result.created,
        skipped: result.skipped,
      },
    });
    await notifyUser(tx, newInput.userId, "SERIES_CHANGED", {
      ...seriesPayload(result.series, site),
      fromDate: input.fromDate,
      created: result.created,
      skipped: result.skipped,
    });
    if (newInput.userId !== old.userId)
      await notifyUser(tx, old.userId, "SERIES_CANCELLED", { ...seriesPayload(old, site), fromDate: input.fromDate });
    return {
      oldSeries: oldUpdated,
      newSeries: result.series,
      deleted: toDelete.length,
      created: result.created,
      skipped: result.skipped,
    };
  });
}

/** Cancels the series: future occurrences become CANCELLED; the past stays. */
export async function cancelSeries(actor: Actor, input: CancelSeriesInput): Promise<{ cancelled: number }> {
  requireAdmin(actor);
  return db.transaction(async (tx) => {
    const series = await tx.query.recurrenceSeries.findFirst({ where: eq(schema.recurrenceSeries.id, input.seriesId) });
    if (!series) throw notFound("series");
    const site = await tx.query.sites.findFirst({ where: eq(schema.sites.id, series.siteId) });
    if (!site) throw notFound("site");
    await lockRooms(tx, [series.roomId]);
    const now = new Date();
    const future = await tx
      .update(schema.bookings)
      .set({
        status: "CANCELLED",
        cancelledAt: now,
        cancelledBy: actor.userId,
        cancellationReason: input.reason ?? "SERIES_CANCELLED",
        updatedBy: actor.userId,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.bookings.seriesId, series.id),
          eq(schema.bookings.status, "CONFIRMED"),
          gte(schema.bookings.startAt, now),
        ),
      )
      .returning({ id: schema.bookings.id });
    await tx
      .update(schema.recurrenceSeries)
      .set({ status: "CANCELLED", updatedBy: actor.userId, updatedAt: now })
      .where(eq(schema.recurrenceSeries.id, series.id));
    await audit(tx, {
      actor,
      siteId: series.siteId,
      action: "SERIES_CANCELLED",
      entityType: "series",
      entityId: series.id,
      before: { status: series.status },
      after: { status: "CANCELLED", cancelledOccurrences: future.length, reason: input.reason ?? null },
    });
    await notifyUser(tx, series.userId, "SERIES_CANCELLED", {
      ...seriesPayload(series, site),
      cancelled: future.length,
      reason: input.reason ?? null,
    });
    return { cancelled: future.length };
  });
}

export type SeriesRow = RecurrenceSeries & {
  roomNumber: string;
  userName: string | null;
  userEmail: string;
  siteName: string;
};

export async function listSeries(
  actor: Actor,
  filter: { siteId?: string; status?: RecurrenceSeries["status"] } = {},
): Promise<SeriesRow[]> {
  requireAdmin(actor);
  const conds = [];
  if (filter.siteId) conds.push(eq(schema.recurrenceSeries.siteId, filter.siteId));
  if (filter.status) conds.push(eq(schema.recurrenceSeries.status, filter.status));
  const rows = await db
    .select({
      series: schema.recurrenceSeries,
      roomNumber: schema.rooms.roomNumber,
      userName: schema.users.fullName,
      userEmail: schema.users.email,
      siteName: schema.sites.name,
    })
    .from(schema.recurrenceSeries)
    .innerJoin(schema.rooms, eq(schema.rooms.id, schema.recurrenceSeries.roomId))
    .innerJoin(schema.users, eq(schema.users.id, schema.recurrenceSeries.userId))
    .innerJoin(schema.sites, eq(schema.sites.id, schema.recurrenceSeries.siteId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(schema.recurrenceSeries.status), desc(schema.recurrenceSeries.startsOn));
  return rows.map((r) => ({
    ...r.series,
    roomNumber: r.roomNumber,
    userName: r.userName,
    userEmail: r.userEmail,
    siteName: r.siteName,
  }));
}

export async function getSeries(
  actor: Actor,
  seriesId: string,
): Promise<
  SeriesRow & {
    occurrences: {
      id: string;
      startAt: Date;
      endAt: Date;
      status: "CONFIRMED" | "CANCELLED";
      isException: boolean;
      roomId: string;
    }[];
  }
> {
  requireAdmin(actor);
  const [row] = await listSeriesById(seriesId);
  if (!row) throw notFound("series");
  const occurrences = await db.query.bookings.findMany({
    where: eq(schema.bookings.seriesId, seriesId),
    orderBy: asc(schema.bookings.startAt),
    columns: { id: true, startAt: true, endAt: true, status: true, isException: true, roomId: true },
  });
  return { ...row, occurrences };
}

async function listSeriesById(id: string): Promise<SeriesRow[]> {
  const rows = await db
    .select({
      series: schema.recurrenceSeries,
      roomNumber: schema.rooms.roomNumber,
      userName: schema.users.fullName,
      userEmail: schema.users.email,
      siteName: schema.sites.name,
    })
    .from(schema.recurrenceSeries)
    .innerJoin(schema.rooms, eq(schema.rooms.id, schema.recurrenceSeries.roomId))
    .innerJoin(schema.users, eq(schema.users.id, schema.recurrenceSeries.userId))
    .innerJoin(schema.sites, eq(schema.sites.id, schema.recurrenceSeries.siteId))
    .where(eq(schema.recurrenceSeries.id, id));
  return rows.map((r) => ({
    ...r.series,
    roomNumber: r.roomNumber,
    userName: r.userName,
    userEmail: r.userEmail,
    siteName: r.siteName,
  }));
}

const seriesSummary = (s: RecurrenceSeries) => ({
  roomId: s.roomId,
  userId: s.userId,
  weekday: s.weekday,
  startTime: s.startTime,
  endTime: s.endTime,
  startsOn: s.startsOn,
  endsOn: s.endsOn,
  status: s.status,
});

const seriesPayload = (s: RecurrenceSeries, site: Site) => ({
  seriesId: s.id,
  siteId: site.id,
  siteName: site.name,
  timezone: site.timezone,
  roomId: s.roomId,
  weekday: s.weekday,
  startTime: s.startTime.slice(0, 5),
  endTime: s.endTime.slice(0, 5),
  startsOn: s.startsOn,
  endsOn: s.endsOn,
});

async function notifyUser(
  tx: Tx,
  userId: string,
  type: "SERIES_CREATED" | "SERIES_CHANGED" | "SERIES_CANCELLED",
  payload: Record<string, unknown>,
) {
  const user = await tx.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (user) await enqueue(tx, { userId: user.id, locale: user.preferredLocale, type, payload });
}

export type { Range };

/**
 * Edits an active series in place: past occurrences stay; occurrences from today on are
 * deleted and regenerated with the new details (conflicts previewed like on create).
 */
export async function updateSeries(
  actor: Actor,
  input: UpdateSeriesInput,
): Promise<{ series: RecurrenceSeries; deleted: number; created: number; skipped: string[] }> {
  requireAdmin(actor);
  return db.transaction(async (tx) => {
    const old = await tx.query.recurrenceSeries.findFirst({ where: eq(schema.recurrenceSeries.id, input.seriesId) });
    if (!old) throw notFound("series");
    if (old.status !== "ACTIVE") throw validation({ status: "series is not active" });
    if (input.siteId !== old.siteId) throw validation({ siteId: "cannot move a series between sites" });
    const site = await validateSeriesInput(tx, input);
    await lockRooms(tx, [old.roomId, input.roomId]);

    const today = todayLocal(site.timezone);
    const regenFrom = input.startsOn > today ? input.startsOn : today;
    const fromStart = localToUtc(regenFrom, "00:00", site.timezone)!;
    const toDelete = await tx.query.bookings.findMany({
      where: and(eq(schema.bookings.seriesId, old.id), gte(schema.bookings.startAt, fromStart)),
    });
    if (toDelete.length)
      await tx.delete(schema.bookings).where(
        inArray(
          schema.bookings.id,
          toDelete.map((b) => b.id),
        ),
      );

    const preview = await computePreview(tx, site, { ...input, startsOn: regenFrom, excludeSeriesId: old.id });
    if (preview.conflictCount > 0 && !input.skipConflicts)
      throw new AppError("CONFLICTS", "Series has conflicts", preview);

    const [series] = await tx
      .update(schema.recurrenceSeries)
      .set({
        roomId: input.roomId,
        userId: input.userId,
        weekday: input.weekday,
        startTime: input.startTime,
        endTime: input.endTime,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        note: input.note ?? null,
        updatedBy: actor.userId,
        updatedAt: new Date(),
      })
      .where(eq(schema.recurrenceSeries.id, old.id))
      .returning();
    const free = preview.occurrences.filter((o) => !o.conflict && o.start && o.end);
    if (free.length) {
      try {
        await tx.insert(schema.bookings).values(
          free.map((o) => ({
            id: randomUUID(),
            siteId: series.siteId,
            roomId: series.roomId,
            userId: series.userId,
            startAt: new Date(o.start!),
            endAt: new Date(o.end!),
            bookingType: "SERIES" as const,
            seriesId: series.id,
            note: series.note,
            createdBy: actor.userId,
            updatedBy: actor.userId,
          })),
        );
      } catch (e) {
        if (isExclusionViolation(e)) throw new AppError("SLOT_TAKEN");
        throw e;
      }
    }
    const skipped = preview.occurrences.filter((o) => o.conflict).map((o) => o.date);
    await audit(tx, {
      actor,
      siteId: series.siteId,
      action: "SERIES_UPDATED",
      entityType: "series",
      entityId: series.id,
      before: { ...seriesSummary(old), deletedOccurrences: toDelete.length },
      after: { ...seriesSummary(series), regeneratedFrom: regenFrom, created: free.length, skipped },
    });
    await notifyUser(tx, series.userId, "SERIES_CHANGED", {
      ...seriesPayload(series, site),
      fromDate: regenFrom,
      created: free.length,
      skipped,
    });
    if (series.userId !== old.userId)
      await notifyUser(tx, old.userId, "SERIES_CANCELLED", { ...seriesPayload(old, site), fromDate: regenFrom });
    return { series, deleted: toDelete.length, created: free.length, skipped };
  });
}

export type DeleteSeriesResult = { mode: "DELETED" | "CANCELLED"; removed: number; cancelled: number };

/** Removes a series entirely when no occurrence has started yet; otherwise cancels the future and keeps history. */
export async function deleteSeries(actor: Actor, seriesId: string): Promise<DeleteSeriesResult> {
  requireAdmin(actor);
  return db.transaction(async (tx) => {
    const series = await tx.query.recurrenceSeries.findFirst({ where: eq(schema.recurrenceSeries.id, seriesId) });
    if (!series) throw notFound("series");
    await lockRooms(tx, [series.roomId]);
    const now = new Date();
    const past = await tx.$count(
      schema.bookings,
      and(eq(schema.bookings.seriesId, seriesId), lt(schema.bookings.startAt, now)),
    );
    if (past === 0) {
      const removed = await tx
        .delete(schema.bookings)
        .where(eq(schema.bookings.seriesId, seriesId))
        .returning({ id: schema.bookings.id });
      await tx.delete(schema.recurrenceSeries).where(eq(schema.recurrenceSeries.id, seriesId));
      await audit(tx, {
        actor,
        siteId: series.siteId,
        action: "SERIES_DELETED",
        entityType: "series",
        entityId: seriesId,
        before: { ...seriesSummary(series), removedOccurrences: removed.length },
      });
      const site = await tx.query.sites.findFirst({ where: eq(schema.sites.id, series.siteId) });
      if (site && series.status === "ACTIVE")
        await notifyUser(tx, series.userId, "SERIES_CANCELLED", {
          ...seriesPayload(series, site),
          cancelled: removed.length,
        });
      return { mode: "DELETED" as const, removed: removed.length, cancelled: 0 };
    }
    const cancelled = await tx
      .update(schema.bookings)
      .set({
        status: "CANCELLED",
        cancelledAt: now,
        cancelledBy: actor.userId,
        cancellationReason: "SERIES_CANCELLED",
        updatedBy: actor.userId,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.bookings.seriesId, seriesId),
          eq(schema.bookings.status, "CONFIRMED"),
          gte(schema.bookings.startAt, now),
        ),
      )
      .returning({ id: schema.bookings.id });
    await tx
      .update(schema.recurrenceSeries)
      .set({ status: "CANCELLED", updatedBy: actor.userId, updatedAt: now })
      .where(eq(schema.recurrenceSeries.id, seriesId));
    await audit(tx, {
      actor,
      siteId: series.siteId,
      action: "SERIES_CANCELLED",
      entityType: "series",
      entityId: seriesId,
      before: { status: series.status },
      after: { status: "CANCELLED", cancelledOccurrences: cancelled.length, viaDelete: true },
    });
    const site = await tx.query.sites.findFirst({ where: eq(schema.sites.id, series.siteId) });
    if (site && series.status === "ACTIVE")
      await notifyUser(tx, series.userId, "SERIES_CANCELLED", {
        ...seriesPayload(series, site),
        cancelled: cancelled.length,
      });
    return { mode: "CANCELLED" as const, removed: 0, cancelled: cancelled.length };
  });
}
