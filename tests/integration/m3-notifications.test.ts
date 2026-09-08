import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { localToUtc } from "@/lib/time";
import { cancelBooking, createBooking, moveBooking } from "@/modules/bookings/service";
import { decideMembership, requestMembership } from "@/modules/memberships/service";
import { flushNotifications, MAX_ATTEMPTS, type Mailer } from "@/modules/notifications/sender";
import { renderEmail } from "@/modules/notifications/templates";
import {
  actorFor,
  futureDate,
  makeMembership,
  makeOpeningHours,
  makeRoom,
  makeSite,
  makeUser,
  resetDb,
  TZ,
} from "./helpers";

beforeEach(resetDb);

describe("notifications", () => {
  it("booking creation enqueues an email that is sent with an ICS attachment; retries on failure up to MAX_ATTEMPTS", async () => {
    const site = await makeSite();
    await makeOpeningHours(site.id);
    const room = await makeRoom(site.id);
    const t1 = await makeUser({ email: "t1@test.local", fullName: "T1" });
    await makeMembership(site.id, t1.id);
    const actor = actorFor(t1, [{ siteId: site.id, status: "APPROVED" }]);
    await createBooking(actor, {
      id: randomUUID(),
      siteId: site.id,
      roomId: room.id,
      startAt: localToUtc(futureDate(5), "10:00", TZ)!,
      note: null,
    });

    const sentMessages: Parameters<Mailer>[0][] = [];
    const okMailer: Mailer = async (m) => {
      sentMessages.push(m);
    };
    let calls = 0;
    const failingMailer: Mailer = async () => {
      calls++;
      throw new Error("smtp down");
    };

    // fail several times
    for (let i = 0; i < MAX_ATTEMPTS + 2; i++) await flushNotifications({ mailer: failingMailer });
    const row = await db.query.notifications.findFirst();
    expect(row?.status).toBe("FAILED");
    expect(row?.attempts).toBe(MAX_ATTEMPTS);
    expect(row?.lastError).toContain("smtp down");
    expect(calls).toBe(MAX_ATTEMPTS); // no more attempts after the cap

    // reset attempts to simulate an operator retry, then succeed
    await db.update(schema.notifications).set({ attempts: 0 }).where(eq(schema.notifications.id, row!.id));
    const res = await flushNotifications({ mailer: okMailer });
    expect(res).toEqual({ sent: 1, failed: 0, skipped: 0 });
    expect(sentMessages[0].to).toBe("t1@test.local");
    expect(sentMessages[0].subject).toBe("אישור הזמנת חדר");
    expect(sentMessages[0].html).toContain('dir="rtl"');
    expect(sentMessages[0].attachments?.[0].content).toContain("BEGIN:VCALENDAR");
    const after = await db.query.notifications.findFirst();
    expect(after?.status).toBe("SENT");
    // idempotent: nothing left to send
    expect(await flushNotifications({ mailer: okMailer })).toEqual({ sent: 0, failed: 0, skipped: 0 });
  });

  it("membership request notifies the admin; decision notifies the therapist in their locale", async () => {
    const site = await makeSite();
    const admin = await makeUser({ role: "SUPER_ADMIN", email: "admin@test.local" });
    const t = await makeUser({ email: "t@test.local" });
    await db.update(schema.users).set({ preferredLocale: "en" }).where(eq(schema.users.id, t.id));
    const m = await requestMembership(actorFor(t), site.id);
    await decideMembership(actorFor(admin), { membershipId: m.id, status: "APPROVED" });
    const sent: Parameters<Mailer>[0][] = [];
    await flushNotifications({ mailer: async (msg) => void sent.push(msg) });
    expect(sent.map((s) => s.to).sort()).toEqual(["admin@test.local", "t@test.local"]);
    const toTherapist = sent.find((s) => s.to === "t@test.local")!;
    expect(toTherapist.subject).toBe("Your membership request was updated");
    expect(toTherapist.text).toContain("approved");
  });

  it("therapist booking actions notify every active manager; admin actions do not", async () => {
    const site = await makeSite();
    await makeOpeningHours(site.id);
    const room1 = await makeRoom(site.id, "1", 0);
    const room2 = await makeRoom(site.id, "2", 1);
    const admin1 = await makeUser({ email: "a1@test.local", role: "SUPER_ADMIN", fullName: "A1" });
    const admin2 = await makeUser({ email: "a2@test.local", role: "SUPER_ADMIN", fullName: "A2" });
    await db.update(schema.users).set({ preferredLocale: "en" }).where(eq(schema.users.id, admin2.id));
    const t1 = await makeUser({ email: "t1@test.local", fullName: "T1" });
    await makeMembership(site.id, t1.id);
    const therapist = actorFor(t1, [{ siteId: site.id, status: "APPROVED" }]);
    const adminNotes = (type: string) =>
      db.query.notifications.findMany({ where: eq(schema.notifications.type, type) });

    const booking = await createBooking(therapist, {
      id: randomUUID(),
      siteId: site.id,
      roomId: room1.id,
      startAt: localToUtc(futureDate(5), "10:00", TZ)!,
      note: null,
    });
    const created = await adminNotes("BOOKING_CREATED_BY_THERAPIST");
    expect(created.map((n) => n.userId).sort()).toEqual([admin1.id, admin2.id].sort());
    expect(created.find((n) => n.userId === admin2.id)?.locale).toBe("en");
    expect(created[0].payload).toMatchObject({ userName: "T1", roomNumber: "1", bookingId: booking.id });

    await moveBooking(therapist, {
      bookingId: booking.id,
      roomId: room2.id,
      startAt: localToUtc(futureDate(5), "12:00", TZ)!,
    });
    const moved = await adminNotes("BOOKING_MOVED_BY_THERAPIST");
    expect(moved).toHaveLength(2);
    expect(moved[0].payload).toMatchObject({ roomNumber: "2", previous: { roomNumber: "1" } });
    const rendered = renderEmail(
      "BOOKING_MOVED_BY_THERAPIST",
      "en",
      moved[0].payload as Record<string, unknown>,
      "https://x",
    );
    expect(rendered.subject).toBe("Booking changed: T1");
    expect(rendered.text).toContain("Previously:");
    expect(rendered.text).toContain("room 1");

    await cancelBooking(therapist, { bookingId: booking.id, reason: "sick" });
    const cancelled = await adminNotes("BOOKING_CANCELLED_BY_THERAPIST");
    expect(cancelled).toHaveLength(2);
    expect(
      renderEmail("BOOKING_CANCELLED_BY_THERAPIST", "he", cancelled[0].payload as Record<string, unknown>, "https://x")
        .text,
    ).toContain("סיבה: sick");

    // An admin booking for themselves is not a therapist action: no manager email.
    await makeMembership(site.id, admin1.id);
    const adminActor = actorFor(admin1, [{ siteId: site.id, status: "APPROVED" }]);
    const own = await createBooking(adminActor, {
      id: randomUUID(),
      siteId: site.id,
      roomId: room1.id,
      startAt: localToUtc(futureDate(6), "10:00", TZ)!,
      note: null,
    });
    await cancelBooking(adminActor, { bookingId: own.id });
    expect(await adminNotes("BOOKING_CREATED_BY_THERAPIST")).toHaveLength(2);
    expect(await adminNotes("BOOKING_CANCELLED_BY_THERAPIST")).toHaveLength(2);
  });

  it("templates render every type without throwing", () => {
    const payload = {
      siteName: "S",
      siteAddress: "A",
      roomNumber: "1",
      startAt: "2026-09-10T07:00:00.000Z",
      endAt: "2026-09-10T08:00:00.000Z",
      bookingId: randomUUID(),
      timezone: TZ,
      weekday: 2,
      startTime: "09:00",
      endTime: "12:00",
      startsOn: "2026-09-01",
      endsOn: "2026-12-01",
      created: 10,
      skipped: ["2026-10-01"],
      reason: "x",
      status: "APPROVED",
      userName: "U",
      userEmail: "u@x",
      fromDate: "2026-10-01",
      previous: { startAt: "2026-09-09T07:00:00.000Z", endAt: "2026-09-09T08:00:00.000Z", roomNumber: "2" },
    };
    for (const type of [
      "MEMBERSHIP_REQUESTED",
      "MEMBERSHIP_DECIDED",
      "BOOKING_CREATED",
      "BOOKING_CHANGED_BY_ADMIN",
      "BOOKING_CANCELLED_BY_ADMIN",
      "BOOKING_CANCELLED_BY_CLOSURE",
      "SERIES_CREATED",
      "SERIES_CHANGED",
      "SERIES_CANCELLED",
      "OCCURRENCE_CANCELLED_BY_THERAPIST",
      "BOOKING_CREATED_BY_THERAPIST",
      "BOOKING_MOVED_BY_THERAPIST",
      "BOOKING_CANCELLED_BY_THERAPIST",
    ] as const) {
      for (const locale of ["he", "en"]) {
        const r = renderEmail(type, locale, payload, "https://x");
        expect(r.subject.length).toBeGreaterThan(3);
        expect(r.html).toContain("https://x/");
        expect(r.text).not.toMatch(/\{\w+\}/); // no unfilled placeholders
      }
    }
  });
});
