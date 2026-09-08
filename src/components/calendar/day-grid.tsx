"use client";

import { useTranslations } from "next-intl";
import { addMinutes, MINUTES_PER_SLOT } from "@/lib/time";
import type { DayModel } from "./day-model";
import type { SlotSelection } from "./booking-dialog";
import { BlockContent, blockClass } from "./blocks";
import { useSiteFormat } from "./format";

const SLOT_PX = 12;

type Props = {
  model: DayModel;
  timezone: string;
  onSelect: (s: SlotSelection) => void;
  /** Fit every room into the viewport width (mobile all-rooms view): narrow columns, one-line blocks. */
  dense?: boolean;
};

/** Desktop day view: rooms as columns, 15-minute rows. Free cells are real buttons. */
export function DayGrid({ model, timezone, onSelect, dense = false }: Props) {
  const t = useTranslations("calendar");
  const fmt = useSiteFormat(timezone);
  const rows = model.slotCount;

  return (
    <div className="overflow-x-auto">
      <div
        className={`grid border rounded-lg bg-card ${dense ? "" : "min-w-[640px]"}`}
        style={{
          gridTemplateColumns: dense
            ? `2.5rem repeat(${model.rooms.length}, minmax(0, 1fr))`
            : `4rem repeat(${model.rooms.length}, minmax(9rem, 1fr))`,
          gridTemplateRows: `${dense ? "2rem" : "2.5rem"} repeat(${rows}, ${SLOT_PX}px)`,
        }}
        role="grid"
        aria-label={t("title")}
      >
        {/* header */}
        <div className="sticky top-0 z-10 bg-card border-b" />
        {model.rooms.map((r) => (
          <div
            key={r.roomId}
            className={`sticky top-0 z-10 bg-card border-b border-s flex items-center font-medium ${dense ? "px-1 text-xs truncate" : "px-2 text-sm"}`}
            role="columnheader"
          >
            {dense ? r.roomNumber : `${t("room")} ${r.roomNumber}`}
          </div>
        ))}

        {/* hour labels + lines */}
        {model.hourTicks.map((tick) => (
          <div
            key={tick.idx}
            className={`text-muted-foreground text-end border-t -mt-px ${dense ? "text-[10px] pe-1" : "text-xs pe-2"}`}
            style={{ gridColumn: 1, gridRow: `${tick.idx + 2} / span 4` }}
          >
            {fmt.time(tick.at)}
          </div>
        ))}

        {model.rooms.map((room, col) => (
          <div key={room.roomId} className="contents">
            {/* free cells */}
            {Array.from({ length: rows }, (_, i) => {
              const at = addMinutes(model.gridStart, i * MINUTES_PER_SLOT);
              const valid = room.validStarts.has(i);
              const hourLine = i % 4 === 0 ? "border-t" : "";
              return (
                <button
                  key={i}
                  type="button"
                  role="gridcell"
                  disabled={!valid}
                  aria-label={t("slotLabel", { room: room.roomNumber, time: fmt.time(at) })}
                  onClick={() => onSelect({ roomId: room.roomId, start: at })}
                  className={`border-s ${hourLine} ${valid ? "hover:bg-primary/10 focus-visible:bg-primary/10 cursor-pointer" : "cursor-default"} outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                  style={{ gridColumn: col + 2, gridRow: i + 2 }}
                />
              );
            })}
            {/* blocks overlay */}
            {room.blocks.map((b, j) =>
              b.endIdx > b.startIdx ? (
                <div
                  key={`${b.kind}-${j}`}
                  className={`m-px rounded border overflow-hidden ${dense ? "px-0.5" : "px-1.5 py-0.5"} ${blockClass[b.kind]}`}
                  style={{ gridColumn: col + 2, gridRow: `${b.startIdx + 2} / ${b.endIdx + 2}`, zIndex: 1 }}
                >
                  <BlockContent block={b} timezone={timezone} compact={b.endIdx - b.startIdx < 4} dense={dense} />
                </div>
              ) : null,
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
