"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SeriesListRow = {
  id: string;
  userName: string | null;
  userEmail: string;
  siteName: string;
  roomNumber: string;
  weekday: number;
  intervalWeeks: number;
  startTime: string;
  endTime: string;
  startsOn: string;
  endsOn: string;
  status: "ACTIVE" | "ENDED" | "CANCELLED";
};

type SortKey = "therapist" | "site" | "room" | "weekday" | "frequency" | "startTime" | "startsOn" | "endsOn" | "status";
type Sort = { key: SortKey; dir: "asc" | "desc" };

const STATUS_ORDER: Record<SeriesListRow["status"], number> = { ACTIVE: 0, ENDED: 1, CANCELLED: 2 };
const text = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
const COMPARE: Record<SortKey, (a: SeriesListRow, b: SeriesListRow) => number> = {
  therapist: (a, b) => text(a.userName ?? a.userEmail, b.userName ?? b.userEmail),
  site: (a, b) => text(a.siteName, b.siteName),
  room: (a, b) => text(a.roomNumber, b.roomNumber),
  weekday: (a, b) => a.weekday - b.weekday,
  frequency: (a, b) => a.intervalWeeks - b.intervalWeeks,
  startTime: (a, b) => text(a.startTime, b.startTime) || text(a.endTime, b.endTime),
  startsOn: (a, b) => text(a.startsOn, b.startsOn),
  endsOn: (a, b) => text(a.endsOn, b.endsOn),
  status: (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
};
/** Default order: active first, newest start date first (same as the server query). */
const DEFAULT_SORT: Sort = { key: "status", dir: "asc" };
const tieBreak = (a: SeriesListRow, b: SeriesListRow) => COMPARE.startsOn(b, a);

export function SeriesTable({ rows }: { rows: SeriesListRow[] }) {
  const t = useTranslations("admin.series");
  const tw = useTranslations("weekdays");
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);

  const sorted = useMemo(() => {
    const cmp = COMPARE[sort.key];
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => sign * cmp(a, b) || tieBreak(a, b));
  }, [rows, sort]);

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const head = (key: SortKey, label: string) => {
    const active = sort.key === key;
    const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <TableHead aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button
          type="button"
          onClick={() => toggle(key)}
          className={cn(
            "inline-flex items-center gap-1 rounded-sm -mx-1 px-1 hover:text-foreground",
            active ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {label}
          <Icon className={cn("size-3.5", !active && "opacity-50")} aria-hidden />
        </button>
      </TableHead>
    );
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {head("therapist", t("therapist"))}
          {head("site", t("site"))}
          {head("room", t("room"))}
          {head("weekday", t("weekday"))}
          {head("frequency", t("frequency"))}
          {head("startTime", t("startTime"))}
          {head("startsOn", t("startsOn"))}
          {head("endsOn", t("endsOn"))}
          {head("status", t("status"))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((s) => (
          <TableRow key={s.id}>
            <TableCell>
              <Link href={`/admin/series/${s.id}`} className="underline">
                {s.userName ?? s.userEmail}
              </Link>
            </TableCell>
            <TableCell>{s.siteName}</TableCell>
            <TableCell>{s.roomNumber}</TableCell>
            <TableCell>{tw(String(s.weekday))}</TableCell>
            <TableCell>{t(s.intervalWeeks === 2 ? "everyTwoWeeks" : "everyWeek")}</TableCell>
            <TableCell dir="ltr" className="text-start">
              {s.startTime}–{s.endTime}
            </TableCell>
            <TableCell dir="ltr" className="text-start">
              {s.startsOn}
            </TableCell>
            <TableCell dir="ltr" className="text-start">
              {s.endsOn}
            </TableCell>
            <TableCell>
              <Badge variant={s.status === "ACTIVE" ? "default" : "secondary"}>{t(`status${s.status}`)}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
