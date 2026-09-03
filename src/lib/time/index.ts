import { TZDate } from "@date-fns/tz";

export type Range = { start: Date; end: Date };
export type LocalDateTime = { date: string; time: string; weekday: number };

const pad = (n: number) => String(n).padStart(2, "0");

export function parseDate(date: string): { y: number; m: number; d: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Invalid date: ${date}`);
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

export function parseTime(time: string): { hh: number; mm: number } {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) throw new Error(`Invalid time: ${time}`);
  return { hh: Number(m[1]), mm: Number(m[2]) };
}

/** Converts a UTC instant to the site's local wall-clock date/time and weekday (0 = Sunday). */
export function utcToLocal(instant: Date, tz: string): LocalDateTime {
  const z = new TZDate(instant, tz);
  return {
    date: `${z.getFullYear()}-${pad(z.getMonth() + 1)}-${pad(z.getDate())}`,
    time: `${pad(z.getHours())}:${pad(z.getMinutes())}`,
    weekday: z.getDay(),
  };
}

/**
 * Converts local wall-clock date + time (HH:mm) to a UTC instant.
 * Returns null when the local time does not exist (DST spring-forward gap).
 * Ambiguous times (fall-back overlap) resolve to whatever TZDate picks; callers accept that.
 */
export function localToUtc(date: string, time: string, tz: string): Date | null {
  const { y, m, d } = parseDate(date);
  const { hh, mm } = parseTime(time);
  const z = new TZDate(y, m - 1, d, hh, mm, 0, 0, tz);
  const instant = new Date(z.getTime());
  const back = utcToLocal(instant, tz);
  if (back.date !== date || back.time !== time) return null;
  return instant;
}

/** [00:00, 24:00) of a local calendar day, as UTC instants. */
export function dayBounds(date: string, tz: string): Range {
  const start = localToUtc(date, "00:00", tz);
  const end = localToUtc(addDays(date, 1), "00:00", tz);
  if (!start || !end) throw new Error(`Cannot compute day bounds for ${date}`);
  return { start, end };
}

export function addDays(date: string, n: number): string {
  const { y, m, d } = parseDate(date);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function weekdayOf(date: string): number {
  const { y, m, d } = parseDate(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function todayLocal(tz: string, now: Date = new Date()): string {
  return utcToLocal(now, tz).date;
}

export const timeToMinutes = (time: string): number => {
  const { hh, mm } = parseTime(time);
  return hh * 60 + mm;
};
export const minutesToTime = (n: number): string => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;

export const isOnQuarter = (time: string): boolean => parseTime(time).mm % 15 === 0;

/** Half-open interval overlap: [a.start, a.end) ∩ [b.start, b.end) ≠ ∅ */
export const overlaps = (a: Range, b: Range): boolean => a.start < b.end && b.start < a.end;

export const containedIn = (inner: Range, outer: Range): boolean =>
  outer.start <= inner.start && inner.end <= outer.end;

export const addMinutes = (d: Date, minutes: number): Date => new Date(d.getTime() + minutes * 60_000);

export const MINUTES_PER_SLOT = 15;
export const REGULAR_BOOKING_MINUTES = 60;
