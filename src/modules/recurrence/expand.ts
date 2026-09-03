/** Pure expansion of a weekly series into occurrence instants. Shared by server and tests. */
import { addDays, localToUtc, parseDate, weekdayOf, type Range } from "@/lib/time";

export type ExpandInput = {
  weekday: number;
  startTime: string;
  endTime: string;
  startsOn: string;
  endsOn: string;
  tz: string;
};
export type Occurrence = { date: string; range: Range | null; invalid?: "INVALID_LOCAL_TIME" };

export const MAX_SERIES_WEEKS = 52;

export function expandSeries(input: ExpandInput): Occurrence[] {
  parseDate(input.startsOn);
  parseDate(input.endsOn);
  const out: Occurrence[] = [];
  // first date on/after startsOn with the requested weekday
  let date = input.startsOn;
  const offset = (input.weekday - weekdayOf(date) + 7) % 7;
  date = addDays(date, offset);
  while (date <= input.endsOn) {
    const start = localToUtc(date, input.startTime, input.tz);
    const end = localToUtc(date, input.endTime, input.tz);
    if (start && end && start < end) out.push({ date, range: { start, end } });
    else out.push({ date, range: null, invalid: "INVALID_LOCAL_TIME" });
    date = addDays(date, 7);
  }
  return out;
}
