import "server-only";
import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { lockRoom, lockRooms } from "@/lib/db/locks";
import { isExclusionViolation } from "@/lib/db/errors";
import { env } from "@/lib/env";
import { AppError, notFound, forbidden, validation } from "@/lib/errors";
import { audit } from "@/modules/audit/service";
import { isAdmin, type Actor } from "@/modules/auth/actor";
import { requireAdmin } from "@/modules/auth/guards";
import { enqueue, superAdminRecipient } from "@/modules/notifications/outbox";
import { addMinutes, REGULAR_BOOKING_MINUTES } from "@/lib/time";
import { assertBookable } from "./validate";
import type { CancelBookingInput, CreateBookingInput, MoveBookingInput } from "@/lib/validation/bookings";
import type { Booking, Site } from "@/lib/db/schema";

export type BookingDetail = Booking & {
  siteName: string;
  siteAddress: string;
  timezone: string;
  roomNumber: string;
  userName: string | null;
};

/** Whether the actor may change/cancel this booking. Admins always; owners only in the future and before the cutoff. */
export function canManageBooking(
  actor: Actor,
  booking: Pick<Booking, "userId" | "status" | "startAt" | "bookingType">,
  site: Pick<Site, "cancellationCutoffMinutes">,
  op: "move" | "cancel",
  now: Date = new Date(),
): boolean {
  if (isAdmin(actor)) return true;
  if (booking.userId !== actor.userId) return false;
  if (booking.status !== "CONFIRMED") return false;
  if (op === "move" && booking.bookingType !== "REGULAR") return false;
  if (op === "cancel" && booking.bookingType === "SERIES" && !env().THERAPIST_CAN_CANCEL_OCCURRENCE) return false;
  const cutoff = addMinutes(booking.startAt, -site.cancellationCutoffMinutes);
  return cutoff > now;
}

export async function createBooking(actor: Actor, input: CreateBookingInput): Promise<Booking> {
  const targetUserId = input.forUserId ?? actor.userId;
  if (targetUserId !== actor.userId) requireAdmin(actor);
  const range = { start: input.startAt, end: addMinutes(input.startAt, REGULAR_BOOKING_MINUTES) };

  return db.transaction(async (tx) => {
    await lockRoom(tx, input.roomId);

    const existing = await tx.query.bookings.findFirst({ where: eq(schema.bookings.id, input.id) });
    if (existing) {
      const same =
        existing.userId === targetUserId &&
        existing.roomId === input.roomId &&
        existing.startAt.getTime() === range.start.getTime();
      if (same) return existing; // idempotent retry
      throw validation({ id: "booking id already used with different data" });
    }

    const site = await tx.query.sites.findFirst({ where: eq(schema.sites.id, input.siteId) });
    const room = await tx.query.rooms.findFirst({ where: eq(schema.rooms.id, input.roomId) });
    if (!site || !room) throw notFound("room");

    await assertBookable(tx, { site, room, targetUserId, range, isAdminAction: isAdmin(actor) });

    let booking: Booking;
    try {
      [booking] = await tx
        .insert(schema.bookings)
        .values({
          id: input.id,
          siteId: site.id,
          roomId: room.id,
          userId: targetUserId,
          startAt: range.start,
          endAt: range.end,
          bookingType: "REGULAR",
          note: input.note ?? null,
          createdBy: actor.userId,
          updatedBy: actor.userId,
        })
        .returning();
    } catch (e) {
      if (isExclusionViolation(e)) throw new AppError("SLOT_TAKEN");
      throw e;
    }

    await audit(tx, {
      actor,
      siteId: site.id,
      action: "BOOKING_CREATED",
      entityType: "booking",
      entityId: booking.id,
      after: {
        roomId: room.id,
        userId: targetUserId,
        startAt: range.start.toISOString(),
        endAt: range.end.toISOString(),
        note: input.note ?? null,
      },
    });
    const target = await tx.query.users.findFirst({ where: eq(schema.users.id, targetUserId) });
    if (target) {
      await enqueue(tx, {
        userId: target.id,
        locale: target.preferredLocale,
        type: "BOOKING_CREATED",
        payload: bookingPayload(booking, site, room.roomNumber, { byAdmin: targetUserId !== actor.userId }),
      });
    }
    return booking;
  });
}

