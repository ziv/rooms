import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { localToUtc, addMinutes } from "@/lib/time";
import { setOpeningHours } from "@/modules/opening-hours/service";
import { createClosure, deleteClosure, listClosures } from "@/modules/closures/service";
import { getDayAvailability } from "@/modules/availability/service";
import { cancelBooking, createBooking, getBooking, listMyBookings, moveBooking } from "@/modules/bookings/service";
import {
  actorFor,
  futureDate,
  makeBooking,
  makeMembership,
  makeOpeningHours,
  makeRoom,
  makeSite,
  makeUser,
  resetDb,
  TZ,
} from "./helpers";

beforeEach(resetDb);

async function setup() {
  const site = await makeSite();
  await makeOpeningHours(site.id);
  const room1 = await makeRoom(site.id, "1", 0);
  const room2 = await makeRoom(site.id, "2", 1);
  const admin = await makeUser({ role: "SUPER_ADMIN", fullName: "Admin" });
  const t1 = await makeUser({ fullName: "Therapist One" });
  const t2 = await makeUser({ fullName: "Therapist Two" });
  await makeMembership(site.id, t1.id);
  await makeMembership(site.id, t2.id);
  const a = {
    admin: actorFor(admin),
    t1: actorFor(t1, [{ siteId: site.id, status: "APPROVED" }]),
    t2: actorFor(t2, [{ siteId: site.id, status: "APPROVED" }]),
  };
  const date = futureDate(7);
  const at = (time: string) => localToUtc(date, time, TZ)!;
  return { site, room1, room2, admin, t1, t2, a, date, at };
}

