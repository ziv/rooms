"use client";

import { useTranslations } from "next-intl";
import { addMinutes, MINUTES_PER_SLOT } from "@/lib/time";
import type { DayModel } from "./day-model";
import type { SlotSelection } from "./booking-dialog";
import { BlockContent, blockClass } from "./blocks";
import { useSiteFormat } from "./format";

const SLOT_PX = 12;

type Props = { model: DayModel; timezone: string; onSelect: (s: SlotSelection) => void };

/** Desktop day view: rooms as columns, 15-minute rows. Free cells are real buttons. */
export function DayGrid({ model, timezone, onSelect }: Props) {
  const t = useTranslations("calendar");
  const fmt = useSiteFormat(timezone);
  const rows = model.slotCount;

  return (
    <div className="overflow-x-auto">
      <div
        className="grid border rounded-lg bg-card min-w-[640px]"
        style={{
          gridTemplateColumns: `4rem repeat(${model.rooms.length}, minmax(9rem, 1fr))`,
          gridTemplateRows: `2.5rem repeat(${rows}, ${SLOT_PX}px)`,
        }}
        role="grid"
        aria-label={t("title")}
      >
        {/* header */}
        <div className="sticky top-0 z-10 bg-card border-b" />
        {model.rooms.map((r) => (
          <div
            key={r.roomId}
            className="sticky top-0 z-10 bg-card border-b border-s px-2 flex items-center font-medium text-sm"
            role="columnheader"
          >
            {t("room")} {r.roomNumber}
          </div>
        ))}

        {/* hour labels + lines */}
        {model.hourTicks.map((tick) => (
          <div
            key={tick.idx}
            className="text-xs text-muted-foreground pe-2 text-end border-t -mt-px"
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
                  className={`m-px rounded border px-1.5 py-0.5 overflow-hidden ${blockClass[b.kind]}`}
                  style={{ gridColumn: col + 2, gridRow: `${b.startIdx + 2} / ${b.endIdx + 2}`, zIndex: 1 }}
                >
                  <BlockContent block={b} timezone={timezone} compact={b.endIdx - b.startIdx < 4} />
                </div>
              ) : null,
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
