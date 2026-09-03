import "server-only";
import { and, asc, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { notFound } from "@/lib/errors";
import type { Actor } from "@/modules/auth/actor";
import { requireAdmin } from "@/modules/auth/guards";
import { addDays, localToUtc } from "@/lib/time";
import type { ReportFilter } from "@/lib/validation/reports";

const TZ = "Asia/Jerusalem";

/** Inclusive local date range → [fromUtc, toUtc). */
function bounds(filter: ReportFilter) {
  const from = localToUtc(filter.from, "00:00", TZ);
  const to = localToUtc(addDays(filter.to, 1), "00:00", TZ);
  if (!from || !to || from >= to) throw notFound("range");
  return { from, to };
}

export type HoursRow = {
  key: string;
  label: string;
  siteName: string;
  regularHours: number;
  seriesHours: number;
  totalHours: number;
  bookings: number;
};
export type HoursSummary = { byTherapist: HoursRow[]; byRoom: HoursRow[]; totalHours: number };

/** Planned-usage hours (CONFIRMED only) grouped by therapist and by room. */
export async function hoursSummary(actor: Actor, filter: ReportFilter): Promise<HoursSummary> {
  requireAdmin(actor);
  const { from, to } = bounds(filter);
  const conds: SQL[] = [
    eq(schema.bookings.status, "CONFIRMED"),
    gte(schema.bookings.startAt, from),
    lt(schema.bookings.startAt, to),
  ];
  if (filter.siteId) conds.push(eq(schema.bookings.siteId, filter.siteId));
  if (filter.roomId) conds.push(eq(schema.bookings.roomId, filter.roomId));
  if (filter.userId) conds.push(eq(schema.bookings.userId, filter.userId));

  const hours = sql<number>`sum(extract(epoch from (${schema.bookings.endAt} - ${schema.bookings.startAt})) / 3600)::float`;
  const rows = await db
    .select({
      userId: schema.bookings.userId,
      userName: schema.users.fullName,
      userEmail: schema.users.email,
      roomId: schema.bookings.roomId,
      roomNumber: schema.rooms.roomNumber,
      siteName: schema.sites.name,
      bookingType: schema.bookings.bookingType,
      hours,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.bookings)
    .innerJoin(schema.users, eq(schema.users.id, schema.bookings.userId))
    .innerJoin(schema.rooms, eq(schema.rooms.id, schema.bookings.roomId))
    .innerJoin(schema.sites, eq(schema.sites.id, schema.bookings.siteId))
    .where(and(...conds))
    .groupBy(
      schema.bookings.userId,
      schema.users.fullName,
      schema.users.email,
      schema.bookings.roomId,
      schema.rooms.roomNumber,
      schema.sites.name,
      schema.bookings.bookingType,
    );

  const agg = (keyOf: (r: (typeof rows)[number]) => string, labelOf: (r: (typeof rows)[number]) => string) => {
    const map = new Map<string, HoursRow>();
    for (const r of rows) {
      const key = keyOf(r);
      const row = map.get(key) ?? {
        key,
        label: labelOf(r),
        siteName: r.siteName,
        regularHours: 0,
        seriesHours: 0,
        totalHours: 0,
        bookings: 0,
      };
      if (r.bookingType === "REGULAR") row.regularHours += r.hours;
      else row.seriesHours += r.hours;
      row.totalHours += r.hours;
      row.bookings += r.count;
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => b.totalHours - a.totalHours);
  };
  const byTherapist = agg(
    (r) => r.userId,
    (r) => r.userName ?? r.userEmail,
  );
  const byRoom = agg(
    (r) => r.roomId,
    (r) => `${r.siteName} · ${r.roomNumber}`,
  );
  return { byTherapist, byRoom, totalHours: byTherapist.reduce((s, r) => s + r.totalHours, 0) };
}

export type BookingDetailRow = {
  id: string;
  startAt: Date;
  endAt: Date;
  siteName: string;
  roomNumber: string;
  userName: string | null;
  userEmail: string;
  bookingType: "REGULAR" | "SERIES";
  status: "CONFIRMED" | "CANCELLED";
  isException: boolean;
  createdByName: string | null;
  cancelledByName: string | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  note: string | null;
};

export async function bookingsDetail(
  actor: Actor,
  filter: ReportFilter,
  page: { limit: number; offset: number },
): Promise<BookingDetailRow[]> {
  requireAdmin(actor);
  const { from, to } = bounds(filter);
  const conds: SQL[] = [gte(schema.bookings.startAt, from), lt(schema.bookings.startAt, to)];
  if (filter.siteId) conds.push(eq(schema.bookings.siteId, filter.siteId));
  if (filter.roomId) conds.push(eq(schema.bookings.roomId, filter.roomId));
  if (filter.userId) conds.push(eq(schema.bookings.userId, filter.userId));
  if (filter.bookingType) conds.push(eq(schema.bookings.bookingType, filter.bookingType));
  if (filter.status) conds.push(eq(schema.bookings.status, filter.status));
  const creator = schema.users;
  return db
    .select({
      id: schema.bookings.id,
      startAt: schema.bookings.startAt,
      endAt: schema.bookings.endAt,
      siteName: schema.sites.name,
      roomNumber: schema.rooms.roomNumber,
      userName: sql<string | null>`owner.full_name`,
      userEmail: sql<string>`owner.email`,
      bookingType: schema.bookings.bookingType,
      status: schema.bookings.status,
      isException: schema.bookings.isException,
      createdByName: creator.fullName,
      cancelledByName: sql<string | null>`canceller.full_name`,
      cancelledAt: schema.bookings.cancelledAt,
      cancellationReason: schema.bookings.cancellationReason,
      note: schema.bookings.note,
    })
    .from(schema.bookings)
    .innerJoin(schema.sites, eq(schema.sites.id, schema.bookings.siteId))
    .innerJoin(schema.rooms, eq(schema.rooms.id, schema.bookings.roomId))
    .innerJoin(sql`users as owner`, sql`owner.id = ${schema.bookings.userId}`)
    .innerJoin(creator, eq(creator.id, schema.bookings.createdBy))
    .leftJoin(sql`users as canceller`, sql`canceller.id = ${schema.bookings.cancelledBy}`)
    .where(and(...conds))
    .orderBy(asc(schema.bookings.startAt))
    .limit(page.limit)
    .offset(page.offset);
}
