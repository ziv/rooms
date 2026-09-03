"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useSiteFormat } from "@/components/calendar/format";
import type { DayAvailability } from "@/modules/availability/types";

export function TodayList({ day }: { day: DayAvailability }) {
  const t = useTranslations("admin.dashboard");
  const tc = useTranslations("calendar");
  const fmt = useSiteFormat(day.timezone);
  const items = day.rooms
    .flatMap((r) =>
      r.blocks
        .filter((b): b is Extract<typeof b, { kind: "BOOKING" | "MINE" }> => b.kind === "BOOKING" || b.kind === "MINE")
        .map((b) => ({ room: r.roomNumber, block: b })),
    )
    .sort((a, b) => a.block.start.localeCompare(b.block.start));
  if (items.length === 0) return <p className="text-muted-foreground">{t("noBookings")}</p>;
  return (
    <ul className="divide-y">
      {items.map(({ room, block }) => (
        <li key={block.bookingId} className="py-1 flex gap-3">
          <span className="tabular-nums">{fmt.range(block.start, block.end)}</span>
          <span>
            {tc("room")} {room}
          </span>
          {block.kind === "BOOKING" && (
            <Link href={`/bookings/${block.bookingId}`} className="underline">
              {block.user.fullName ?? "?"}
            </Link>
          )}
          {block.kind === "MINE" && (
            <Link href={`/bookings/${block.bookingId}`} className="underline">
              {tc("mine")}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
