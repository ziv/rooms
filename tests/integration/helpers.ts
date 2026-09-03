import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Actor } from "@/modules/auth/actor";

/** Truncates all app tables. Call in beforeEach for isolation. */
export async function resetDb(): Promise<void> {
  await db.execute(sql`
    truncate table audit_events, notifications, bookings, recurrence_series, closures,
      opening_hours, rooms, site_memberships, sites, users restart identity cascade
  `);
}

export async function makeUser(opts: { email?: string; role?: "THERAPIST" | "SUPER_ADMIN"; fullName?: string } = {}) {
  const id = randomUUID();
  const [u] = await db
    .insert(schema.users)
    .values({
      id,
      email: opts.email ?? `${id}@test.local`,
      fullName: opts.fullName ?? "Test User",
      globalRole: opts.role ?? "THERAPIST",
    })
    .returning();
  return u;
}

export async function makeSite(name = "Site " + randomUUID().slice(0, 4)) {
  const [s] = await db.insert(schema.sites).values({ name, address: "addr" }).returning();
  return s;
}

export async function makeRoom(siteId: string, roomNumber = "1", displayOrder = 0) {
  const [r] = await db.insert(schema.rooms).values({ siteId, roomNumber, displayOrder }).returning();
  return r;
}

export async function makeMembership(siteId: string, userId: string, status: schema.MembershipStatus = "APPROVED") {
  const [m] = await db.insert(schema.siteMemberships).values({ siteId, userId, status }).returning();
  return m;
}

export function actorFor(
  user: schema.User,
  memberships: { siteId: string; status: schema.MembershipStatus }[] = [],
): Actor {
  return {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.globalRole,
    status: user.status,
    locale: "he",
    memberships,
    requestId: "test-" + randomUUID().slice(0, 8),
  };
}

export const TZ = "Asia/Jerusalem";

/** Opening hours for every weekday (default 08:00–21:00). */
export async function makeOpeningHours(siteId: string, segments: { start: string; end: string }[] = [{ start: "08:00", end: "21:00" }]) {
  const rows = [];
  for (let wd = 0; wd <= 6; wd++) for (const s of segments) rows.push({ siteId, weekday: wd, startTime: s.start, endTime: s.end });
  await db.insert(schema.openingHours).values(rows);
}

/** A local date N days from now (default 7) as YYYY-MM-DD in the site timezone. */
export function futureDate(daysAhead = 7): string {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  // simple: use the UTC date; Israel is UTC+2/+3 so midday-based dates coincide
  return d.toISOString().slice(0, 10);
}

export async function makeBooking(opts: {
  siteId: string;
  roomId: string;
  userId: string;
  startAt: Date;
  minutes?: number;
  status?: "CONFIRMED" | "CANCELLED";
  type?: "REGULAR" | "SERIES";
  seriesId?: string;
}) {
  const [b] = await db
    .insert(schema.bookings)
    .values({
      id: randomUUID(),
      siteId: opts.siteId,
      roomId: opts.roomId,
      userId: opts.userId,
      startAt: opts.startAt,
      endAt: new Date(opts.startAt.getTime() + (opts.minutes ?? 60) * 60_000),
      bookingType: opts.type ?? "REGULAR",
      status: opts.status ?? "CONFIRMED",
      seriesId: opts.seriesId ?? null,
      createdBy: opts.userId,
      updatedBy: opts.userId,
    })
    .returning();
  return b;
}
