import { describe, expect, it } from "vitest";
import { addDays, containedIn, dayBounds, isOnQuarter, localToUtc, overlaps, utcToLocal, weekdayOf } from "@/lib/time";
import { validStartTimes } from "@/lib/slots";

const TZ = "Asia/Jerusalem";

describe("localToUtc / utcToLocal", () => {
  it("winter (UTC+2)", () => {
    expect(localToUtc("2026-01-15", "10:00", TZ)?.toISOString()).toBe("2026-01-15T08:00:00.000Z");
  });
  it("summer (UTC+3)", () => {
    expect(localToUtc("2026-07-15", "10:00", TZ)?.toISOString()).toBe("2026-07-15T07:00:00.000Z");
  });
  it("spring-forward gap (2026-03-27 02:00→03:00) does not exist", () => {
    expect(localToUtc("2026-03-27", "02:30", TZ)).toBeNull();
    expect(localToUtc("2026-03-27", "01:45", TZ)?.toISOString()).toBe("2026-03-26T23:45:00.000Z");
    expect(localToUtc("2026-03-27", "03:00", TZ)?.toISOString()).toBe("2026-03-27T00:00:00.000Z");
  });
  it("fall-back day (2026-10-25) resolves and round-trips for unambiguous times", () => {
    expect(localToUtc("2026-10-25", "10:00", TZ)?.toISOString()).toBe("2026-10-25T08:00:00.000Z");
    expect(localToUtc("2026-10-24", "10:00", TZ)?.toISOString()).toBe("2026-10-24T07:00:00.000Z");
  });
  it("utcToLocal gives local wall clock and weekday", () => {
    const l = utcToLocal(new Date("2026-09-03T21:30:00Z"), TZ); // Thursday 00:30 local (UTC+3)
    expect(l).toEqual({ date: "2026-09-04", time: "00:30", weekday: 5 });
  });
});

describe("day helpers", () => {
  it("dayBounds spans 24h except on DST days", () => {
    const normal = dayBounds("2026-09-03", TZ);
    expect(normal.end.getTime() - normal.start.getTime()).toBe(24 * 3600e3);
    const springForward = dayBounds("2026-03-27", TZ);
    expect(springForward.end.getTime() - springForward.start.getTime()).toBe(23 * 3600e3);
    const fallBack = dayBounds("2026-10-25", TZ);
    expect(fallBack.end.getTime() - fallBack.start.getTime()).toBe(25 * 3600e3);
  });
  it("addDays and weekdayOf", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(weekdayOf("2026-09-06")).toBe(0); // Sunday
  });
  it("isOnQuarter", () => {
    expect(isOnQuarter("10:15")).toBe(true);
    expect(isOnQuarter("10:20")).toBe(false);
  });
});

describe("ranges", () => {
  const r = (a: string, b: string) => ({ start: new Date(a), end: new Date(b) });
  it("adjacent [start,end) ranges do not overlap (AC-06)", () => {
    expect(overlaps(r("2026-01-01T10:00Z", "2026-01-01T11:00Z"), r("2026-01-01T11:00Z", "2026-01-01T12:00Z"))).toBe(
      false,
    );
    expect(overlaps(r("2026-01-01T10:00Z", "2026-01-01T11:00Z"), r("2026-01-01T10:30Z", "2026-01-01T11:30Z"))).toBe(
      true,
    );
  });
  it("containedIn", () => {
    expect(containedIn(r("2026-01-01T10:00Z", "2026-01-01T11:00Z"), r("2026-01-01T08:00Z", "2026-01-01T13:00Z"))).toBe(
      true,
    );
    expect(containedIn(r("2026-01-01T12:30Z", "2026-01-01T13:30Z"), r("2026-01-01T08:00Z", "2026-01-01T13:00Z"))).toBe(
      false,
    );
  });
});

describe("validStartTimes", () => {
  const r = (a: string, b: string) => ({ start: new Date(a), end: new Date(b) });
  it("15-minute steps that fit inside a segment, excluding blocked ranges", () => {
    const starts = validStartTimes({
      openSegments: [r("2026-01-01T08:00Z", "2026-01-01T10:00Z")],
      blocks: [r("2026-01-01T08:30Z", "2026-01-01T09:00Z")],
      durationMinutes: 60,
      window: null,
    }).map((d) => d.toISOString().slice(11, 16));
    // 08:00 overlaps block; 08:15 overlaps; 08:30/08:45 overlap; 09:00 ok; 09:15+ would end after 10:00
    expect(starts).toEqual(["09:00"]);
  });
  it("respects the booking window", () => {
    const starts = validStartTimes({
      openSegments: [r("2026-01-01T08:00Z", "2026-01-01T12:00Z")],
      blocks: [],
      durationMinutes: 60,
      window: { from: new Date("2026-01-01T09:10Z"), to: new Date("2026-01-01T10:00Z") },
    }).map((d) => d.toISOString().slice(11, 16));
    expect(starts).toEqual(["09:15", "09:30", "09:45", "10:00"]);
  });
});
