/**
 * Pure slot math shared by the server (validation) and the client (rendering).
 * All instants are UTC Dates; segments/blocks come from the availability DTO.
 */
import { addMinutes, containedIn, overlaps, MINUTES_PER_SLOT, type Range } from "@/lib/time";

export type SlotInput = {
  openSegments: Range[];
  blocks: Range[];
  durationMinutes: number;
  /** Therapist constraints; null for admin. */
  window: { from: Date; to: Date } | null;
};

/** Returns every start instant (15-minute steps inside open segments) where a booking of the given duration fits. */
export function validStartTimes(input: SlotInput): Date[] {
  const out: Date[] = [];
  for (const seg of input.openSegments) {
    for (let t = seg.start; addMinutes(t, input.durationMinutes) <= seg.end; t = addMinutes(t, MINUTES_PER_SLOT)) {
      const range = { start: t, end: addMinutes(t, input.durationMinutes) };
      if (isStartValid(range, input)) out.push(t);
    }
  }
  return out;
}

export function isStartValid(range: Range, input: SlotInput): boolean {
  if (!input.openSegments.some((seg) => containedIn(range, seg))) return false;
  if (input.blocks.some((b) => overlaps(range, b))) return false;
  if (input.window) {
    if (range.start < input.window.from) return false;
    if (range.start > input.window.to) return false;
  }
  return true;
}
