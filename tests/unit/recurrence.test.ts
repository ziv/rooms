import { describe, expect, it } from "vitest";
import { expandSeries, firstOccurrenceOnOrAfter } from "@/modules/recurrence/expand";

const TZ = "Asia/Jerusalem";

describe("expandSeries", () => {
  it("produces one occurrence per week on the weekday, inclusive of endsOn", () => {
    const occ = expandSeries({
      weekday: 1,
      startTime: "09:00",
      endTime: "12:00",
      startsOn: "2026-09-01",
      endsOn: "2026-09-28",
      tz: TZ,
    });
    expect(occ.map((o) => o.date)).toEqual(["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"]);
    expect(occ[0].range?.start.toISOString()).toBe("2026-09-07T06:00:00.000Z");
    expect(occ[0].range?.end.toISOString()).toBe("2026-09-07T09:00:00.000Z");
  });
  it("starts on startsOn itself when it matches the weekday", () => {
    const occ = expandSeries({
      weekday: 0,
      startTime: "10:00",
      endTime: "11:00",
      startsOn: "2026-09-06",
      endsOn: "2026-09-06",
      tz: TZ,
    });
    expect(occ.map((o) => o.date)).toEqual(["2026-09-06"]);
  });
  it("crosses the DST change with correct UTC offsets", () => {
    const occ = expandSeries({
      weekday: 5,
      startTime: "10:00",
      endTime: "11:00",
      startsOn: "2026-10-20",
      endsOn: "2026-10-31",
      tz: TZ,
    });
    expect(occ.map((o) => o.range?.start.toISOString())).toEqual([
      "2026-10-23T07:00:00.000Z",
      "2026-10-30T08:00:00.000Z",
    ]);
  });
  it("flags a start inside the spring-forward gap", () => {
    const occ = expandSeries({
      weekday: 5,
      startTime: "02:30",
      endTime: "04:00",
      startsOn: "2026-03-27",
      endsOn: "2026-03-27",
      tz: TZ,
    });
    expect(occ[0].invalid).toBe("INVALID_LOCAL_TIME");
  });
  it("produces one occurrence every other week when intervalWeeks is 2", () => {
    const occ = expandSeries({
      weekday: 1,
      intervalWeeks: 2,
      startTime: "09:00",
      endTime: "12:00",
      startsOn: "2026-09-01",
      endsOn: "2026-10-31",
      tz: TZ,
    });
    expect(occ.map((o) => o.date)).toEqual(["2026-09-07", "2026-09-21", "2026-10-05", "2026-10-19"]);
  });
  it("keeps the phase of a biweekly series when regenerating from a later date (anchorOn)", () => {
    const base = { weekday: 1, intervalWeeks: 2 as const, startTime: "09:00", endTime: "12:00", tz: TZ };
    // Regenerating from an "off" week must skip to the next on-cadence Monday, not the next Monday.
    const occ = expandSeries({ ...base, anchorOn: "2026-09-01", startsOn: "2026-09-14", endsOn: "2026-10-31" });
    expect(occ.map((o) => o.date)).toEqual(["2026-09-21", "2026-10-05", "2026-10-19"]);
    // From an "on" week it starts right there.
    const occ2 = expandSeries({ ...base, anchorOn: "2026-09-01", startsOn: "2026-09-21", endsOn: "2026-10-31" });
    expect(occ2.map((o) => o.date)).toEqual(["2026-09-21", "2026-10-05", "2026-10-19"]);
    expect(firstOccurrenceOnOrAfter({ weekday: 1, intervalWeeks: 2, anchorOn: "2026-09-01", from: "2026-09-14" })).toBe(
      "2026-09-21",
    );
    expect(firstOccurrenceOnOrAfter({ weekday: 1, intervalWeeks: 2, anchorOn: "2026-09-01", from: "2026-09-21" })).toBe(
      "2026-09-21",
    );
  });
  it("returns nothing when no weekday falls in range", () => {
    expect(
      expandSeries({
        weekday: 3,
        startTime: "10:00",
        endTime: "11:00",
        startsOn: "2026-09-07",
        endsOn: "2026-09-08",
        tz: TZ,
      }),
    ).toEqual([]);
  });
});
