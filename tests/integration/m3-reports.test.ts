import { beforeEach, describe, expect, it } from "vitest";
import { localToUtc } from "@/lib/time";
import { bookingsDetail, hoursSummary } from "@/modules/reports/service";
import { actorFor, makeBooking, makeRoom, makeSite, makeUser, resetDb, TZ } from "./helpers";

beforeEach(resetDb);

describe("reports (AC-15)", () => {
  it("sums planned hours per therapist and room; a 3-hour series occurrence counts 3; cancelled excluded; site filter works", async () => {
    const siteA = await makeSite("A");
    const siteB = await makeSite("B");
    const roomA = await makeRoom(siteA.id, "1");
    const roomB = await makeRoom(siteB.id, "1");
    const admin = await makeUser({ role: "SUPER_ADMIN" });
    const t1 = await makeUser({ fullName: "T1" });
    const t2 = await makeUser({ fullName: "T2" });
    const at = (d: string, h: string) => localToUtc(d, h, TZ)!;
    await makeBooking({ siteId: siteA.id, roomId: roomA.id, userId: t1.id, startAt: at("2026-05-04", "10:00") });
    await makeBooking({
      siteId: siteA.id,
      roomId: roomA.id,
      userId: t1.id,
      startAt: at("2026-05-05", "09:00"),
      minutes: 180,
      type: "REGULAR",
    });
    await makeBooking({
      siteId: siteA.id,
      roomId: roomA.id,
      userId: t2.id,
      startAt: at("2026-05-06", "10:00"),
      status: "CANCELLED",
    });
    await makeBooking({ siteId: siteB.id, roomId: roomB.id, userId: t2.id, startAt: at("2026-05-07", "10:00") });
    await makeBooking({ siteId: siteB.id, roomId: roomB.id, userId: t2.id, startAt: at("2026-06-01", "10:00") }); // outside range

    const a = actorFor(admin);
    const all = await hoursSummary(a, { from: "2026-05-01", to: "2026-05-31" });
    expect(all.totalHours).toBe(5);
    expect(all.byTherapist.find((r) => r.label === "T1")?.totalHours).toBe(4);
    expect(all.byTherapist.find((r) => r.label === "T2")?.totalHours).toBe(1);
    expect(all.byRoom).toHaveLength(2);

    const onlyA = await hoursSummary(a, { from: "2026-05-01", to: "2026-05-31", siteId: siteA.id });
    expect(onlyA.totalHours).toBe(4);
    expect(onlyA.byRoom).toHaveLength(1);

    const detail = await bookingsDetail(a, { from: "2026-05-01", to: "2026-05-31" }, { limit: 100, offset: 0 });
    expect(detail).toHaveLength(4); // includes the cancelled one
    expect(detail.filter((r) => r.status === "CANCELLED")).toHaveLength(1);
    const cancelledOnly = await bookingsDetail(
      a,
      { from: "2026-05-01", to: "2026-05-31", status: "CANCELLED" },
      { limit: 100, offset: 0 },
    );
    expect(cancelledOnly).toHaveLength(1);

    await expect(hoursSummary(actorFor(t1), { from: "2026-05-01", to: "2026-05-31" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