export async function moveBooking(actor: Actor, input: MoveBookingInput): Promise<Booking> {
  return db.transaction(async (tx) => {
    const current = await tx.query.bookings.findFirst({ where: eq(schema.bookings.id, input.bookingId) });
    if (!current) throw notFound("booking");
    if (!isAdmin(actor) && current.userId !== actor.userId) throw notFound("booking");
    const site = await tx.query.sites.findFirst({ where: eq(schema.sites.id, current.siteId) });
    if (!site) throw notFound("site");
    if (current.status !== "CONFIRMED") throw validation({ status: "booking is cancelled" });
    if (!canManageBooking(actor, current, site, "move")) throw new AppError("CUTOFF_PASSED");

    await lockRooms(tx, [current.roomId, input.roomId]);
    // Re-read under the lock.
    const locked = await tx.query.bookings.findFirst({ where: eq(schema.bookings.id, input.bookingId) });
    if (!locked || locked.status !== "CONFIRMED") throw validation({ status: "booking changed concurrently" });

    const room = await tx.query.rooms.findFirst({ where: eq(schema.rooms.id, input.roomId) });
    if (!room) throw notFound("room");
    const duration = locked.endAt.getTime() - locked.startAt.getTime();
    const range = { start: input.startAt, end: new Date(input.startAt.getTime() + duration) };
    if (range.start.getTime() === locked.startAt.getTime() && room.id === locked.roomId) return locked;

    await assertBookable(tx, {
      site,
      room,
      targetUserId: locked.userId,
      range,
      isAdminAction: isAdmin(actor),
      ignoreBookingId: locked.id,
    });

    let updated: Booking;
    try {
      [updated] = await tx
        .update(schema.bookings)
        .set({
          roomId: room.id,
          startAt: range.start,
          endAt: range.end,
          version: locked.version + 1,
          isException: locked.seriesId ? true : locked.isException,
          updatedBy: actor.userId,
          updatedAt: new Date(),
        })
        .where(eq(schema.bookings.id, locked.id))
        .returning();
    } catch (e) {
      if (isExclusionViolation(e)) throw new AppError("SLOT_TAKEN");
      throw e;
    }

    await audit(tx, {
      actor,
      siteId: site.id,
      action: "BOOKING_MOVED",
      entityType: "booking",
      entityId: locked.id,
      before: { roomId: locked.roomId, startAt: locked.startAt.toISOString(), endAt: locked.endAt.toISOString() },
      after: { roomId: room.id, startAt: range.start.toISOString(), endAt: range.end.toISOString() },
    });
    if (actor.userId !== locked.userId) {
      const owner = await tx.query.users.findFirst({ where: eq(schema.users.id, locked.userId) });
      if (owner) {
        await enqueue(tx, {
          userId: owner.id,
          locale: owner.preferredLocale,
          type: "BOOKING_CHANGED_BY_ADMIN",
          payload: {
            ...bookingPayload(updated, site, room.roomNumber),
            previous: {
              startAt: locked.startAt.toISOString(),
              endAt: locked.endAt.toISOString(),
              roomId: locked.roomId,
            },
          },
        });
      }
    }
    return updated;
  });
}

export async function cancelBooking(actor: Actor, input: CancelBookingInput): Promise<Booking> {
  return db.transaction(async (tx) => {
    const current = await tx.query.bookings.findFirst({ where: eq(schema.bookings.id, input.bookingId) });
    if (!current) throw notFound("booking");
    if (!isAdmin(actor) && current.userId !== actor.userId) throw notFound("booking");
    if (current.status === "CANCELLED") return current;
    const site = await tx.query.sites.findFirst({ where: eq(schema.sites.id, current.siteId) });
    if (!site) throw notFound("site");
    if (!canManageBooking(actor, current, site, "cancel")) {
      if (current.bookingType === "SERIES" && !isAdmin(actor) && !env().THERAPIST_CAN_CANCEL_OCCURRENCE)
        throw forbidden();
      throw new AppError("CUTOFF_PASSED");
    }

    await lockRoom(tx, current.roomId);
    const now = new Date();
    const [updated] = await tx
      .update(schema.bookings)
      .set({
        status: "CANCELLED",
        cancelledAt: now,
        cancelledBy: actor.userId,
        cancellationReason: input.reason ?? null,
        isException: current.seriesId ? true : current.isException,
        version: current.version + 1,
        updatedBy: actor.userId,
        updatedAt: now,
      })
      .where(eq(schema.bookings.id, current.id))
      .returning();

    await audit(tx, {
      actor,
      siteId: site.id,
      action: "BOOKING_CANCELLED",
      entityType: "booking",
      entityId: current.id,
      before: { status: "CONFIRMED" },
      after: { status: "CANCELLED", reason: input.reason ?? null },
    });

    const room = await tx.query.rooms.findFirst({ where: eq(schema.rooms.id, current.roomId) });
    const roomNumber = room?.roomNumber ?? "?";
    if (actor.userId !== current.userId) {
      const owner = await tx.query.users.findFirst({ where: eq(schema.users.id, current.userId) });
      if (owner) {
        await enqueue(tx, {
          userId: owner.id,
          locale: owner.preferredLocale,
          type: "BOOKING_CANCELLED_BY_ADMIN",
          payload: { ...bookingPayload(updated, site, roomNumber), reason: input.reason ?? null },
        });
      }
    } else if (current.bookingType === "SERIES") {
      const admin = await superAdminRecipient(tx);
      if (admin) {
        await enqueue(tx, {
          userId: admin.userId,
          locale: admin.locale,
          type: "OCCURRENCE_CANCELLED_BY_THERAPIST",
          payload: { ...bookingPayload(updated, site, roomNumber), userName: actor.fullName, userId: actor.userId },
        });
      }
    }
    return updated;
  });
}

