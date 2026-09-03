import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { ensureUser } from "@/modules/users/service";
import { decideMembership, requestMembership, listMemberships } from "@/modules/memberships/service";
import { createRoom, setRoomStatus, reorderRooms } from "@/modules/rooms/service";
import { updateSite } from "@/modules/sites/service";
import { listAuditEvents } from "@/modules/audit/service";
import { actorFor, makeMembership, makeRoom, makeSite, makeUser, resetDb } from "./helpers";
import { pgErrorCode } from "@/lib/db/errors";

beforeEach(resetDb);

describe("ensureUser / super admin bootstrap", () => {
  it("grants SUPER_ADMIN to the configured email once, with an audit event", async () => {
    const adminEmail = process.env.SUPER_ADMIN_EMAIL!;
    const a = await ensureUser({ id: randomUUID(), email: adminEmail, emailVerified: true, requestId: "r1" });
    expect(a.globalRole).toBe("SUPER_ADMIN");

    // Second user with same email but different auth id (theoretical): must NOT become admin.
    const b = await ensureUser({ id: randomUUID(), email: "other@test.local", emailVerified: true, requestId: "r2" });
    expect(b.globalRole).toBe("THERAPIST");

    const events = await db.query.auditEvents.findMany({ where: eq(schema.auditEvents.action, "ROLE_GRANTED") });
    expect(events).toHaveLength(1);
    expect(events[0].entityId).toBe(a.id);
  });

  it("does not grant admin when the email is unverified", async () => {
    const u = await ensureUser({
      id: randomUUID(),
      email: process.env.SUPER_ADMIN_EMAIL!,
      emailVerified: false,
      requestId: "r",
    });
    expect(u.globalRole).toBe("THERAPIST");
  });

  it("promotes an existing therapist when the admin email is configured later", async () => {
    const id = randomUUID();
    const adminEmail = process.env.SUPER_ADMIN_EMAIL!;
    const first = await ensureUser({ id, email: adminEmail, emailVerified: false, requestId: "r" });
    expect(first.globalRole).toBe("THERAPIST");
    const second = await ensureUser({ id, email: adminEmail, emailVerified: true, requestId: "r" });
    expect(second.globalRole).toBe("SUPER_ADMIN");
  });

  it("is idempotent", async () => {
    const id = randomUUID();
    const first = await ensureUser({ id, email: "x@test.local", emailVerified: true, requestId: "r" });
    const second = await ensureUser({ id, email: "x@test.local", emailVerified: true, requestId: "r" });
    expect(second.id).toBe(first.id);
    expect(await db.$count(schema.users)).toBe(1);
  });
});

