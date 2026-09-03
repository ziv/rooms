import { addMinutes, MINUTES_PER_SLOT, REGULAR_BOOKING_MINUTES, type Range } from "@/lib/time";
import { isStartValid, validStartTimes, type SlotInput } from "@/lib/slots";
import type { AvailabilityBlock, DayAvailability, RoomAvailability } from "@/modules/availability/types";

export type BlockModel = AvailabilityBlock & { startIdx: number; endIdx: number };

export type RoomModel = {
  roomId: string;
  roomNumber: string;
  blocks: BlockModel[];
  /** Index of every valid start (in slot units from grid start). */
  validStarts: Set<number>;
  /** Merged free ranges with at least one valid start, for the mobile list. */
  freeRanges: { start: Date; end: Date; starts: Date[] }[];
  slotInput: SlotInput;
};

export type DayModel = {
  gridStart: Date;
  gridEnd: Date;
  slotCount: number;
  /** Hour tick indices for labels. */
  hourTicks: { idx: number; at: Date }[];
  rooms: RoomModel[];
  closedAllDay: boolean;
};

const toRange = (b: { start: string; end: string }): Range => ({ start: new Date(b.start), end: new Date(b.end) });

export function buildDayModel(day: DayAvailability, now: Date = new Date()): DayModel {
  const segments = day.rooms[0]?.openSegments.map(toRange) ?? [];
  if (segments.length === 0 || day.rooms.length === 0) {
    return { gridStart: now, gridEnd: now, slotCount: 0, hourTicks: [], rooms: [], closedAllDay: true };
  }
  const gridStart = new Date(Math.min(...segments.map((s) => s.start.getTime())));
  const gridEnd = new Date(Math.max(...segments.map((s) => s.end.getTime())));
  const slotCount = Math.round((gridEnd.getTime() - gridStart.getTime()) / 60_000 / MINUTES_PER_SLOT);
  const idxOf = (d: Date) => Math.round((d.getTime() - gridStart.getTime()) / 60_000 / MINUTES_PER_SLOT);
  const window = day.bookingWindow
    ? { from: new Date(day.bookingWindow.from), to: new Date(day.bookingWindow.to) }
    : null;

  const hourTicks: { idx: number; at: Date }[] = [];
  for (let i = 0; i < slotCount; i += 4) hourTicks.push({ idx: i, at: addMinutes(gridStart, i * MINUTES_PER_SLOT) });

  const rooms = day.rooms.map((room) => buildRoom(room, gridStart, gridEnd, idxOf, window));
  return { gridStart, gridEnd, slotCount, hourTicks, rooms, closedAllDay: false };
}

function buildRoom(
  room: RoomAvailability,
  gridStart: Date,
  gridEnd: Date,
  idxOf: (d: Date) => number,
  window: SlotInput["window"],
): RoomModel {
  const openSegments = room.openSegments.map(toRange);
  const blocks: BlockModel[] = room.blocks.map((b) => ({
    ...b,
    startIdx: Math.max(0, idxOf(new Date(b.start))),
    endIdx: Math.min(idxOf(gridEnd), idxOf(new Date(b.end))),
  }));
  const slotInput: SlotInput = {
    openSegments,
    blocks: room.blocks.map(toRange),
    durationMinutes: REGULAR_BOOKING_MINUTES,
    window,
  };
  const starts = validStartTimes(slotInput);
  const validStarts = new Set(starts.map(idxOf));

  // merge consecutive valid starts into free ranges (range end = last start + duration)
  const freeRanges: RoomModel["freeRanges"] = [];
  for (const s of starts) {
    const last = freeRanges.at(-1);
    if (last && s.getTime() - last.starts.at(-1)!.getTime() === MINUTES_PER_SLOT * 60_000) {
      last.starts.push(s);
      last.end = addMinutes(s, REGULAR_BOOKING_MINUTES);
    } else {
      freeRanges.push({ start: s, end: addMinutes(s, REGULAR_BOOKING_MINUTES), starts: [s] });
    }
  }
  void gridStart;
  return { roomId: room.roomId, roomNumber: room.roomNumber, blocks, validStarts, freeRanges, slotInput };
}

export function isValidStart(room: RoomModel, start: Date): boolean {
  return isStartValid({ start, end: addMinutes(start, REGULAR_BOOKING_MINUTES) }, room.slotInput);
}
