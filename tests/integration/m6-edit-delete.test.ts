import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { addDays, localToUtc } from "@/lib/time";
import { deleteUser, setUserStatus, updateUser } from "@/modules/users/service";
import { createSeries, deleteSeries, getSeries, updateSeries } from "@/modules/recurrence/service";
import type { AuthAdmin } from "@/modules/users/auth-admin";
import { actorFor, futureDate, makeBooking, makeMembership, makeOpeningHours, makeRoom, makeSite, makeUser, resetDb, TZ } from "./helpers";

beforeEach(resetDb);

const auth = (): AuthAdmin & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    ensureAuthUser: async () => ({ id: randomUUID(), created: true }),
    updateEmail: async (id, email) => void calls.push(`update:${id}:${email}`),
    deleteAuthUser: async (id) => void calls.push(`delete:${id}`),
  };
};

describe("user edit / status / delete", () => {
  it("edits name, email (propagated to auth) and language; rejects duplicate email", async () => {
    const admin = await makeUser({ role: "SUPER_ADMIN" });
    const t = await makeUser({ email: "a@test.local", fullName: "A" });
    await makeUser({ email: "b@test.local" });
    const a = auth();
    const u = await updateUser(actorFor(admin), { userId: t.id, fullName: "A2", email: "a2@test.local", locale: "en" }, a);
    expect(u).toMatchObject({ fullName: "A2", email: "a2@test.local", preferredLocale: "en" });
    expect(a.calls).toEqual([`update:${t.id}:a2@test.local`]);
    await expect(updateUser(actorFor(admin), { userId: t.id, fullName: "A2", email: "b@test.local", locale: "en" }, a)).rejects.toMatchObject({ code: "ALREADY_EXISTS" });
    await expect(updateUser(actorFor(t), { userId: t.id, fullName: "X", email: "a2@test.local", locale: "he" }, a)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("disables/enables; not yourself, not the last manager", async () => {
    const admin = await makeUser({ role: "SUPER_ADMIN" });
    const t = await makeUser();
    await expect(setUserStatus(actorFor(admin), { userId: admin.id, status: "DISABLED" })).rejects.toMatchObject({ code: "VALIDATION" });
    const admin2 = await makeUser({ role: "SUPER_ADMIN" });
    await expect(setUserStatus(actorFor(admin2), { userId: admin.id, status: "DISABLED" })).resolves.toMatchObject({ status: "DISABLED" });
    await expect(setUserStatus(actorFor(admin), { userId: admin2.id, status: "DISABLED" })).rejects.toMatchObject({ code: "LAST_ADMIN" });
    await expect(setUserStatus(actorFor(admin2), { userId: t.id, status: "DISABLED" })).resolves.toMatchObject({ status: "DISABLED" });
    await expect(setUserStatus(actorFor(admin2), { userId: t.id, status: "ACTIVE" })).resolves.toMatchObject({ status: "ACTIVE" });
  });

  it("hard-deletes a user without bookings; anonymizes one with bookings and cancels the future", async () => {
    const site = await makeSite();
    await makeOpeningHours(site.id);
    const room = await makeRoom(site.id);
    const admin = await makeUser({ role: "SUPER_ADMIN" });
    const fresh = await makeUser({ email: "fresh@test.local" });
    await makeMembership(site.id, fresh.id, "PENDING");
    const a = auth();
    const r1 = await deleteUser(actorFor(admin), fresh.id, a);
    expect(r1.mode).toBe("HARD");
    expect(await db.query.users.findFirst({ where: eq(schema.users.id, fresh.id) })).toBeUndefined();
    expect(a.calls).toContain(`delete:${fresh.id}`);

    const busy = await makeUser({ email: "busy@test.local", fullName: "Busy" });
    await makeMembership(site.id, busy.id);
    const past = await makeBooking({ siteId: site.id, roomId: room.id, userId: busy.id, startAt: new Date(Date.now() - 5 * 86400e3) });
    const future = await makeBooking({ siteId: site.id, roomId: room.id, userId: busy.id, startAt: localToUtc(futureDate(5), "10:00", TZ)! });
    const startsOn = futureDate(7);
    const { series } = await createSeries(actorFor(admin), { siteId: site.id, roomId: room.id, userId: busy.id, weekday: new Date(startsOn + "T12:00:00Z").getUTCDay(), startTime: "12:00", endTime: "14:00", startsOn, endsOn: addDays(startsOn, 21), note: null, skipConflicts: false });
    const r2 = await deleteUser(actorFor(admin), busy.id, a);
    expect(r2.mode).toBe("ANONYMIZED");
    expect(r2.cancelledBookings).toBe(5); // 1 regular + 4 occurrences
    expect(r2.cancelledSeries).toBe(1);
    const row = await db.query.users.findFirst({ where: eq(schema.users.id, busy.id) });
    expect(row).toMatchObject({ status: "DISABLED", fullName: "משתמש שהוסר", email: `deleted+${busy.id}@invalid` });
    expect((await db.query.bookings.findFirst({ where: eq(schema.bookings.id, past.id) }))?.status).toBe("CONFIRMED");
    expect((await db.query.bookings.findFirst({ where: eq(schema.bookings.id, future.id) }))?.status).toBe("CANCELLED");
    expect((await db.query.recurrenceSeries.findFirst({ where: eq(schema.recurrenceSeries.id, series.id) }))?.status).toBe("CANCELLED");
    await expect(deleteUser(actorFor(admin), admin.id, a)).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("series edit / delete", () => {
  async function setup() {
    const site = await makeSite();
    await makeOpeningHours(site.id);
    const room1 = await makeRoom(site.id, "1", 0);
    const room2 = await makeRoom(site.id, "2", 1);
    const admin = await makeUser({ role: "SUPER_ADMIN" });
    const t1 = await makeUser({ fullName: "T1" });
    await makeMembership(site.id, t1.id);
    const startsOn = futureDate(7);
    const weekday = new Date(startsOn + "T12:00:00Z").getUTCDay();
    const base = { siteId: site.id, roomId: room1.id, userId: t1.id, weekday, startTime: "09:00", endTime: "12:00", startsOn, endsOn: addDays(startsOn, 35), note: null };
    return { site, room1, room2, admin, t1, base, startsOn };
  }

  it("updates an active series in place, regenerating future occurrences", async () => {
    const { admin, room2, base } = await setup();
    const a = actorFor(admin);
    const { series } = await createSeries(a, { ...base, skipConflicts: false });
    const r = await updateSeries(a, { ...base, seriesId: series.id, roomId: room2.id, startTime: "14:00", endTime: "16:00", endsOn: addDays(base.startsOn, 21), skipConflicts: false });
    expect(r.deleted).toBe(6);
    expect(r.created).toBe(4);
    const s = await getSeries(a, series.id);
    expect(s).toMatchObject({ roomId: room2.id, status: "ACTIVE" });
    expect(s.startTime.slice(0, 5)).toBe("14:00");
    expect(s.occurrences).toHaveLength(4);
    expect(s.occurrences.every((o) => o.roomId === room2.id && o.endAt.getTime() - o.startAt.getTime() === 2 * 3600e3)).toBe(true);
    const audit = await db.query.auditEvents.findMany({ where: eq(schema.auditEvents.action, "SERIES_UPDATED") });
    expect(audit).toHaveLength(1);
  });

  it("delete removes a not-yet-started series entirely, and cancels one with history", async () => {
    const { site, room1, admin, t1, base } = await setup();
    const a = actorFor(admin);
    const { series } = await createSeries(a, { ...base, skipConflicts: false });
    const r1 = await deleteSeries(a, series.id);
    expect(r1).toMatchObject({ mode: "DELETED", removed: 6 });
    expect(await db.query.recurrenceSeries.findFirst({ where: eq(schema.recurrenceSeries.id, series.id) })).toBeUndefined();
    expect(await db.$count(schema.bookings)).toBe(0);

    const { series: s2 } = await createSeries(a, { ...base, skipConflicts: false });
    await makeBooking({ siteId: site.id, roomId: room1.id, userId: t1.id, startAt: new Date(Date.now() - 7 * 86400e3), minutes: 180, type: "SERIES", seriesId: s2.id });
    const r2 = await deleteSeries(a, s2.id);
    expect(r2).toMatchObject({ mode: "CANCELLED", cancelled: 6 });
    const kept = await db.query.recurrenceSeries.findFirst({ where: eq(schema.recurrenceSeries.id, s2.id) });
    expect(kept?.status).toBe("CANCELLED");
    expect(await db.$count(schema.bookings, eq(schema.bookings.status, "CONFIRMED"))).toBe(1); // the past one
  });
});

describe("deleted users are hidden", () => {
  it("listUsers and listMemberships exclude anonymized users", async () => {
    const { listUsers } = await import("@/modules/users/service");
    const { listMemberships } = await import("@/modules/memberships/service");
    const site = await makeSite();
    const room = await makeRoom(site.id);
    const admin = await makeUser({ role: "SUPER_ADMIN" });
    const gone = await makeUser({ email: "gone@test.local", fullName: "Gone" });
    await makeMembership(site.id, gone.id);
    await makeBooking({ siteId: site.id, roomId: room.id, userId: gone.id, startAt: new Date(Date.now() - 86400e3) });
    await deleteUser(actorFor(admin), gone.id, auth());
    expect((await listUsers(actorFor(admin))).map((u) => u.id)).not.toContain(gone.id);
    expect((await listMemberships(actorFor(admin))).map((m) => m.userId)).not.toContain(gone.id);
    expect((await listMemberships(actorFor(admin), { status: "SUSPENDED" })).map((m) => m.userId)).not.toContain(gone.id);
  });
});
