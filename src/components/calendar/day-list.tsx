"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DayModel, RoomModel } from "./day-model";
import type { SlotSelection } from "./booking-dialog";
import { BlockContent, blockClass } from "./blocks";
import { useSiteFormat } from "./format";

type Props = { model: DayModel; timezone: string; onSelect: (s: SlotSelection) => void };

/** Mobile day view: a tab per room, chronological list of free ranges and blocks. */
export function DayList({ model, timezone, onSelect }: Props) {
  const t = useTranslations("calendar");
  return (
    <Tabs defaultValue={model.rooms[0]?.roomId}>
      <TabsList className="w-full overflow-x-auto justify-start">
        {model.rooms.map((r) => (
          <TabsTrigger key={r.roomId} value={r.roomId}>
            {t("room")} {r.roomNumber}
          </TabsTrigger>
        ))}
      </TabsList>
      {model.rooms.map((room) => (
        <TabsContent key={room.roomId} value={room.roomId}>
          <RoomList room={room} timezone={timezone} onSelect={onSelect} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function RoomList({
  room,
  timezone,
  onSelect,
}: {
  room: RoomModel;
  timezone: string;
  onSelect: (s: SlotSelection) => void;
}) {
  const t = useTranslations("calendar");
  type Item = { at: Date } & (
    { kind: "free"; range: RoomModel["freeRanges"][number] } | { kind: "block"; block: RoomModel["blocks"][number] }
  );
  const items: Item[] = [
    ...room.freeRanges.map((range) => ({ kind: "free" as const, at: range.start, range })),
    ...room.blocks.map((block) => ({ kind: "block" as const, at: new Date(block.start), block })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  if (items.length === 0) return <p className="text-sm text-muted-foreground py-4">{t("noSlots")}</p>;

  return (
    <ul className="divide-y rounded-lg border bg-card">
      {items.map((item, i) => (
        <li key={i} className={`p-3 ${item.kind === "block" ? blockClass[item.block.kind] : ""}`}>
          {item.kind === "free" ? (
            <FreeRow range={item.range} roomId={room.roomId} timezone={timezone} onSelect={onSelect} />
          ) : (
            <BlockContent block={item.block} timezone={timezone} />
          )}
        </li>
      ))}
    </ul>
  );
}

function FreeRow({
  range,
  roomId,
  timezone,
  onSelect,
}: {
  range: RoomModel["freeRanges"][number];
  roomId: string;
  timezone: string;
  onSelect: (s: SlotSelection) => void;
}) {
  const t = useTranslations("calendar");
  const fmt = useSiteFormat(timezone);
  const [start, setStart] = useState(range.starts[0].toISOString());
  const items = range.starts.map((d) => ({ value: d.toISOString(), label: fmt.time(d) }));
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm flex-1">✅ {t("freeRange", { range: fmt.range(range.start, range.end) })}</span>
      <Select value={start} onValueChange={(v) => v && setStart(v)} items={items}>
        <SelectTrigger size="sm" className="w-24" aria-label={t("pickTime")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" onClick={() => onSelect({ roomId, start: new Date(start) })}>
        {t("book")}
      </Button>
    </div>
  );
}
