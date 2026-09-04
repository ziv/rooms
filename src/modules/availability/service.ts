import "server-only";
import { and, asc, eq, gt, lt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { isAdmin, type Actor } from "@/modules/auth/actor";
import { requireApprovedMember } from "@/modules/auth/guards";
import { segmentsForWeekday } from "@/modules/opening-hours/service";
import { dayBounds, localToUtc, weekdayOf } from "@/lib/time";
import type { AvailabilityBlock, DayAvailability } from "./types";

/**
 * Day view for one site. Therapists get a reduced projection: other people's
 * bookings are `BUSY` with times only. Admins get `BOOKING` with the user.
 */
export async function getDayAvailability(
  actor: Actor,
  params: { siteId: string; date: string; now?: Date },
): Promise<DayAvailability> {
  requireApprovedMember(actor, params.siteId);
  const site = await db.query.sites.findFirst({ where: eq(schema.sites.id, params.siteId) });
  if (!site) throw notFound("site");
  const tz = site.timezone;
  const bounds = dayBounds(params.date, tz);
  const admin = isAdmin(actor);
  const now = params.now ?? new Date();

  const [rooms, segments, closures, bookings] = await Promise.all([
    db.query.rooms.findMany({
      where: and(eq(schema.rooms.siteId, site.id), eq(schema.rooms.status, "ACTIVE")),
      orderBy: [asc(schema.rooms.displayOrder), asc(schema.rooms.roomNumber)],
    }),
    segmentsForWeekday(db, site.id, weekdayOf(params.date)),
    db.query.closures.findMany({
      where: and(
        eq(schema.closures.siteId, site.id),
        lt(schema.closures.startAt, bounds.end),
        gt(schema.closures.endAt, bounds.start),
      ),
    }),
    db
      .select({
        id: schema.bookings.id,
        roomId: schema.bookings.roomId,
        userId: schema.bookings.userId,
        startAt: schema.bookings.startAt,
        endAt: schema.bookings.endAt,
        bookingType: schema.bookings.bookingType,
        note: schema.bookings.note,
        seriesId: schema.bookings.seriesId,
        userName: schema.users.fullName,
      })
      .from(schema.bookings)
      .innerJoin(schema.users, eq(schema.users.id, schema.bookings.userId))
      .where(
        and(
          eq(schema.bookings.siteId, site.id),
          eq(schema.bookings.status, "CONFIRMED"),
          lt(schema.bookings.startAt, bounds.end),
          gt(schema.bookings.endAt, bounds.start),
        ),
      )
      .orderBy(asc(schema.bookings.startAt)),
  ]);

  const openSegments = segments
    .map((s) => ({ start: localToUtc(params.date, s.start, tz), end: localToUtc(params.date, s.end, tz) }))
    .filter((s): s is { start: Date; end: Date } => Boolean(s.start && s.end))
    .map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() }));

  const roomsOut = rooms.map((room) => {
    const blocks: AvailabilityBlock[] = [];
    for (const c of closures) {
      if (c.roomId && c.roomId !== room.id) continue;
      blocks.push({
        kind: "CLOSED",
        start: c.startAt.toISOString(),
        end: c.endAt.toISOString(),
        ...(admin ? { reason: c.reason } : {}),
      });
    }
    for (const b of bookings) {
      if (b.roomId !== room.id) continue;
      const base = { start: b.startAt.toISOString(), end: b.endAt.toISOString() };
      if (b.userId === actor.userId) {
        blocks.push({
          kind: "MINE",
          ...base,
          bookingId: b.id,
          type: b.bookingType,
          note: b.note,
          seriesId: b.seriesId,
        });
      } else if (admin) {
        blocks.push({
          kind: "BOOKING",
          ...base,
          bookingId: b.id,
          type: b.bookingType,
          note: b.note,
          seriesId: b.seriesId,
          user: { id: b.userId, fullName: b.userName },
        });
      } else {
        blocks.push({ kind: "BUSY", ...base });
      }
    }
    blocks.sort((a, b) => a.start.localeCompare(b.start));
    return { roomId: room.id, roomNumber: room.roomNumber, openSegments, blocks };
  });

  return {
    siteId: site.id,
    siteName: site.name,
    date: params.date,
    timezone: tz,
    isAdmin: admin,
    bookableFrom: admin ? null : now.toISOString(),
    rooms: roomsOut,
  };
}
