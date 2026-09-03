"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { BlockModel } from "./day-model";
import { useSiteFormat } from "./format";

/** Visual + accessible label for a block. Status is conveyed by text/icon, never colour alone. */
export function BlockContent({
  block,
  timezone,
  compact = false,
}: {
  block: BlockModel;
  timezone: string;
  compact?: boolean;
}) {
  const t = useTranslations("calendar");
  const tb = useTranslations("booking");
  const fmt = useSiteFormat(timezone);
  const time = fmt.range(block.start, block.end);
  switch (block.kind) {
    case "BUSY":
      return (
        <span className="text-xs text-muted-foreground">
          ⛔ {t("busy")}
          {!compact && <span className="block">{time}</span>}
        </span>
      );
    case "CLOSED":
      return (
        <span className="text-xs text-muted-foreground">
          🚫 {t("closed")}
          {!compact && <span className="block">{time}</span>}
          {block.reason && <span className="block truncate">{block.reason}</span>}
        </span>
      );
    case "MINE":
      return (
        <Link href={`/bookings/${block.bookingId}`} className="block text-xs underline-offset-2 hover:underline">
          ★ {t("mine")}
          {block.type === "SERIES" && ` · ${t("series")}`}
          <span className="block">{time}</span>
        </Link>
      );
    case "BOOKING":
      return (
        <Link href={`/bookings/${block.bookingId}`} className="block text-xs underline-offset-2 hover:underline">
          👤 {block.user.fullName ?? tb("therapist")}
          {block.type === "SERIES" && ` · ${t("series")}`}
          <span className="block">{time}</span>
        </Link>
      );
  }
}

export const blockClass: Record<BlockModel["kind"], string> = {
  BUSY: "bg-muted border-border bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(0,0,0,0.05)_6px,rgba(0,0,0,0.05)_12px)]",
  CLOSED: "bg-muted/60 border-dashed border-border",
  MINE: "bg-primary/10 border-primary/40",
  BOOKING: "bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-900",
};