describe("opening hours", () => {
  it("validates segments and reports warnings for future bookings outside new hours", async () => {
    const { site, room1, t1, a, at } = await setup();
    await expect(
      setOpeningHours(a.admin, { siteId: site.id, weekday: 1, segments: [{ start: "08:10", end: "12:00" }] }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      setOpeningHours(a.admin, {
        siteId: site.id,
        weekday: 1,
        segments: [
          { start: "08:00", end: "12:00" },
          { start: "11:00", end: "14:00" },
        ],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(setOpeningHours(a.t1, { siteId: site.id, weekday: 1, segments: [] })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    const booking = await makeBooking({ siteId: site.id, roomId: room1.id, userId: t1.id, startAt: at("18:00") });
    const wd = new Date(at("18:00")).getUTCDay(); // same as local weekday at 18:00 local
    const { warnings } = await setOpeningHours(a.admin, {
      siteId: site.id,
      weekday: wd,
      segments: [
        { start: "08:00", end: "13:00" },
        { start: "14:00", end: "17:00" },
      ],
    });
    expect(warnings.map((w) => w.bookingId)).toEqual([booking.id]);
  });
});

describe("closures", () => {
  it("blocks on conflicts unless cancelConflicts, then cancels and notifies", async () => {
    const { site, room1, room2, t1, t2, a, at } = await setup();
    const b1 = await makeBooking({ siteId: site.id, roomId: room1.id, userId: t1.id, startAt: at("10:00") });
    await makeBooking({ siteId: site.id, roomId: room2.id, userId: t2.id, startAt: at("15:00") }); // outside range
    const input = {
      siteId: site.id,
      roomId: null,
      startAt: at("09:00"),
      endAt: at("12:00"),
      reason: "חג",
      cancelConflicts: false,
    };

    await expect(createClosure(a.t1, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const err = await createClosure(a.admin, input).catch((e) => e);
    expect(err.code).toBe("CONFLICTS");
    expect(err.details.conflicts.map((c: { bookingId: string }) => c.bookingId)).toEqual([b1.id]);
    expect(await db.$count(schema.closures)).toBe(0);

    const closure = await createClosure(a.admin, { ...input, cancelConflicts: true });
    const cancelled = await db.query.bookings.findFirst({ where: eq(schema.bookings.id, b1.id) });
    expect(cancelled?.status).toBe("CANCELLED");
    expect(cancelled?.cancellationReason).toBe("CLOSURE: חג");
    const notes = await db.query.notifications.findMany();
    expect(notes.map((n) => n.type)).toEqual(["BOOKING_CANCELLED_BY_CLOSURE"]);
    expect(notes[0].userId).toBe(t1.id);

    const list = await listClosures(a.t1, site.id);
    expect(list.map((c) => c.id)).toEqual([closure.id]);
    await deleteClosure(a.admin, closure.id);
    expect(await db.$count(schema.closures)).toBe(0);
  });
});

describe("availability DTO (AC-01, AC-02)", () => {
  it("hides other users' details from therapists and shows them to admins", async () => {
    const { site, room1, t1, t2, a, date, at } = await setup();
    await makeBooking({ siteId: site.id, roomId: room1.id, userId: t2.id, startAt: at("10:00") });
    const mine = await makeBooking({ siteId: site.id, roomId: room1.id, userId: t1.id, startAt: at("11:00") });
    await db
      .insert(schema.closures)
      .values({
        siteId: site.id,
        roomId: null,
        startAt: at("13:00"),
        endAt: at("14:00"),
        reason: "secret",
        createdBy: t1.id,
      });

    const forT1 = await getDayAvailability(a.t1, { siteId: site.id, date });
    const room = forT1.rooms.find((r) => r.roomId === room1.id)!;
    const busy = room.blocks.find((b) => b.kind === "BUSY")!;
    expect(busy).toEqual({ kind: "BUSY", start: at("10:00").toISOString(), end: at("11:00").toISOString() });
    expect(JSON.stringify(busy)).not.toMatch(/bookingId|user|note/);
    const own = room.blocks.find((b) => b.kind === "MINE")!;
    expect(own).toMatchObject({ bookingId: mine.id });
    const closed = room.blocks.find((b) => b.kind === "CLOSED")!;
    expect("reason" in closed).toBe(false);
    expect(forT1.bookingWindow).not.toBeNull();
    expect(forT1.rooms[0].openSegments[0]).toEqual({
      start: at("08:00").toISOString(),
      end: at("21:00").toISOString(),
    });

    const forAdmin = await getDayAvailability(a.admin, { siteId: site.id, date });
    const adminRoom = forAdmin.rooms.find((r) => r.roomId === room1.id)!;
    const booking = adminRoom.blocks.find((b) => b.kind === "BOOKING")!;
    expect(booking).toMatchObject({ user: { id: t2.id, fullName: "Therapist Two" } });
    expect(forAdmin.bookingWindow).toBeNull();

    // AC-02: no membership in another site
    const other = await makeSite("Other");
    await expect(getDayAvailability(a.t1, { siteId: other.id, date })).rejects.toMatchObject({
      code: "MEMBER_NOT_APPROVED",
    });
  });
});

describe("createBooking rules", () => {
  it("enforces every rule with its code", async () => {
    const { site, room1, room2, t1, t2, a, date, at } = await setup();
    const base = { siteId: site.id, roomId: room1.id, note: null };
    const create = (actor = a.t1, patch: Partial<Parameters<typeof createBooking>[1]> = {}) =>
      createBooking(actor, { id: randomUUID(), ...base, startAt: at("10:00"), ...patch });

    await expect(create(a.t1, { startAt: at("10:10") })).rejects.toMatchObject({ code: "INVALID_START_STEP" });
    await expect(create(a.t1, { startAt: at("07:00") })).rejects.toMatchObject({ code: "OUTSIDE_OPENING_HOURS" });
    await expect(create(a.t1, { startAt: at("20:15") })).rejects.toMatchObject({ code: "OUTSIDE_OPENING_HOURS" }); // AC-07: 20:15–21:15 exceeds 21:00
    await expect(create(a.t1, { startAt: addMinutes(new Date(), -120) })).rejects.toMatchObject({
      code: /PAST_START|INVALID_START_STEP|OUTSIDE_OPENING_HOURS/,
    });
    await expect(create(a.t1, { startAt: localToUtc(futureDate(120), "10:00", TZ)! })).rejects.toMatchObject({
      code: "OUTSIDE_BOOKING_WINDOW",
    });

    // not a member
    const stranger = await makeUser();
    await expect(create(actorFor(stranger))).rejects.toMatchObject({ code: "MEMBER_NOT_APPROVED" });
    // therapist cannot book for someone else
    await expect(create(a.t1, { forUserId: t2.id })).rejects.toMatchObject({ code: "FORBIDDEN" });

    // closure
    await db
      .insert(schema.closures)
      .values({ siteId: site.id, roomId: room1.id, startAt: at("12:00"), endAt: at("13:00"), createdBy: t1.id });
    await expect(create(a.t1, { startAt: at("12:30") })).rejects.toMatchObject({ code: "CLOSED" });
    await expect(create(a.t1, { startAt: at("11:00") })).resolves.toMatchObject({ status: "CONFIRMED" }); // 11:00–12:00 touches closure start only

    // happy path + audit + outbox
    const ok = await create(a.t1);
    expect(ok.endAt.getTime() - ok.startAt.getTime()).toBe(3600e3);
    const audit = await db.query.auditEvents.findMany({ where: eq(schema.auditEvents.entityId, ok.id) });
    expect(audit[0].action).toBe("BOOKING_CREATED");
    const notes = await db.query.notifications.findMany({ where: eq(schema.notifications.userId, t1.id) });
    expect(notes.at(-1)?.type).toBe("BOOKING_CREATED");

    // SLOT_TAKEN for overlap, adjacent ok (AC-06), other room same time ok (AC-08)
    await expect(create(a.t2, { startAt: at("10:30") })).rejects.toMatchObject({ code: "SLOT_TAKEN" });
    await expect(create(a.t1, { startAt: at("09:00") })).resolves.toBeTruthy();
    await expect(create(a.t1, { roomId: room2.id, startAt: at("10:00") })).resolves.toBeTruthy();

    // admin: for a therapist, and in the past / beyond window (BKG-006)
    await expect(create(a.admin, { roomId: room2.id, startAt: at("14:00"), forUserId: t2.id })).resolves.toMatchObject({
      userId: t2.id,
    });
    const pastDate = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
    await expect(
      create(a.admin, { roomId: room2.id, startAt: localToUtc(pastDate, "10:00", TZ)!, forUserId: t2.id }),
    ).resolves.toBeTruthy();
    // admin cannot book for a non-member
    await expect(
      create(a.admin, { roomId: room2.id, startAt: at("16:00"), forUserId: stranger.id }),
    ).rejects.toMatchObject({ code: "MEMBER_NOT_APPROVED" });
    void date;
  });

  it("is idempotent for the same id (AC-04) and rejects id reuse with different data", async () => {
    const { site, room1, a, at } = await setup();
    const id = randomUUID();
    const input = { id, siteId: site.id, roomId: room1.id, startAt: at("10:00"), note: null };
    const first = await createBooking(a.t1, input);
    const second = await createBooking(a.t1, input);
    expect(second.id).toBe(first.id);
    expect(await db.$count(schema.bookings)).toBe(1);
    await expect(createBooking(a.t1, { ...input, startAt: at("11:00") })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("20 concurrent requests for one slot create exactly one booking (AC-03)", async () => {
    const { site, room1, a, at } = await setup();
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        createBooking(a.t1, { id: randomUUID(), siteId: site.id, roomId: room1.id, startAt: at("10:00"), note: null }),
      ),
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    const taken = results.filter(
      (r) => r.status === "rejected" && (r.reason as { code: string }).code === "SLOT_TAKEN",
    );
    expect(ok).toHaveLength(1);
    expect(taken).toHaveLength(19);
    expect(await db.$count(schema.bookings)).toBe(1);
  });
});

describe("move / cancel", () => {
  it("moves atomically; a failed move leaves the original untouched (AC-05)", async () => {
    const { site, room1, room2, t1, t2, a, at } = await setup();
    const mine = await makeBooking({ siteId: site.id, roomId: room1.id, userId: t1.id, startAt: at("10:00") });
    await makeBooking({ siteId: site.id, roomId: room2.id, userId: t2.id, startAt: at("10:00") });

    await expect(
      moveBooking(a.t1, { bookingId: mine.id, roomId: room2.id, startAt: at("10:00") }),
    ).rejects.toMatchObject({ code: "SLOT_TAKEN" });
    const unchanged = await db.query.bookings.findFirst({ where: eq(schema.bookings.id, mine.id) });
    expect(unchanged).toMatchObject({ roomId: room1.id, startAt: mine.startAt, version: 1 });

    const moved = await moveBooking(a.t1, { bookingId: mine.id, roomId: room2.id, startAt: at("12:00") });
    expect(moved).toMatchObject({ roomId: room2.id, version: 2 });
    expect(moved.endAt.getTime() - moved.startAt.getTime()).toBe(3600e3);

    // t2 cannot see or move t1's booking
    await expect(
      moveBooking(a.t2, { bookingId: mine.id, roomId: room1.id, startAt: at("13:00") }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getBooking(a.t2, mine.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getBooking(a.admin, mine.id)).resolves.toMatchObject({ userName: "Therapist One" });

    // admin move notifies the owner
    await moveBooking(a.admin, { bookingId: mine.id, roomId: room1.id, startAt: at("14:00") });
    const notes = await db.query.notifications.findMany({ where: eq(schema.notifications.userId, t1.id) });
    expect(notes.map((n) => n.type)).toEqual(["BOOKING_CHANGED_BY_ADMIN"]);
  });

  it("cancel respects the cutoff, keeps the row, and notifies appropriately", async () => {
    const { site, room1, t1, a, at } = await setup();
    const b = await makeBooking({ siteId: site.id, roomId: room1.id, userId: t1.id, startAt: at("10:00") });
    const cancelled = await cancelBooking(a.t1, { bookingId: b.id });
    expect(cancelled.status).toBe("CANCELLED");
    expect(await db.$count(schema.bookings)).toBe(1);
    // slot is free again
    await expect(
      createBooking(a.t1, { id: randomUUID(), siteId: site.id, roomId: room1.id, startAt: at("10:00"), note: null }),
    ).resolves.toBeTruthy();

    // started booking: therapist blocked, admin allowed with notification
    const started = await makeBooking({
      siteId: site.id,
      roomId: room1.id,
      userId: t1.id,
      startAt: addMinutes(new Date(), -30),
    });
    await expect(cancelBooking(a.t1, { bookingId: started.id })).rejects.toMatchObject({ code: "CUTOFF_PASSED" });
    await cancelBooking(a.admin, { bookingId: started.id, reason: "test" });
    const notes = await db.query.notifications.findMany({ where: eq(schema.notifications.userId, t1.id) });
    expect(notes.map((n) => n.type)).toContain("BOOKING_CANCELLED_BY_ADMIN");

    // series occurrence cancelled by therapist notifies the admin
    const [series] = await db
      .insert(schema.recurrenceSeries)
      .values({
        siteId: site.id,
        roomId: room1.id,
        userId: t1.id,
        weekday: 1,
        startTime: "09:00",
        endTime: "12:00",
        startsOn: "2030-01-07",
        endsOn: "2030-03-04",
        createdBy: t1.id,
        updatedBy: t1.id,
      })
      .returning();
    const occ = await makeBooking({
      siteId: site.id,
      roomId: room1.id,
      userId: t1.id,
      startAt: at("15:00"),
      minutes: 180,
      type: "SERIES",
      seriesId: series.id,
    });
    const occCancelled = await cancelBooking(a.t1, { bookingId: occ.id });
    expect(occCancelled.isException).toBe(true);
    const adminNotes = await db.query.notifications.findMany({
      where: eq(schema.notifications.type, "OCCURRENCE_CANCELLED_BY_THERAPIST"),
    });
    expect(adminNotes).toHaveLength(1);

    const upcoming = await listMyBookings(a.t1, { scope: "upcoming" });
    expect(upcoming.every((r) => r.status === "CONFIRMED")).toBe(true);
    const ended = await makeBooking({
      siteId: site.id,
      roomId: room1.id,
      userId: t1.id,
      startAt: addMinutes(new Date(), -180),
    });
    const past = await listMyBookings(a.t1, { scope: "past" });
    expect(past.map((r) => r.id)).toEqual([ended.id]);
    expect(upcoming.map((r) => r.id)).not.toContain(started.id); // started but cancelled
  });
});
