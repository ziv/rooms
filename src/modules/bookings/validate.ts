import { and, eq, gt, lt, ne } from "drizzle-orm";
import { schema, type Tx } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { segmentsForWeekday } from "@/modules/opening-hours/service";
import { containedIn, isOnQuarter, localToUtc, overlaps, utcToLocal, type Range } from "@/lib/time";
import type { Site, Room } from "@/lib/db/schema";

export type BookableContext = {
  site: Site;
  room: Room;
  /** The user the booking belongs to. */
  targetUserId: string;
  range: Range;
  /** Admin actions may create/move bookings in the past. */
  isAdminAction: boolean;
  ignoreBookingId?: string;
  now?: Date;
};

/**
 * Runs every business rule for a booking range in a room. Throws AppError with a
 * stable code. Must be called inside a transaction that holds the room lock.
 */
export async function assertBookable(tx: Tx, ctx: BookableContext): Promise<void> {
  const { site, room, range } = ctx;
  const now = ctx.now ?? new Date();
  const tz = site.timezone;

  if (room.siteId !== site.id || room.status !== "ACTIVE" || site.status !== "ACTIVE") throw notFound("room");

  const membership = await tx.query.siteMemberships.findFirst({
    where: and(eq(schema.siteMemberships.siteId, site.id), eq(schema.siteMemberships.userId, ctx.targetUserId)),
  });
  if (!membership || membership.status !== "APPROVED") throw new AppError("MEMBER_NOT_APPROVED");

  const startLocal = utcToLocal(range.start, tz);
  if (!isOnQuarter(startLocal.time)) throw new AppError("INVALID_START_STEP");
  // Round-trip check: a start that does not map back to the same wall clock is inside a DST gap.
  const roundTrip = localToUtc(startLocal.date, startLocal.time, tz);
  if (!roundTrip || roundTrip.getTime() !== range.start.getTime()) throw new AppError("INVALID_LOCAL_TIME");

  const segments = await segmentsForWeekday(tx, site.id, startLocal.weekday);
  const inSegment = segments.some((s) => {
    const segStart = localToUtc(startLocal.date, s.start, tz);
    const segEnd = localToUtc(startLocal.date, s.end, tz);
    return segStart && segEnd && containedIn(range, { start: segStart, end: segEnd });
  });
  if (!inSegment) throw new AppError("OUTSIDE_OPENING_HOURS");

  const closures = await tx.query.closures.findMany({
    where: and(
      eq(schema.closures.siteId, site.id),
      lt(schema.closures.startAt, range.end),
      gt(schema.closures.endAt, range.start),
    ),
  });
  if (
    closures.some((c) => (!c.roomId || c.roomId === room.id) && overlaps(range, { start: c.startAt, end: c.endAt }))
  ) {
    throw new AppError("CLOSED");
  }

  if (!ctx.isAdminAction && range.start <= now) throw new AppError("PAST_START");

  const conds = [
    eq(schema.bookings.roomId, room.id),
    eq(schema.bookings.status, "CONFIRMED"),
    lt(schema.bookings.startAt, range.end),
    gt(schema.bookings.endAt, range.start),
  ];
  if (ctx.ignoreBookingId) conds.push(ne(schema.bookings.id, ctx.ignoreBookingId));
  const clash = await tx.query.bookings.findFirst({ where: and(...conds) });
  if (clash) throw new AppError("SLOT_TAKEN");
}
