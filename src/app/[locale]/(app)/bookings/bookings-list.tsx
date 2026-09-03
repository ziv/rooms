"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { useSiteFormat } from "@/components/calendar/format";
import type { MyBookingRow } from "@/modules/bookings/service";

type Row = Omit<MyBookingRow, "startAt" | "endAt"> & { startAt: string; endAt: string };

export function BookingsList({ rows }: { rows: Row[] }) {
  const t = useTranslations("booking");
  const tc = useTranslations("calendar");
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            href={`/bookings/${r.id}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 hover:bg-muted/50"
          >
            <RowTime row={r} />
            <span className="text-sm">
              {r.siteName} · {tc("room")} {r.roomNumber}
            </span>
            <span className="ms-auto flex gap-2">
              {r.bookingType === "SERIES" && <Badge variant="outline">{t("typeSERIES")}</Badge>}
              {r.status === "CANCELLED" && <Badge variant="secondary">{t("statusCANCELLED")}</Badge>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RowTime({ row }: { row: Row }) {
  const fmt = useSiteFormat(row.timezone);
  return (
    <span className="text-sm font-medium tabular-nums">
      {fmt.dateShort(row.startAt)} · {fmt.range(row.startAt, row.endAt)}
    </span>
  );
}
