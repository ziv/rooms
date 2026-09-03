import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { addDays, localToUtc } from "@/lib/time";
import { cancelSeries, createSeries, previewSeries, splitSeries, getSeries } from "@/modules/recurrence/service";
import { cancelBooking, moveBooking } from "@/modules/bookings/service";
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
  const admin = await makeUser({ role: "SUPER_ADMIN" });
  const t1 = await makeUser({ fullName: "T1" });
  const t2 = await makeUser({ fullName: "T2" });
  await makeMembership(site.id, t1.id);
  await makeMembership(site.id, t2.id);
  const a = { admin: actorFor(admin), t1: actorFor(t1, [{ siteId: site.id, status: "APPROVED" }]) };
  // 8 weekly occurrences starting next week on the weekday of `startsOn`
  const startsOn = futureDate(7);
  const weekday = new Date(startsOn + "T12:00:00Z").getUTCDay();
  const endsOn = addDays(startsOn, 7 * 7);
  const base = {
    siteId: site.id,
    roomId: room1.id,
    userId: t1.id,
    weekday,
    startTime: "09:00",
    endTime: "12:00",
    startsOn,
    endsOn,
    note: null,
  };
  return { site, room1, room2, t1, t2, a, base, startsOn };
}

describe("series", () => {
  it("creates all occurrences as 3-hour SERIES bookings linked to one series (AC-09)", async () => {
    const { a, base } = await setup();
    const preview = await previewSeries(a.admin, base);
    expect(preview.occurrences).toHaveLength(8);
    expect(preview.conflictCount).toBe(0);
    const { series, created } = await createSeries(a.admin, { ...base, skipConflicts: false });
    expect(created).toBe(8);
    const rows = await db.query.bookings.findMany({ where: eq(schema.bookings.seriesId, series.id) });
    expect(rows).toHaveLength(8);
    expect(
      rows.every((r) => r.bookingType === "SERIES" && r.endAt.getTime() - r.startAt.getTime() === 3 * 3600e3),
    ).toBe(true);
    const notes = await db.query.notifications.findMany();
    expect(notes.map((n) => n.type)).toEqual(["SERIES_CREATED"]);
    // therapist cannot create a series
    await expect(createSeries(a.t1, { ...base, skipConflicts: false })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("validates duration, quarter hours, membership and max length", async () => {
    const { a, base, t2 } = await setup();
    await expect(previewSeries(a.admin, { ...base, endTime: "09:30" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(previewSeries(a.admin, { ...base, endTime: "22:00" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(previewSeries(a.admin, { ...base, startTime: "09:10" })).rejects.toMatchObject({
      code: "INVALID_START_STEP",
    });
    await expect(previewSeries(a.admin, { ...base, endsOn: addDays(base.startsOn, 400) })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    const stranger = await makeUser();
    await expect(previewSeries(a.admin, { ...base, userId: stranger.id })).rejects.toMatchObject({
      code: "MEMBER_NOT_APPROVED",
    });
    void t2;
  });

  it("reports conflicts in preview and creates only the free occurrences on request (AC-10)", async () => {
    const { a, base, site, room1, t2, startsOn } = await setup();
    // clash on occurrence #2 (10:00-11:00 by t2) and a closure on #3
    const occ2 = localToUtc(addDays(startsOn, 7), "10:00", TZ)!;
    const clash = await makeBooking({ siteId: site.id, roomId: room1.id, userId: t2.id, startAt: occ2 });
    await db
      .insert(schema.closures)
      .values({
        siteId: site.id,
        roomId: null,
        startAt: localToUtc(addDays(startsOn, 14), "00:00", TZ)!,
        endAt: localToUtc(addDays(startsOn, 15), "00:00", TZ)!,
        createdBy: t2.id,
      });

    const preview = await previewSeries(a.admin, base);
    expect(preview.conflictCount).toBe(2);
    expect(preview.occurrences[1].conflict).toMatchObject({
      code: "SLOT_TAKEN",
      with: { bookingId: clash.id, userName: "T2" },
    });
    expect(preview.occurrences[2].conflict).toMatchObject({ code: "CLOSED" });

    await expect(createSeries(a.admin, { ...base, skipConflicts: false })).rejects.toMatchObject({ code: "CONFLICTS" });
    expect(await db.$count(schema.recurrenceSeries)).toBe(0);

    const { created, skipped } = await createSeries(a.admin, { ...base, skipConflicts: true });
    expect(created).toBe(6);
    expect(skipped).toEqual([addDays(startsOn, 7), addDays(startsOn, 14)]);
  });

  it("single occurrence changes mark an exception without touching the rest (AC-11)", async () => {
    const { a, base, room2 } = await setup();
    const { series } = await createSeries(a.admin, { ...base, skipConflicts: false });
    const occ = (await db.query.bookings.findMany({ where: eq(schema.bookings.seriesId, series.id) })).sort(
      (x, y) => x.startAt.getTime() - y.startAt.getTime(),
    );
    const moved = await moveBooking(a.admin, { bookingId: occ[1].id, roomId: room2.id, startAt: occ[1].startAt });
    expect(moved.isException).toBe(true);
    expect(moved.endAt.getTime() - moved.startAt.getTime()).toBe(3 * 3600e3); // duration kept
    const others = await db.query.bookings.findMany({ where: eq(schema.bookings.seriesId, series.id) });
    expect(others.filter((b) => b.isException)).toHaveLength(1);
    const cancelled = await cancelBooking(a.t1, { bookingId: occ[2].id });
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.isException).toBe(true);
  });

  it("this-and-following splits the series and regenerates future occurrences (AC-12)", async () => {
    const { a, base, room2, startsOn } = await setup();
    const { series } = await createSeries(a.admin, { ...base, skipConflicts: false });
    const fromDate = addDays(startsOn, 21); // 4th occurrence
    const result = await splitSeries(a.admin, {
      seriesId: series.id,
      fromDate,
      changes: { roomId: room2.id, startTime: "14:00", endTime: "16:00" },
      skipConflicts: false,
    });
    expect(result.deleted).toBe(5);
    expect(result.created).toBe(5);
    const old = await getSeries(a.admin, series.id);
    expect(old.status).toBe("ENDED");
    expect(old.endsOn).toBe(addDays(fromDate, -1));
    expect(old.occurrences).toHaveLength(3);
    const neu = await getSeries(a.admin, result.newSeries.id);
    expect(neu.roomId).toBe(room2.id);
    expect(neu.startTime.slice(0, 5)).toBe("14:00");
    expect(neu.occurrences).toHaveLength(5);
    expect(neu.occurrences.every((o) => o.endAt.getTime() - o.startAt.getTime() === 2 * 3600e3)).toBe(true);
    const audit = await db.query.auditEvents.findMany({ where: eq(schema.auditEvents.action, "SERIES_SPLIT") });
    expect(audit).toHaveLength(1);
    expect(audit[0].before).toMatchObject({ deletedOccurrences: 5 });
    // cancelled bookings report is not polluted: no CANCELLED rows created by the split
    expect(await db.$count(schema.bookings, eq(schema.bookings.status, "CANCELLED"))).toBe(0);
  });

  it("cancelSeries cancels future occurrences and keeps the past", async () => {
    const { a, base, site, room1, t1 } = await setup();
    const { series } = await createSeries(a.admin, { ...base, skipConflicts: false });
    // a past occurrence attached manually
    const past = await makeBooking({
      siteId: site.id,
      roomId: room1.id,
      userId: t1.id,
      startAt: new Date(Date.now() - 7 * 86400e3),
      minutes: 180,
      type: "SERIES",
      seriesId: series.id,
    });
    const { cancelled } = await cancelSeries(a.admin, { seriesId: series.id, reason: "done" });
    expect(cancelled).toBe(8);
    const pastRow = await db.query.bookings.findFirst({ where: eq(schema.bookings.id, past.id) });
    expect(pastRow?.status).toBe("CONFIRMED");
    const s = await db.query.recurrenceSeries.findFirst({ where: eq(schema.recurrenceSeries.id, series.id) });
    expect(s?.status).toBe("CANCELLED");
  });
});
