import { describe, expect, it } from "vitest";
import { expandSeries } from "@/modules/recurrence/expand";

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