/** Full booking for the owner or an admin. Others get NOT_FOUND (no existence leak). */
export async function getBooking(actor: Actor, bookingId: string): Promise<BookingDetail> {
  const row = await db
    .select({
      booking: schema.bookings,
      siteName: schema.sites.name,
      siteAddress: schema.sites.address,
      timezone: schema.sites.timezone,
      roomNumber: schema.rooms.roomNumber,
      userName: schema.users.fullName,
    })
    .from(schema.bookings)
    .innerJoin(schema.sites, eq(schema.sites.id, schema.bookings.siteId))
    .innerJoin(schema.rooms, eq(schema.rooms.id, schema.bookings.roomId))
    .innerJoin(schema.users, eq(schema.users.id, schema.bookings.userId))
    .where(eq(schema.bookings.id, bookingId))
    .then((r) => r[0]);
  if (!row || (!isAdmin(actor) && row.booking.userId !== actor.userId)) throw notFound("booking");
  return {
    ...row.booking,
    siteName: row.siteName,
    siteAddress: row.siteAddress,
    timezone: row.timezone,
    roomNumber: row.roomNumber,
    userName: row.userName,
  };
}

export type MyBookingRow = {
  id: string;
  siteId: string;
  siteName: string;
  roomNumber: string;
  startAt: Date;
  endAt: Date;
  bookingType: Booking["bookingType"];
  status: Booking["status"];
  timezone: string;
};

export async function listMyBookings(
  actor: Actor,
  opts: { scope: "upcoming" | "past"; limit?: number; offset?: number },
): Promise<MyBookingRow[]> {
  const now = new Date();
  const timeCond = opts.scope === "upcoming" ? gte(schema.bookings.endAt, now) : lt(schema.bookings.endAt, now);
  const conds = [eq(schema.bookings.userId, actor.userId), timeCond];
  if (opts.scope === "upcoming") conds.push(eq(schema.bookings.status, "CONFIRMED"));
  return db
    .select({
      id: schema.bookings.id,
      siteId: schema.bookings.siteId,
      siteName: schema.sites.name,
      roomNumber: schema.rooms.roomNumber,
      startAt: schema.bookings.startAt,
      endAt: schema.bookings.endAt,
      bookingType: schema.bookings.bookingType,
      status: schema.bookings.status,
      timezone: schema.sites.timezone,
    })
    .from(schema.bookings)
    .innerJoin(schema.sites, eq(schema.sites.id, schema.bookings.siteId))
    .innerJoin(schema.rooms, eq(schema.rooms.id, schema.bookings.roomId))
    .where(and(...conds))
    .orderBy(opts.scope === "upcoming" ? asc(schema.bookings.startAt) : desc(schema.bookings.startAt))
    .limit(opts.limit ?? 100)
    .offset(opts.offset ?? 0);
}

function bookingPayload(b: Booking, site: Site, roomNumber: string, extra: Record<string, unknown> = {}) {
  return {
    bookingId: b.id,
    siteId: site.id,
    siteName: site.name,
    siteAddress: site.address,
    timezone: site.timezone,
    roomNumber,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    bookingType: b.bookingType,
    version: b.version,
    ...extra,
  };
}
