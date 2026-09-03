import "server-only";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { AppError, notFound, validation } from "@/lib/errors";
import { isUniqueViolation } from "@/lib/db/errors";
import { audit } from "@/modules/audit/service";
import type { Actor } from "@/modules/auth/actor";
import { requireAdmin, requireApprovedMember } from "@/modules/auth/guards";
import type { CreateRoomInput, ReorderRoomsInput, SetRoomStatusInput, UpdateRoomInput } from "@/lib/validation/rooms";
import type { Room } from "@/lib/db/schema";

export async function listRooms(
  actor: Actor,
  siteId: string,
  opts: { includeInactive?: boolean } = {},
): Promise<Room[]> {
  requireApprovedMember(actor, siteId);
  const conds = [eq(schema.rooms.siteId, siteId)];
  if (!opts.includeInactive) conds.push(eq(schema.rooms.status, "ACTIVE"));
  return db.query.rooms.findMany({
    where: and(...conds),
    orderBy: [asc(schema.rooms.displayOrder), asc(schema.rooms.roomNumber)],
  });
}

export async function createRoom(actor: Actor, input: CreateRoomInput): Promise<Room> {
  requireAdmin(actor);
  return db.transaction(async (tx) => {
    const site = await tx.query.sites.findFirst({ where: eq(schema.sites.id, input.siteId) });
    if (!site) throw notFound("site");
    const [{ max }] = await tx
      .select({ max: sql<number>`coalesce(max(${schema.rooms.displayOrder}), -1)::int` })
      .from(schema.rooms)
      .where(eq(schema.rooms.siteId, input.siteId));
    let room: Room;
    try {
      [room] = await tx
        .insert(schema.rooms)
        .values({ siteId: input.siteId, roomNumber: input.roomNumber, displayOrder: max + 1 })
        .returning();
    } catch (e) {
      if (isUniqueViolation(e)) throw new AppError("ALREADY_EXISTS", "Room number already exists in this site");
      throw e;
    }
    await audit(tx, {
      actor,
      siteId: input.siteId,
      action: "ROOM_CREATED",
      entityType: "room",
      entityId: room.id,
      after: { roomNumber: room.roomNumber, displayOrder: room.displayOrder },
    });
    return room;
  });
}

export async function updateRoom(actor: Actor, input: UpdateRoomInput): Promise<Room> {
  requireAdmin(actor);
  return db.transaction(async (tx) => {
    const before = await tx.query.rooms.findFirst({ where: eq(schema.rooms.id, input.roomId) });
    if (!before) throw notFound("room");
    let after: Room;
    try {
      [after] = await tx
        .update(schema.rooms)
        .set({ roomNumber: input.roomNumber, updatedAt: new Date() })
        .where(eq(schema.rooms.id, input.roomId))
        .returning();
    } catch (e) {
      if (isUniqueViolation(e)) throw new AppError("ALREADY_EXISTS", "Room number already exists in this site");
      throw e;
    }
    await audit(tx, {
      actor,
      siteId: before.siteId,
      action: "ROOM_UPDATED",
      entityType: "room",
      entityId: before.id,
      before: { roomNumber: before.roomNumber },
      after: { roomNumber: after.roomNumber },
    });
    return after;
  });
}

/** Deactivation is refused while future CONFIRMED bookings exist (ROOM-001). */
export async function setRoomStatus(actor: Actor, input: SetRoomStatusInput): Promise<Room> {
  requireAdmin(actor);
  return db.transaction(async (tx) => {
    const before = await tx.query.rooms.findFirst({ where: eq(schema.rooms.id, input.roomId) });
    if (!before) throw notFound("room");
    if (before.status === input.status) return before;
    if (input.status === "INACTIVE") {
      const future = await tx
        .select({
          id: schema.bookings.id,
          startAt: schema.bookings.startAt,
          endAt: schema.bookings.endAt,
          userName: schema.users.fullName,
        })
        .from(schema.bookings)
        .innerJoin(schema.users, eq(schema.users.id, schema.bookings.userId))
        .where(
          and(
            eq(schema.bookings.roomId, before.id),
            eq(schema.bookings.status, "CONFIRMED"),
            gte(schema.bookings.startAt, new Date()),
          ),
        )
        .orderBy(asc(schema.bookings.startAt))
        .limit(50);
      if (future.length) throw new AppError("ROOM_HAS_FUTURE_BOOKINGS", undefined, { bookings: future });
    }
    const [after] = await tx
      .update(schema.rooms)
      .set({ status: input.status, updatedAt: new Date() })
      .where(eq(schema.rooms.id, before.id))
      .returning();
    await audit(tx, {
      actor,
      siteId: before.siteId,
      action: "ROOM_UPDATED",
      entityType: "room",
      entityId: before.id,
      before: { status: before.status },
      after: { status: after.status },
    });
    return after;
  });
}

export async function reorderRooms(actor: Actor, input: ReorderRoomsInput): Promise<void> {
  requireAdmin(actor);
  await db.transaction(async (tx) => {
    const existing = await tx.query.rooms.findMany({ where: eq(schema.rooms.siteId, input.siteId) });
    const ids = new Set(existing.map((r) => r.id));
    if (input.roomIds.length !== ids.size || !input.roomIds.every((id) => ids.has(id))) {
      throw validation({ roomIds: "must contain every room of the site exactly once" });
    }
    for (const [i, id] of input.roomIds.entries()) {
      await tx.update(schema.rooms).set({ displayOrder: i, updatedAt: new Date() }).where(eq(schema.rooms.id, id));
    }
    await audit(tx, {
      actor,
      siteId: input.siteId,
      action: "ROOMS_REORDERED",
      entityType: "site",
      entityId: input.siteId,
      after: { roomIds: input.roomIds },
    });
  });
}
