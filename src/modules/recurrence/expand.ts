/** Pure expansion of a weekly / biweekly series into occurrence instants. Shared by server and tests. */
import { addDays, localToUtc, parseDate, weekdayOf, type Range } from "@/lib/time";

export type IntervalWeeks = 1 | 2;

export type ExpandInput = {
  weekday: number;
  startTime: string;
  endTime: string;
  startsOn: string;
  endsOn: string;
  tz: string;
  /** 1 = every week (default), 2 = every other week. */
  intervalWeeks?: IntervalWeeks;
  /**
   * Date that fixes the phase of a biweekly series (defaults to `startsOn`). Occurrences fall on
   * the weekday every `intervalWeeks` weeks counted from the first weekday on/after this date,
   * but only those on/after `startsOn` are returned.
   */
  anchorOn?: string;
};
export type Occurrence = { date: string; range: Range | null; invalid?: "INVALID_LOCAL_TIME" };

/** Longest series: 10 years (matches the `series_dates_check` DB constraint). */
export const MAX_SERIES_DAYS = 3653;

const daysBetween = (from: string, to: string): number => {
  const a = parseDate(from);
  const b = parseDate(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
};

/** First occurrence date on/after `from` for the given weekday, interval and phase anchor. */
export function firstOccurrenceOnOrAfter(input: {
  weekday: number;
  intervalWeeks?: IntervalWeeks;
  anchorOn: string;
  from: string;
}): string {
  const step = (input.intervalWeeks ?? 1) * 7;
  let date = addDays(input.anchorOn, (input.weekday - weekdayOf(input.anchorOn) + 7) % 7);
  if (date < input.from) date = addDays(date, Math.ceil(daysBetween(date, input.from) / step) * step);
  return date;
}

export function expandSeries(input: ExpandInput): Occurrence[] {
  parseDate(input.startsOn);
  parseDate(input.endsOn);
  const step = (input.intervalWeeks ?? 1) * 7;
  const out: Occurrence[] = [];
  let date = firstOccurrenceOnOrAfter({
    weekday: input.weekday,
    intervalWeeks: input.intervalWeeks,
    anchorOn: input.anchorOn ?? input.startsOn,
    from: input.startsOn,
  });
  while (date <= input.endsOn) {
    const start = localToUtc(date, input.startTime, input.tz);
    const end = localToUtc(date, input.endTime, input.tz);
    if (start && end && start < end) out.push({ date, range: { start, end } });
    else out.push({ date, range: null, invalid: "INVALID_LOCAL_TIME" });
    date = addDays(date, step);
  }
  return out;
}
