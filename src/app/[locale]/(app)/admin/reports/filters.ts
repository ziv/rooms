import { reportFilterSchema, type ReportFilter } from "@/lib/validation/reports";
import { addDays, todayLocal } from "@/lib/time";

export type RawFilter = Record<string, string | undefined>;

/** Parses search params into a report filter; defaults to the current month. */
export function parseFilter(raw: RawFilter): ReportFilter {
  const today = todayLocal("Asia/Jerusalem");
  const monthStart = today.slice(0, 8) + "01";
  const candidate = {
    from: raw.from || monthStart,
    to: raw.to || addDays(monthStart, 40).slice(0, 8) + "01",
    siteId: raw.site || undefined,
    roomId: raw.room || undefined,
    userId: raw.user || undefined,
    bookingType: raw.type || undefined,
    status: raw.status || undefined,
  };
  // default `to` = last day of month
  if (!raw.to) candidate.to = addDays(candidate.to, -1);
  const parsed = reportFilterSchema.safeParse(candidate);
  return parsed.success
    ? parsed.data
    : { from: monthStart, to: addDays(addDays(monthStart, 40).slice(0, 8) + "01", -1) };
}

export function filterToQuery(f: ReportFilter): Record<string, string> {
  const q: Record<string, string> = { from: f.from, to: f.to };
  if (f.siteId) q.site = f.siteId;
  if (f.roomId) q.room = f.roomId;
  if (f.userId) q.user = f.userId;
  if (f.bookingType) q.type = f.bookingType;
  if (f.status) q.status = f.status;
  return q;
}
