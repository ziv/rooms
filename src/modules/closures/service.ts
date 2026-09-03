import "server-only";
import { and, asc, eq, gt, inArray, lt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { lockRooms } from "@/lib/db/locks";
import { AppError, notFound } from "@/lib/errors";
import { audit } from "@/modules/audit/service";
import type { Actor } from "@/modules/auth/actor";
import { requireAdmin, requireApprovedMember } from "@/modules/auth/guards";
import { enqueue } from "@/modules/notifications/outbox";
import type { CreateClosureInput } from "@/lib/validation/closures";
import type { Closure } from "@/lib/db/schema";

export type ConflictRow = {
  bookingId: string;
  roomNumber: string;
  userId: string;
  userName: string | null;
  startAt: Date;
  endAt: Date;
  bookingType: "REGULAR" | "SERIES";
};

export type ClosureRow = Closure & { roomNumber: string | null };

export async function listClosures(actor: Actor, siteId: string, opts: { from?: Date } = {}): Promise<ClosureRow[]> {
  requireApprovedMember(actor, siteId);
  const conds = [eq(schema.closures.siteId, siteId)];
  if (opts.from) conds.push(gt(schema.closures.endAt, opts.from));
  const rows = await db
    .select({ closure: schema.closures, roomNumber: schema.rooms.roomNumber })
    .from(schema.closures)
    .leftJoin(schema.rooms, eq(schema.rooms.id, schema.closures.roomId))
    .where(and(...conds))
    .orderBy(asc(schema.closures.startAt));
  return rows.map((r) => ({ ...r.closure, roomNumber: r.roomNumber }));
}

/**
 * Creates a closure. Conflicting CONFIRMED bookings block it (CONFLICTS) unless
 * cancelConflicts is set, in which case they are cancelled with a notification each.
 */
export async function createClosure(actor: Actor, input: CreateClosureInput): Promise<Closure> {
  requireAdmin(actor);
  return db.transaction(async (tx) => {
    const site = await tx.query.sites.findFirst({ where: eq(schema.sites.id, input.siteId) });
    if (!site) throw notFound("site");
    let roomIds: string[];
    if (input.roomId) {
      const room = await tx.query.rooms.findFirst({
        where: and(eq(schema.rooms.id, input.roomId), eq(schema.rooms.siteId, input.siteId)),
      });
      if (!room) throw notFound("room");
      roomIds = [room.id];
    } else {
      const rooms = await tx.query.rooms.findMany({ where: eq(schema.rooms.siteId, input.siteId) });
      roomIds = rooms.map((r) => r.id);
    }
    // Serialise against concurrent bookings in the same rooms.
    await lockRooms(tx, roomIds);

    const conflicts: ConflictRow[] = roomIds.length
      ? await tx
          .select({
            bookingId: schema.bookings.id,
            roomNumber: schema.rooms.roomNumber,
            userId: schema.bookings.userId,
            userName: schema.users.fullName,
            startAt: schema.bookings.startAt,
            endAt: schema.bookings.endAt,
            bookingType: schema.bookings.bookingType,
          })
          .from(schema.bookings)
          .innerJoin(schema.rooms, eq(schema.rooms.id, schema.bookings.roomId))
          .innerJoin(schema.users, eq(schema.users.id, schema.bookings.userId))
          .where(
            and(
              inArray(schema.bookings.roomId, roomIds),
              eq(schema.bookings.status, "CONFIRMED"),
              lt(schema.bookings.startAt, input.endAt),
              gt(schema.bookings.endAt, input.startAt),
            ),
          )
          .orderBy(asc(schema.bookings.startAt))
      : [];

    if (conflicts.length && !input.cancelConflicts) {
      throw new AppError("CONFLICTS", "Closure conflicts with existing bookings", { conflicts });
    }

    const [closure] = await tx
      .insert(schema.closures)
      .values({
        siteId: input.siteId,
        roomId: input.roomId,
        startAt: input.startAt,
        endAt: input.endAt,
        reason: input.reason ?? null,
        createdBy: actor.userId,
      })
      .returning();

    const now = new Date();
    for (const c of conflicts) {
      await tx
        .update(schema.bookings)
        .set({
          status: "CANCELLED",
          cancelledAt: now,
          cancelledBy: actor.userId,
          cancellationReason: input.reason ? `CLOSURE: ${input.reason}` : "CLOSURE",
          updatedBy: actor.userId,
          updatedAt: now,
          isException: true,
        })
        .where(eq(schema.bookings.id, c.bookingId));
      await audit(tx, {
        actor,
        siteId: input.siteId,
        action: "BOOKING_CANCELLED",
        entityType: "booking",
        entityId: c.bookingId,
        before: { status: "CONFIRMED" },
        after: { status: "CANCELLED", reason: "CLOSURE", closureId: closure.id },
      });
      const user = await tx.query.users.findFirst({ where: eq(schema.users.id, c.userId) });
      if (user) {
        await enqueue(tx, {
          userId: user.id,
          locale: user.preferredLocale,
          type: "BOOKING_CANCELLED_BY_CLOSURE",
          payload: {
            bookingId: c.bookingId,
            siteName: site.name,
            roomNumber: c.roomNumber,
            startAt: c.startAt.toISOString(),
            endAt: c.endAt.toISOString(),
            reason: input.reason ?? null,
          },
        });
      }
    }

    await audit(tx, {
      actor,
      siteId: input.siteId,
      action: "CLOSURE_CREATED",
      entityType: "closure",
      entityId: closure.id,
      after: {
        roomId: input.roomId,
        startAt: input.startAt.toISOString(),
        endAt: input.endAt.toISOString(),
        reason: input.reason ?? null,
        cancelledBookings: conflicts.map((c) => c.bookingId),
      },
    });
    return closure;
  });
}

export async function deleteClosure(actor: Actor, closureId: string): Promise<void> {
  requireAdmin(actor);
  await db.transaction(async (tx) => {
    const existing = await tx.query.closures.findFirst({ where: eq(schema.closures.id, closureId) });
    if (!existing) throw notFound("closure");
    await tx.delete(schema.closures).where(eq(schema.closures.id, closureId));
    await audit(tx, {
      actor,
      siteId: existing.siteId,
      action: "CLOSURE_DELETED",
      entityType: "closure",
      entityId: closureId,
      before: {
        roomId: existing.roomId,
        startAt: existing.startAt.toISOString(),
        endAt: existing.endAt.toISOString(),
        reason: existing.reason,
      },
    });
  });
}
