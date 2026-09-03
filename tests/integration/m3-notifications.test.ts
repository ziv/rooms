import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { localToUtc } from "@/lib/time";
import { createBooking } from "@/modules/bookings/service";
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
