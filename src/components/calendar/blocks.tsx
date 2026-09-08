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
  dense = false,
}: {
  block: BlockModel;
  timezone: string;
  /** Hide the time range on busy/closed blocks (short blocks in the grid). */
  compact?: boolean;
  /** One truncated line, icon + name only (mobile all-rooms grid). */
  dense?: boolean;
}) {
  const t = useTranslations("calendar");
  const tb = useTranslations("booking");
  const fmt = useSiteFormat(timezone);
  const time = fmt.range(block.start, block.end);
  if (dense) {
    const label =
      block.kind === "BUSY"
        ? `⛔ ${t("busy")}`
        : block.kind === "CLOSED"
          ? `🚫 ${block.reason ?? t("closed")}`
          : block.kind === "MINE"
            ? `★ ${t("mine")}`
            : `👤 ${block.user.fullName ?? tb("therapist")}`;
    const cls = "block text-[10px] leading-tight truncate";
    return block.kind === "MINE" || block.kind === "BOOKING" ? (
      <Link href={`/bookings/${block.bookingId}`} className={cls} title={`${label} · ${time}`}>
        {label}
      </Link>
    ) : (
      <span className={`${cls} text-muted-foreground`} title={`${label} · ${time}`}>
        {label}
      </span>
    );
  }
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
  MINE: "bg-secondary border-primary/40",
  BOOKING: "bg-accent border-accent-foreground/20",
};
