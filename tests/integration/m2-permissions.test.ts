import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { decideMembership, listMemberships, listApprovedMembers } from "@/modules/memberships/service";
import { createRoom, updateRoom, setRoomStatus, reorderRooms } from "@/modules/rooms/service";
import { updateSite } from "@/modules/sites/service";
import { setOpeningHours } from "@/modules/opening-hours/service";
import { createClosure, deleteClosure } from "@/modules/closures/service";
import {
  previewSeries,
  createSeries,
  splitSeries,
  cancelSeries,
  listSeries,
  getSeries,
} from "@/modules/recurrence/service";
import { listAuditEvents } from "@/modules/audit/service";
import { getDayAvailability } from "@/modules/availability/service";
import { createBooking } from "@/modules/bookings/service";
import {
  actorFor,
  futureDate,
  makeMembership,
  makeOpeningHours,
  makeRoom,
  makeSite,
  makeUser,
  resetDb,
} from "./helpers";

beforeEach(resetDb);

/** Every admin-only operation must reject a therapist actor with FORBIDDEN (AC-02, negative permissions). */
describe("admin operations are forbidden for therapists", () => {
  it("sweep", async () => {
    const site = await makeSite();
    await makeOpeningHours(site.id);
    const room = await makeRoom(site.id);
    const therapist = await makeUser();
    await makeMembership(site.id, therapist.id);
    const t = actorFor(therapist, [{ siteId: site.id, status: "APPROVED" }]);
    const id = randomUUID();
    const seriesBase = {
      siteId: site.id,
      roomId: room.id,
      userId: therapist.id,
      weekday: 1,
      intervalWeeks: 1 as const,
      startTime: "09:00",
      endTime: "12:00",
      startsOn: futureDate(7),
      endsOn: futureDate(30),
      note: null,
    };

    const ops: [string, () => Promise<unknown>][] = [
      ["decideMembership", () => decideMembership(t, { membershipId: id, status: "APPROVED" })],
      ["listMemberships", () => listMemberships(t)],
      ["listApprovedMembers", () => listApprovedMembers(t, site.id)],
      ["createRoom", () => createRoom(t, { siteId: site.id, roomNumber: "x" })],
      ["updateRoom", () => updateRoom(t, { roomId: room.id, roomNumber: "y" })],
      ["setRoomStatus", () => setRoomStatus(t, { roomId: room.id, status: "INACTIVE" })],
      ["reorderRooms", () => reorderRooms(t, { siteId: site.id, roomIds: [room.id] })],
      [
        "updateSite",
        () =>
          updateSite(t, {
            siteId: site.id,
            name: "n",
            address: "a",
            cancellationCutoffMinutes: 0,
            status: "ACTIVE",
          }),
      ],
      ["setOpeningHours", () => setOpeningHours(t, { siteId: site.id, weekday: 0, segments: [] })],
      [
        "createClosure",
        () =>
          createClosure(t, {
            siteId: site.id,
            roomId: null,
            startAt: new Date(),
            endAt: new Date(Date.now() + 3600e3),
            cancelConflicts: false,
          }),
      ],
      ["deleteClosure", () => deleteClosure(t, id)],
      ["previewSeries", () => previewSeries(t, seriesBase)],
      ["createSeries", () => createSeries(t, { ...seriesBase, skipConflicts: false })],
      [
        "splitSeries",
        () => splitSeries(t, { seriesId: id, fromDate: futureDate(8), changes: {}, skipConflicts: false }),
      ],
      ["cancelSeries", () => cancelSeries(t, { seriesId: id })],
      ["listSeries", () => listSeries(t)],
      ["getSeries", () => getSeries(t, id)],
      ["listAuditEvents", () => listAuditEvents(t)],
      [
        "createBooking for someone else",
        () =>
          createBooking(t, {
            id,
            siteId: site.id,
            roomId: room.id,
            startAt: new Date(),
            note: null,
            forUserId: randomUUID(),
          }),
      ],
    ];
    for (const [name, op] of ops) {
      const err = await op().then(
        () => null,
        (e) => e,
      );
      expect(err, name).not.toBeNull();
      expect(err.code, name).toBe("FORBIDDEN");
    }

    // and a non-member cannot even read another site's availability
    const other = await makeSite("other");
    await expect(getDayAvailability(t, { siteId: other.id, date: futureDate(1) })).rejects.toMatchObject({
      code: "MEMBER_NOT_APPROVED",
    });
  });
});
