import "server-only";
import { and, asc, eq, gte } from "drizzle-orm";
import { db, schema, type Tx } from "@/lib/db";
import { notFound, validation } from "@/lib/errors";
import { audit } from "@/modules/audit/service";
import type { Actor } from "@/modules/auth/actor";
import { requireAdmin, requireApprovedMember } from "@/modules/auth/guards";
import type { SetOpeningHoursInput, Segment } from "@/lib/validation/opening-hours";
import { isOnQuarter, timeToMinutes, utcToLocal } from "@/lib/time";
import type { OpeningHour } from "@/lib/db/schema";

export async function getOpeningHours(actor: Actor, siteId: string): Promise<OpeningHour[]> {
  requireApprovedMember(actor, siteId);
  return db.query.openingHours.findMany({
    where: eq(schema.openingHours.siteId, siteId),
    orderBy: [asc(schema.openingHours.weekday), asc(schema.openingHours.startTime)],
  });
}

/** Opening segments for one weekday, as "HH:mm" pairs. Usable inside a transaction. */
export async function segmentsForWeekday(tx: Tx | typeof db, siteId: string, weekday: number): Promise<Segment[]> {
  const rows = await tx.query.openingHours.findMany({
    where: and(eq(schema.openingHours.siteId, siteId), eq(schema.openingHours.weekday, weekday)),
    orderBy: asc(schema.openingHours.startTime),
  });
  return rows.map((r) => ({ start: r.startTime.slice(0, 5), end: r.endTime.slice(0, 5) }));
}

export type OpeningHoursWarning = {
  bookingId: string;
  startAt: Date;
  endAt: Date;
  userName: string | null;
  roomNumber: string;
};

/**
 * Replaces the segments of one weekday. Segments must be on quarter hours, ordered and non-overlapping.
 * Existing bookings are never touched; future bookings that fall outside the new hours are returned as warnings.
 */
export async function setOpeningHours(
  actor: Actor,
  input: SetOpeningHoursInput,
): Promise<{ warnings: OpeningHoursWarning[] }> {
  requireAdmin(actor);
  const segs = [...input.segments].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  for (const [i, s] of segs.entries()) {
    if (!isOnQuarter(s.start) || !isOnQuarter(s.end)) throw validation({ segments: "times must be on quarter hours" });
    if (timeToMinutes(s.start) >= timeToMinutes(s.end)) throw validation({ segments: "start must be before end" });
    if (i > 0 && timeToMinutes(segs[i - 1].end) > timeToMinutes(s.start))
      throw validation({ segments: "segments overlap" });
  }

  return db.transaction(async (tx) => {
    const site = await tx.query.sites.findFirst({ where: eq(schema.sites.id, input.siteId) });
    if (!site) throw notFound("site");
    const before = await segmentsForWeekday(tx, input.siteId, input.weekday);
    await tx
      .delete(schema.openingHours)
      .where(and(eq(schema.openingHours.siteId, input.siteId), eq(schema.openingHours.weekday, input.weekday)));
    if (segs.length) {
      await tx
        .insert(schema.openingHours)
        .values(
          segs.map((s) => ({ siteId: input.siteId, weekday: input.weekday, startTime: s.start, endTime: s.end })),
        );
    }
    await audit(tx, {
      actor,
      siteId: input.siteId,
      action: "OPENING_HOURS_SET",
      entityType: "site",
      entityId: input.siteId,
      before: { weekday: input.weekday, segments: before },
      after: { weekday: input.weekday, segments: segs },
    });

    // Warnings: future confirmed bookings on this weekday not contained in any new segment.
    const future = await tx
      .select({
        id: schema.bookings.id,
        startAt: schema.bookings.startAt,
        endAt: schema.bookings.endAt,
        userName: schema.users.fullName,
        roomNumber: schema.rooms.roomNumber,
      })
      .from(schema.bookings)
      .innerJoin(schema.users, eq(schema.users.id, schema.bookings.userId))
      .innerJoin(schema.rooms, eq(schema.rooms.id, schema.bookings.roomId))
      .where(
        and(
          eq(schema.bookings.siteId, input.siteId),
          eq(schema.bookings.status, "CONFIRMED"),
          gte(schema.bookings.startAt, new Date()),
        ),
      );
    const warnings = future
      .filter((b) => {
        const s = utcToLocal(b.startAt, site.timezone);
        if (s.weekday !== input.weekday) return false;
        const e = utcToLocal(b.endAt, site.timezone);
        const sm = timeToMinutes(s.time);
        const em = e.date === s.date ? timeToMinutes(e.time) : 24 * 60;
        return !segs.some((seg) => timeToMinutes(seg.start) <= sm && em <= timeToMinutes(seg.end));
      })
      .map((b) => ({
        bookingId: b.id,
        startAt: b.startAt,
        endAt: b.endAt,
        userName: b.userName,
        roomNumber: b.roomNumber,
      }));
    return { warnings };
  });
}