describe("memberships", () => {
  it("therapist requests, admin approves; therapist cannot decide", async () => {
    const site = await makeSite();
    const therapist = await makeUser();
    const admin = await makeUser({ role: "SUPER_ADMIN" });

    const m = await requestMembership(actorFor(therapist), site.id);
    expect(m.status).toBe("PENDING");

    await expect(
      decideMembership(actorFor(therapist), { membershipId: m.id, status: "APPROVED" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const approved = await decideMembership(actorFor(admin), { membershipId: m.id, status: "APPROVED" });
    expect(approved.status).toBe("APPROVED");
    expect(approved.decidedBy).toBe(admin.id);

    // duplicate request while approved is rejected
    await expect(requestMembership(actorFor(therapist), site.id)).rejects.toMatchObject({ code: "ALREADY_EXISTS" });

    // invalid transition: APPROVED -> REJECTED
    await expect(decideMembership(actorFor(admin), { membershipId: m.id, status: "REJECTED" })).rejects.toMatchObject({
      code: "VALIDATION",
    });

    const rows = await listMemberships(actorFor(admin), { siteId: site.id });
    expect(rows).toHaveLength(1);
    expect(rows[0].userEmail).toBe(therapist.email);

    const audit = await listAuditEvents(actorFor(admin), { siteId: site.id });
    expect(audit.map((e) => e.action)).toEqual(["MEMBERSHIP_DECIDED", "MEMBERSHIP_REQUESTED"]);
  });

  it("rejected therapist may re-request", async () => {
    const site = await makeSite();
    const therapist = await makeUser();
    const admin = await makeUser({ role: "SUPER_ADMIN" });
    const m = await requestMembership(actorFor(therapist), site.id);
    await decideMembership(actorFor(admin), { membershipId: m.id, status: "REJECTED" });
    const again = await requestMembership(actorFor(therapist), site.id);
    expect(again.id).toBe(m.id);
    expect(again.status).toBe("PENDING");
  });
});

describe("rooms", () => {
  it("admin creates rooms; duplicate number is rejected; therapist is forbidden", async () => {
    const site = await makeSite();
    const admin = await makeUser({ role: "SUPER_ADMIN" });
    const therapist = await makeUser();

    const r1 = await createRoom(actorFor(admin), { siteId: site.id, roomNumber: "1" });
    const r2 = await createRoom(actorFor(admin), { siteId: site.id, roomNumber: "2" });
    expect(r2.displayOrder).toBe(r1.displayOrder + 1);

    await expect(createRoom(actorFor(admin), { siteId: site.id, roomNumber: "1" })).rejects.toMatchObject({
      code: "ALREADY_EXISTS",
    });
    await expect(createRoom(actorFor(therapist), { siteId: site.id, roomNumber: "9" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    await reorderRooms(actorFor(admin), { siteId: site.id, roomIds: [r2.id, r1.id] });
    const rows = await db.query.rooms.findMany({ where: eq(schema.rooms.siteId, site.id) });
    expect(rows.find((r) => r.id === r2.id)!.displayOrder).toBe(0);
  });

  it("refuses to deactivate a room with future confirmed bookings (AC-17)", async () => {
    const site = await makeSite();
    const admin = await makeUser({ role: "SUPER_ADMIN" });
    const therapist = await makeUser();
    await makeMembership(site.id, therapist.id);
    const room = await makeRoom(site.id);
    const start = new Date(Date.now() + 24 * 3600 * 1000);
    await db.insert(schema.bookings).values({
      id: randomUUID(),
      siteId: site.id,
      roomId: room.id,
      userId: therapist.id,
      startAt: start,
      endAt: new Date(start.getTime() + 3600 * 1000),
      bookingType: "REGULAR",
      createdBy: therapist.id,
      updatedBy: therapist.id,
    });
    await expect(setRoomStatus(actorFor(admin), { roomId: room.id, status: "INACTIVE" })).rejects.toMatchObject({
      code: "ROOM_HAS_FUTURE_BOOKINGS",
    });
  });
});

describe("sites", () => {
  it("admin updates settings with audit; therapist forbidden", async () => {
    const site = await makeSite();
    const admin = await makeUser({ role: "SUPER_ADMIN" });
    const therapist = await makeUser();
    const input = {
      siteId: site.id,
      name: "New",
      address: "Addr",
      bookingWindowDays: 30,
      cancellationCutoffMinutes: 60,
      status: "ACTIVE" as const,
    };
    await expect(updateSite(actorFor(therapist), input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const updated = await updateSite(actorFor(admin), input);
    expect(updated.bookingWindowDays).toBe(30);
    const audit = await listAuditEvents(actorFor(admin), { siteId: site.id });
    expect(audit[0].action).toBe("SITE_UPDATED");
    expect(audit[0].before).toMatchObject({ bookingWindowDays: 90 });
  });
});

describe("database constraints", () => {
  it("exclusion constraint rejects overlapping CONFIRMED bookings in the same room", async () => {
    const site = await makeSite();
    const u = await makeUser();
    const room = await makeRoom(site.id);
    const t0 = new Date("2030-01-01T10:00:00Z");
    const mk = (start: Date, end: Date, status: "CONFIRMED" | "CANCELLED" = "CONFIRMED") =>
      db.insert(schema.bookings).values({
        id: randomUUID(),
        siteId: site.id,
        roomId: room.id,
        userId: u.id,
        startAt: start,
        endAt: end,
        bookingType: "REGULAR",
        status,
        createdBy: u.id,
        updatedBy: u.id,
      });
    await mk(t0, new Date(t0.getTime() + 3600e3));
    // overlapping -> 23P01
    await expect(
      mk(new Date(t0.getTime() + 1800e3), new Date(t0.getTime() + 5400e3)).catch((e) => Promise.reject(pgErrorCode(e))),
    ).rejects.toBe("23P01");
    // adjacent [start,end) -> ok (AC-06)
    await mk(new Date(t0.getTime() + 3600e3), new Date(t0.getTime() + 7200e3));
    // overlapping but CANCELLED -> ok
    await mk(t0, new Date(t0.getTime() + 3600e3), "CANCELLED");
  });

  it("allows several SUPER_ADMIN users (managers can promote others)", async () => {
    await makeUser({ role: "SUPER_ADMIN" });
    await expect(makeUser({ role: "SUPER_ADMIN" })).resolves.toMatchObject({ globalRole: "SUPER_ADMIN" });
  });
});
